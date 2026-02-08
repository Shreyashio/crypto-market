"use client"

import { useRouter } from "next/navigation"
import useSWR from "swr"
import { useWallet } from "@/lib/wallet-context"
import type { Listing } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  ArrowDown,
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react"
import { useState, useCallback } from "react"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Request failed with status ${res.status}`)
  }
  return res.json()
}

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance
  }
}

interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  handler: (response: RazorpayResponse) => void
  modal?: { ondismiss?: () => void }
  prefill: { name: string; email: string }
  theme: { color: string }
}

interface RazorpayInstance {
  open: () => void
  on: (event: string, handler: () => void) => void
}

interface RazorpayResponse {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type BuyStep =
  | "idle"
  | "creating_order"
  | "awaiting_payment"
  | "verifying_payment"
  | "releasing_tokens"
  | "success"
  | "failed"

const STEP_LABELS: Record<BuyStep, string> = {
  idle: "",
  creating_order: "Creating Razorpay order...",
  awaiting_payment: "Complete payment in Razorpay window...",
  verifying_payment: "Verifying payment signature...",
  releasing_tokens: "Releasing tokens to your wallet...",
  success: "Purchase complete!",
  failed: "Transaction failed",
}

export function ListingDetail({ id }: { id: string }) {
  const router = useRouter()
  const { address, isConnected, connect } = useWallet()
  const { data: listing, isLoading, error, mutate } = useSWR<Listing>(`/api/listings/${id}`, fetcher)

  const [buyStep, setBuyStep] = useState<BuyStep>("idle")
  const [escrowTxHash, setEscrowTxHash] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadRazorpayScript = useCallback(async () => {
    if (window.Razorpay) return
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement("script")
      script.src = "https://checkout.razorpay.com/v1/checkout.js"
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("Failed to load Razorpay SDK"))
      document.head.appendChild(script)
    })
  }, [])

  const handleBuy = useCallback(async () => {
    if (!isConnected || !address) {
      connect()
      return
    }

    if (!listing || listing.status !== "OPEN") return

    setEscrowTxHash(null)
    setErrorMessage(null)

    // ---- Step 1: Create Razorpay order ----
    setBuyStep("creating_order")
    try {
      await loadRazorpayScript()

      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: id, buyerAddress: address }),
      })

      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}))
        const errorMsg = errData.details || errData.error || `Failed to create order (${orderRes.status})`
        console.log("[v0] Order creation error:", errorMsg)
        throw new Error(errorMsg)
      }

      const order = await orderRes.json()

      // ---- Step 2: Open Razorpay checkout ----
      setBuyStep("awaiting_payment")

      const rzp = new window.Razorpay({
        key: order.razorpayKeyId,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "Crypto-Market",
        description: `Buy ${listing.tokenAmount} ${listing.tokenSymbol}`,
        order_id: order.orderId,
        handler: async (response: RazorpayResponse) => {
          // ---- Step 3: Verify payment signature ----
          setBuyStep("verifying_payment")

          try {
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                listingId: id,
                buyerAddress: address,
              }),
            })

            const verifyData = await verifyRes.json()

            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.error || "Payment verification failed")
            }

            // ---- Step 4: Tokens released ----
            if (verifyData.escrowTxHash) {
              setEscrowTxHash(verifyData.escrowTxHash)
            }

            setBuyStep("success")
            toast.success("Payment verified! Tokens released to your wallet.")

            // Refresh listing data to show SOLD status
            mutate()
          } catch (verifyErr) {
            const msg = verifyErr instanceof Error ? verifyErr.message : "Verification failed"
            setErrorMessage(msg)
            setBuyStep("failed")
            toast.error(msg)
          }
        },
        modal: {
          ondismiss: () => {
            // User closed Razorpay modal without paying
            setBuyStep("idle")
            toast.info("Payment cancelled.")
          },
        },
        prefill: {
          name: "Buyer",
          email: "buyer@example.com",
        },
        theme: {
          color: "#0d9668",
        },
      })

      rzp.open()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to initiate purchase"
      setErrorMessage(msg)
      setBuyStep("failed")
      toast.error(msg)
    }
  }, [isConnected, address, connect, listing, id, loadRazorpayScript, mutate])

  const resetBuyState = useCallback(() => {
    setBuyStep("idle")
    setErrorMessage(null)
    setEscrowTxHash(null)
  }, [])

  // ---- Loading / error states ----
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h2 className="text-xl font-bold text-foreground">Listing not found</h2>
        <p className="mt-2 text-muted-foreground">This listing may have been removed or does not exist.</p>
        <Button onClick={() => router.push("/")} className="mt-4 text-foreground" variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Marketplace
        </Button>
      </div>
    )
  }

  const isSeller = !!(address && listing.sellerAddress && address.toLowerCase() === listing.sellerAddress.toLowerCase())
  const isSold = listing.status !== "OPEN"
  const isBusy = buyStep !== "idle" && buyStep !== "success" && buyStep !== "failed"

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Button
        variant="ghost"
        onClick={() => router.push("/")}
        className="mb-6 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Marketplace
      </Button>

      <div className="grid gap-6 md:grid-cols-5">
        {/* Left - Listing Details */}
        <div className="md:col-span-3">
          <Card className="border-border bg-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary">
                    {listing.tokenSymbol.slice(0, 2)}
                  </div>
                  <div>
                    <CardTitle className="text-foreground">{listing.tokenName}</CardTitle>
                    <p className="text-sm text-muted-foreground">{listing.tokenSymbol}</p>
                  </div>
                </div>
                <Badge
                  variant={listing.status === "OPEN" ? "default" : "secondary"}
                  className={
                    listing.status === "OPEN"
                      ? "bg-primary/10 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }
                >
                  {listing.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="rounded-lg bg-secondary/50 p-4">
                <p className="text-sm text-muted-foreground">Amount for Sale</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {listing.tokenAmount}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    {listing.tokenSymbol}
                  </span>
                </p>
              </div>

              <Separator className="bg-border" />

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Seller Address</span>
                  <code className="rounded bg-secondary px-2 py-1 text-xs text-muted-foreground">
                    {listing.sellerAddress?.slice(0, 8)}...{listing.sellerAddress?.slice(-6)}
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Token Contract</span>
                  <code className="rounded bg-secondary px-2 py-1 text-xs text-muted-foreground">
                    {listing.tokenAddress?.slice(0, 8)}...{listing.tokenAddress?.slice(-6)}
                  </code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Listed</span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {timeAgo(listing.createdAt)}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Tokens are held in a secure escrow smart contract. They will only be released
                  after successful INR payment verification via Razorpay.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right - Buy Panel */}
        <div className="md:col-span-2">
          <Card className="sticky top-24 border-border bg-card">
            <CardContent className="flex flex-col gap-4 p-5">
              <div>
                <p className="text-sm text-muted-foreground">Asking Price</p>
                <p className="text-3xl font-bold text-foreground">{formatINR(listing.askingPriceINR)}</p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Market Price</span>
                <span className="text-sm text-muted-foreground line-through">
                  {formatINR(listing.marketPriceINR)}
                </span>
              </div>

              <div className="flex items-center gap-1.5 self-start rounded-full bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-400">
                <ArrowDown className="h-3.5 w-3.5" />
                {listing.discountPercent}% below market
              </div>

              <Separator className="bg-border" />

              {/* Progress Steps */}
              {isBusy && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{STEP_LABELS[buyStep]}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Do not close this page</p>
                    </div>
                  </div>

                  {/* Step indicators */}
                  <div className="mt-4 flex flex-col gap-2">
                    {(["creating_order", "awaiting_payment", "verifying_payment", "releasing_tokens"] as BuyStep[]).map(
                      (step, i) => {
                        const steps: BuyStep[] = ["creating_order", "awaiting_payment", "verifying_payment", "releasing_tokens"]
                        const currentIdx = steps.indexOf(buyStep)
                        const stepIdx = i
                        const isDone = stepIdx < currentIdx
                        const isCurrent = stepIdx === currentIdx

                        return (
                          <div key={step} className="flex items-center gap-2">
                            {isDone ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : isCurrent ? (
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            ) : (
                              <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
                            )}
                            <span
                              className={`text-xs ${isDone ? "text-primary" : isCurrent ? "text-foreground" : "text-muted-foreground/50"}`}
                            >
                              {STEP_LABELS[step]}
                            </span>
                          </div>
                        )
                      }
                    )}
                  </div>
                </div>
              )}

              {/* Success State */}
              {buyStep === "success" && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-semibold text-foreground">Purchase Complete</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Tokens have been released to your wallet.
                      </p>
                    </div>
                  </div>

                  {escrowTxHash && (
                    <div className="mt-3 rounded-md bg-secondary p-3">
                      <p className="text-xs text-muted-foreground">Transaction Hash</p>
                      <a
                        href={`https://testnet.monadexplorer.com/tx/${escrowTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline break-all"
                      >
                        {escrowTxHash.slice(0, 16)}...{escrowTxHash.slice(-12)}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-foreground bg-transparent"
                      onClick={() => router.push("/history")}
                    >
                      View History
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => router.push("/")}
                    >
                      Back to Market
                    </Button>
                  </div>
                </div>
              )}

              {/* Failed State */}
              {buyStep === "failed" && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-6 w-6 text-destructive" />
                    <div>
                      <p className="font-semibold text-foreground">Transaction Failed</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {errorMessage || "Something went wrong. Please try again."}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={resetBuyState}
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full text-foreground bg-transparent"
                  >
                    Try Again
                  </Button>
                </div>
              )}

              {/* Buy / Connect Buttons (only show in idle state) */}
              {buyStep === "idle" && (
                <>
                  {isSold ? (
                    <div className="rounded-lg bg-secondary p-4 text-center">
                      <p className="font-medium text-muted-foreground">This listing is no longer available.</p>
                    </div>
                  ) : isSeller ? (
                    <div className="rounded-lg bg-secondary p-4 text-center">
                      <p className="font-medium text-muted-foreground">This is your listing.</p>
                    </div>
                  ) : !isConnected ? (
                    <Button
                      onClick={connect}
                      className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Wallet className="h-4 w-4" />
                      Connect Wallet to Buy
                    </Button>
                  ) : (
                    <Button
                      onClick={handleBuy}
                      className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                      size="lg"
                    >
                      <CreditCard className="h-4 w-4" />
                      Make Payment
                    </Button>
                  )}
                </>
              )}

              <p className="text-center text-xs text-muted-foreground">
                Payment processed securely via Razorpay. Tokens released only after cryptographic verification.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
