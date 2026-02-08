"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useWallet } from "@/lib/wallet-context"
import { KNOWN_TOKENS, ERC20_ABI, ESCROW_ABI, ESCROW_CONTRACT_ADDRESS, MONAD_CHAIN_ID_DECIMAL } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, ShieldCheck, Wallet } from "lucide-react"
const STEPS = ["Select Token", "Set Price", "Approve & List"]

export function CreateListingForm() {
  const router = useRouter()
  const { address, isConnected, tokens, connect, ethProvider, switchToMonad } = useWallet()
  const [step, setStep] = useState(0)
  const [selectedToken, setSelectedToken] = useState("")
  const [amount, setAmount] = useState("")
  const [askingPrice, setAskingPrice] = useState("")
  const [marketPrice] = useState("84") // Demo reference per unit in INR
  const [isApproving, setIsApproving] = useState(false)
  const [isListing, setIsListing] = useState(false)
  const [approved, setApproved] = useState(false)

  const allTokens = [
    ...tokens,
    ...KNOWN_TOKENS.filter((kt) => !tokens.find((t) => t.address === kt.address)).map((kt) => ({
      ...kt,
      balance: "0",
      balanceFormatted: "0",
    })),
  ]

  const selectedTokenInfo = allTokens.find((t) => t.address === selectedToken)
  const unitAskingPrice = Number(askingPrice) / Number(amount || 1)
  const unitMarketPrice = Number(marketPrice)
  const discount = unitMarketPrice > 0 ? ((unitMarketPrice - unitAskingPrice) / unitMarketPrice * 100).toFixed(1) : "0"

  const handleApprove = async () => {
    if (!selectedTokenInfo || !ethProvider) {
      toast.error("No wallet provider found. Please connect your wallet first.")
      return
    }

    // Ensure we're on Monad before sending any transaction
    await switchToMonad()

    setIsApproving(true)
    try {
      const { ethers } = await import("ethers")
      const provider = new ethers.BrowserProvider(ethProvider)
      const network = await provider.getNetwork()
      if (Number(network.chainId) !== MONAD_CHAIN_ID_DECIMAL) {
        toast.error("Please switch to Monad Testnet before approving.")
        setIsApproving(false)
        return
      }
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(selectedTokenInfo.address, ERC20_ABI, signer)
      const amountWei = ethers.parseUnits(amount, selectedTokenInfo.decimals)
      const tx = await contract.approve(ESCROW_CONTRACT_ADDRESS, amountWei)
      toast.info("Approval transaction submitted...")
      await tx.wait()
      setApproved(true)
      toast.success("Token approval confirmed!")
    } catch (err: unknown) {
      const e = err as { reason?: string; message?: string }
      toast.error(e.reason || e.message || "Approval failed")
    } finally {
      setIsApproving(false)
    }
  }

  const handleCreateListing = async () => {
    if (!address || !selectedTokenInfo) return
    setIsListing(true)
    try {
      // In production, this would call the escrow contract first
      // then store the listing in the database
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress: selectedTokenInfo.address,
          tokenSymbol: selectedTokenInfo.symbol,
          tokenName: selectedTokenInfo.name,
          tokenDecimals: selectedTokenInfo.decimals,
          tokenAmount: amount,
          sellerAddress: address,
          askingPriceINR: Number(askingPrice),
          marketPriceINR: Number(amount) * unitMarketPrice,
          discountPercent: Number(discount),
        }),
      })

      if (!res.ok) throw new Error("Failed to create listing")

      toast.success("Listing created successfully!")
      router.push("/dashboard")
    } catch {
      toast.error("Failed to create listing. Please try again.")
    } finally {
      setIsListing(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Wallet className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Connect Your Wallet</h2>
            <p className="mt-1 text-muted-foreground">
              Connect your wallet to list tokens for sale on the marketplace.
            </p>
            <Button onClick={connect} className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90">
              Connect Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Create Listing</h1>
        <p className="mt-1 text-muted-foreground">List your ERC-20 tokens for sale at a custom INR price.</p>
      </div>

      {/* Step Indicator */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                i <= step
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`hidden text-sm sm:inline ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <ArrowRight className="mx-1 h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Token */}
      {step === 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Select Token</CardTitle>
            <CardDescription>Choose which token you want to sell from your wallet.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="token" className="text-foreground">Token</Label>
              <Select value={selectedToken} onValueChange={setSelectedToken}>
                <SelectTrigger className="bg-card text-foreground">
                  <SelectValue placeholder="Select a token" />
                </SelectTrigger>
                <SelectContent className="bg-card text-foreground">
                  {allTokens.map((token) => (
                    <SelectItem key={token.address} value={token.address}>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{token.symbol}</span>
                        <span className="text-muted-foreground">- {token.name}</span>
                        {Number(token.balanceFormatted) > 0 && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {token.balanceFormatted}
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="amount" className="text-foreground">Amount to sell</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-card text-foreground placeholder:text-muted-foreground"
              />
              {selectedTokenInfo && Number(selectedTokenInfo.balanceFormatted) > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(selectedTokenInfo.balanceFormatted)}
                  className="self-start text-xs text-primary hover:underline"
                >
                  Max: {selectedTokenInfo.balanceFormatted} {selectedTokenInfo.symbol}
                </button>
              )}
            </div>

            <Button
              onClick={() => setStep(1)}
              disabled={!selectedToken || !amount || Number(amount) <= 0}
              className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Set Price */}
      {step === 1 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Set Your Price</CardTitle>
            <CardDescription>
              Set a total asking price in INR for {amount} {selectedTokenInfo?.symbol}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-lg bg-secondary/50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Selling</span>
                <span className="font-medium text-foreground">
                  {amount} {selectedTokenInfo?.symbol}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Reference Market Price</span>
                <span className="text-sm text-muted-foreground">
                  ~{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(amount) * unitMarketPrice)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="price" className="text-foreground">Total Asking Price (INR)</Label>
              <Input
                id="price"
                type="number"
                placeholder="Enter INR amount"
                value={askingPrice}
                onChange={(e) => setAskingPrice(e.target.value)}
                className="bg-card text-foreground placeholder:text-muted-foreground"
              />
            </div>

            {askingPrice && Number(askingPrice) > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm text-foreground">
                  You are offering a <strong className="text-primary">{discount}% discount</strong> below market price.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)} className="text-foreground">
                Back
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!askingPrice || Number(askingPrice) <= 0}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Approve & List */}
      {step === 2 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Confirm & List</CardTitle>
            <CardDescription>
              Approve the escrow contract and create your listing.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Summary */}
            <div className="rounded-lg bg-secondary/50 p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Token</span>
                  <span className="font-medium text-foreground">{selectedTokenInfo?.symbol}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Amount</span>
                  <span className="font-medium text-foreground">{amount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Asking Price</span>
                  <span className="font-bold text-foreground">
                    {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(Number(askingPrice))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Discount</span>
                  <Badge className="bg-emerald-500/10 text-emerald-400">{discount}% off</Badge>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">
                Your tokens will be held in a secure escrow smart contract until a buyer completes INR payment.
              </p>
            </div>

            {/* Step 1: Approve */}
            <Button
              onClick={handleApprove}
              disabled={approved || isApproving}
              variant={approved ? "outline" : "default"}
              className={approved ? "border-primary/30 text-primary" : "bg-primary text-primary-foreground hover:bg-primary/90"}
            >
              {isApproving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : approved ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approved
                </>
              ) : (
                "Step 1: Approve Token Transfer"
              )}
            </Button>

            {/* Step 2: Create Listing */}
            <Button
              onClick={handleCreateListing}
              disabled={!approved || isListing}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isListing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating listing...
                </>
              ) : (
                "Step 2: Create Listing"
              )}
            </Button>

            <Button variant="outline" onClick={() => setStep(1)} className="text-foreground">
              Back
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
