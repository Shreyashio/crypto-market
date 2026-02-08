import { NextResponse } from "next/server"
import crypto from "node:crypto"
import {
  getListingById,
  getTransactionByOrderId,
  updateListingStatus,
  updateTransactionStatus,
  releasePurchaseLock,
  createPayout,
} from "@/lib/store"
import {
  ESCROW_CONTRACT_ADDRESS,
  ESCROW_ABI,
  MONAD_RPC_URL,
} from "@/lib/types"

export async function POST(request: Request) {
  const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET
  const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY

  if (!RAZORPAY_KEY_SECRET) {
    return NextResponse.json(
      { error: "Server misconfiguration: RAZORPAY_KEY_SECRET not set." },
      { status: 500 }
    )
  }

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      listingId,
      buyerAddress,
    } = await request.json()

    // ---- 1. Validate required fields ----
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !listingId || !buyerAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // ---- 2. Find the internal transaction by Razorpay order ID ----
    const transaction = getTransactionByOrderId(razorpay_order_id)
    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found for this order" }, { status: 404 })
    }

    // Prevent re-processing an already completed transaction
    if (transaction.status === "RELEASED" || transaction.status === "PAID") {
      return NextResponse.json({
        success: true,
        message: "Payment already processed.",
        escrowTxHash: transaction.escrowTxHash || null,
      })
    }

    // Ensure the listing matches
    if (transaction.listingId !== listingId) {
      return NextResponse.json({ error: "Listing ID mismatch" }, { status: 400 })
    }

    // ---- 3. Verify Razorpay HMAC-SHA256 signature ----
    const body = `${razorpay_order_id}|${razorpay_payment_id}`
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex")

    if (expectedSignature !== razorpay_signature) {
      console.error("[v0] Signature mismatch. Expected:", expectedSignature, "Got:", razorpay_signature)
      updateTransactionStatus(transaction.id, "FAILED", { paymentId: razorpay_payment_id })
      releasePurchaseLock(listingId)
      return NextResponse.json({ error: "Invalid payment signature. Potential tampering detected." }, { status: 400 })
    }

    // ---- 4. Signature valid - mark transaction as PAID ----
    updateTransactionStatus(transaction.id, "PAID", { paymentId: razorpay_payment_id })

    // ---- 5. Call escrow smart contract to release tokens to buyer ----
    let escrowTxHash: string | null = null

    if (ADMIN_PRIVATE_KEY && ESCROW_CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
      try {
        updateTransactionStatus(transaction.id, "RELEASING")

        const { ethers } = await import("ethers")
        const provider = new ethers.JsonRpcProvider(MONAD_RPC_URL)
        const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider)
        const escrow = new ethers.Contract(ESCROW_CONTRACT_ADDRESS, ESCROW_ABI, wallet)

        const tx = await escrow.releaseToBuyer(listingId, buyerAddress)
        const receipt = await tx.wait()
        escrowTxHash = receipt.hash

        // Mark as fully released
        updateTransactionStatus(transaction.id, "RELEASED", { escrowTxHash })
      } catch (escrowErr) {
        console.error("[v0] Escrow release failed:", escrowErr)
        // Payment was real - mark PAID, don't mark FAILED
        // Admin can manually release later
        updateTransactionStatus(transaction.id, "PAID", {
          paymentId: razorpay_payment_id,
        })
      }
    } else {
      // No escrow contract deployed yet - mark as RELEASED for demo
      console.warn("[v0] No escrow contract configured. Marking as RELEASED for demo.")
      updateTransactionStatus(transaction.id, "RELEASED", { paymentId: razorpay_payment_id })
    }

    // ---- 6. Update listing status to SOLD ----
    const listing = getListingById(listingId)
    updateListingStatus(listingId, "SOLD", buyerAddress)
    releasePurchaseLock(listingId)

    // ---- 7. Create payout record for seller ----
    if (listing) {
      createPayout({
        sellerAddress: listing.sellerAddress,
        amountINR: listing.askingPriceINR,
        status: "PENDING",
        transactionId: transaction.id,
      })
    }

    return NextResponse.json({
      success: true,
      message: escrowTxHash
        ? "Payment verified. Tokens released to your wallet."
        : "Payment verified. Tokens will be released shortly.",
      escrowTxHash,
      transactionId: transaction.id,
    })
  } catch (err) {
    console.error("[v0] Verify payment error:", err)
    return NextResponse.json({ error: "Payment verification failed" }, { status: 500 })
  }
}
