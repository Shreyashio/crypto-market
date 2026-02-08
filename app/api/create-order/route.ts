import { NextResponse } from "next/server"
import {
  getListingById,
  createTransaction,
  acquirePurchaseLock,
  releasePurchaseLock,
} from "@/lib/store"

export async function POST(request: Request) {
  // Force get env vars - in case they were updated after build
  let RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
  let RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

  console.log("[v0] Razorpay credentials check (env):", {
    hasKeyId: !!RAZORPAY_KEY_ID,
    hasSecret: !!RAZORPAY_KEY_SECRET,
    keyIdLength: RAZORPAY_KEY_ID?.length || 0,
    keyIdPrefix: RAZORPAY_KEY_ID?.slice(0, 10),
    secretLength: RAZORPAY_KEY_SECRET?.length || 0,
  })

  // Hardcoded fallback for testing (replace with your actual keys)
  // This is a temporary solution until env vars reload properly
  if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID === "not_set") {
    RAZORPAY_KEY_ID = "rzp_test_SDe3k2zkGMWMRp"
  }
  if (!RAZORPAY_KEY_SECRET || RAZORPAY_KEY_SECRET === "not_set") {
    RAZORPAY_KEY_SECRET = "Ogj7EGgENyU5skM876ghlmz6"
  }

  console.log("[v0] Using Razorpay credentials (after fallback):", {
    keyIdStart: RAZORPAY_KEY_ID.slice(0, 10),
    secretStart: RAZORPAY_KEY_SECRET.slice(0, 5),
  })

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error("[v0] Razorpay not configured")
    return NextResponse.json(
      { error: "Razorpay is not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET." },
      { status: 500 }
    )
  }

  let listingId: string | undefined

  try {
    const body = await request.json()
    listingId = body.listingId
    const buyerAddress: string = body.buyerAddress

    if (!listingId || !buyerAddress) {
      return NextResponse.json({ error: "listingId and buyerAddress are required" }, { status: 400 })
    }

    const listing = getListingById(listingId)
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 })
    }

    if (listing.status !== "OPEN") {
      return NextResponse.json({ error: "Listing is no longer available" }, { status: 400 })
    }

    // Prevent the same listing from being purchased concurrently
    if (!acquirePurchaseLock(listingId)) {
      return NextResponse.json(
        { error: "Another buyer is currently processing this listing. Please try again shortly." },
        { status: 409 }
      )
    }

    // Create a real Razorpay order via their REST API
    const amountPaise = Math.round(listing.askingPriceINR * 100) // Razorpay expects paise
    
    // Trim any whitespace from credentials (can happen from copy-paste)
    const keyId = RAZORPAY_KEY_ID.trim()
    const secret = RAZORPAY_KEY_SECRET.trim()
    
    // Log raw credentials for debugging (first 3 + last 3 chars only for security)
    console.log("[v0] Raw credentials:", {
      keyIdStartEnd: `${keyId.slice(0, 3)}...${keyId.slice(-3)}`,
      secretStartEnd: `${secret.slice(0, 3)}...${secret.slice(-3)}`,
      keyIdLength: keyId.length,
      secretLength: secret.length,
    })
    
    const authString = `${keyId}:${secret}`
    const auth = Buffer.from(authString).toString("base64")
    
    // Decode the base64 to verify it matches our input
    const decodedAuth = Buffer.from(auth, "base64").toString("utf-8")
    console.log("[v0] Auth verification:", {
      decodedMatches: decodedAuth === authString,
      decodedPreview: decodedAuth.slice(0, 30),
    })

    const requestBody = JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: `listing_${listingId}_${Date.now()}`,
      notes: {
        listingId,
        buyerAddress,
        tokenSymbol: listing.tokenSymbol,
        tokenAmount: listing.tokenAmount,
      },
    })
    
    console.log("[v0] About to call Razorpay with:", {
      url: "https://api.razorpay.com/v1/orders",
      method: "POST",
      authHeader: `Basic ${auth.slice(0, 10)}...${auth.slice(-5)}`,
      bodySize: requestBody.length,
    })

    const razorpayRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: requestBody,
    })

    console.log("[v0] Razorpay response status:", razorpayRes.status)

    if (!razorpayRes.ok) {
      const errBody = await razorpayRes.text()
      console.error("[v0] Razorpay order creation failed:", {
        status: razorpayRes.status,
        error: errBody,
        url: "https://api.razorpay.com/v1/orders",
        method: "POST",
        authHeaderPresent: true,
      })
      releasePurchaseLock(listingId)
      
      // Return more detailed error for 401
      if (razorpayRes.status === 401) {
        return NextResponse.json(
          { 
            error: "Razorpay authentication failed. Verify your Key ID and Key Secret are correct and have no extra spaces.",
            details: "401 Unauthorized - Check that RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set correctly in environment variables."
          },
          { status: 502 }
        )
      }
      
      return NextResponse.json(
        { error: "Failed to create Razorpay order. Please try again." },
        { status: 502 }
      )
    }

    const razorpayOrder = await razorpayRes.json()

    // Create our internal transaction record linked to the Razorpay order
    const transaction = createTransaction({
      listingId,
      buyerAddress,
      sellerAddress: listing.sellerAddress,
      tokenSymbol: listing.tokenSymbol,
      tokenAmount: listing.tokenAmount,
      amountINR: listing.askingPriceINR,
      razorpayOrderId: razorpayOrder.id, // real Razorpay order_id e.g. order_XXXXX
      status: "PENDING",
    })

    return NextResponse.json({
      orderId: razorpayOrder.id,
      amount: amountPaise,
      currency: "INR",
      transactionId: transaction.id,
      razorpayKeyId: RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error("[v0] Create order error:", err)
    if (listingId) releasePurchaseLock(listingId)
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 })
  }
}
