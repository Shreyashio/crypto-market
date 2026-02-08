"use client"

import Link from "next/link"
import type { Listing } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowDown, Clock, ShieldCheck } from "lucide-react"

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

function getTokenColor(symbol: string) {
  const colors: Record<string, string> = {
    USDT: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    USDC: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    WETH: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
    MON: "bg-primary/15 text-primary border-primary/20",
  }
  return colors[symbol] || "bg-primary/15 text-primary border-primary/20"
}

export function ListingCard({ listing }: { listing: Listing }) {
  const truncatedSeller = `${listing.sellerAddress.slice(0, 6)}...${listing.sellerAddress.slice(-4)}`

  return (
    <Card className="group overflow-hidden border-border bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <CardContent className="flex flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-bold ${getTokenColor(listing.tokenSymbol)}`}>
              {listing.tokenSymbol.slice(0, 2)}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{listing.tokenName}</h3>
              <p className="text-xs text-muted-foreground">{listing.tokenSymbol}</p>
            </div>
          </div>
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-xs">
            <ShieldCheck className="mr-1 h-3 w-3" />
            Escrow
          </Badge>
        </div>

        {/* Amount */}
        <div className="rounded-lg bg-secondary/50 p-3">
          <p className="text-xs text-muted-foreground">Amount for sale</p>
          <p className="text-xl font-bold text-foreground">
            {listing.tokenAmount} <span className="text-sm font-normal text-muted-foreground">{listing.tokenSymbol}</span>
          </p>
        </div>

        {/* Pricing */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Asking Price</p>
            <p className="text-lg font-bold text-foreground">{formatINR(listing.askingPriceINR)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Market Price</p>
            <p className="text-sm text-muted-foreground line-through">{formatINR(listing.marketPriceINR)}</p>
          </div>
        </div>

        {/* Discount badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
            <ArrowDown className="h-3 w-3" />
            {listing.discountPercent}% below market
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {timeAgo(listing.createdAt)}
            <span className="mx-1">by</span>
            <code className="rounded bg-secondary px-1 py-0.5 text-xs text-muted-foreground">{truncatedSeller}</code>
          </div>
        </div>

        {/* Buy Button */}
        <Link href={`/listing/${listing.id}`}>
          <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            Buy Now
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
