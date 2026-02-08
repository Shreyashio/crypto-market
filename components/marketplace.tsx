"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { ListingCard } from "./listing-card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, SlidersHorizontal, TrendingDown, Store } from "lucide-react"
import type { Listing } from "@/lib/types"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function Marketplace() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const { data: listings = [], isLoading } = useSWR<Listing[]>("/api/listings", fetcher, {
    refreshInterval: 10000,
  })
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<"recent" | "discount" | "price">("recent")

  const openListings = listings.filter((l) => l.status === "OPEN")

  const filtered = openListings
    .filter(
      (l) =>
        l.tokenSymbol.toLowerCase().includes(search.toLowerCase()) ||
        l.tokenName.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "discount") return b.discountPercent - a.discountPercent
      if (sortBy === "price") return a.askingPriceINR - b.askingPriceINR
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  const totalVolume = openListings.reduce((acc, l) => acc + l.askingPriceINR, 0)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Hero Section */}
      <div className="mb-10">
        <h1 className="text-balance text-3xl font-bold text-foreground md:text-4xl">
          P2P Token Marketplace
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Buy ERC-20 tokens at discounted INR prices. All tokens held in escrow until payment is verified.
        </p>

        {/* Stats */}
        <div className="mt-6 flex flex-wrap gap-4">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
            <Store className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Active Listings</p>
              <p className="text-sm font-bold text-foreground">{openListings.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
            <TrendingDown className="h-4 w-4 text-emerald-400" />
            <div>
              <p className="text-xs text-muted-foreground">Total Volume</p>
              <p className="text-sm font-bold text-foreground">
                {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(totalVolume)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {mounted && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tokens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-card pl-9 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <Button
              variant={sortBy === "recent" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("recent")}
              className={sortBy === "recent" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}
            >
              Recent
            </Button>
            <Button
              variant={sortBy === "discount" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("discount")}
              className={sortBy === "discount" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}
            >
              Best Discount
            </Button>
            <Button
              variant={sortBy === "price" ? "default" : "outline"}
              size="sm"
              onClick={() => setSortBy("price")}
              className={sortBy === "price" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}
            >
              Lowest Price
            </Button>
          </div>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-lg bg-card" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-20">
          <Store className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium text-foreground">No listings found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your search or check back later.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  )
}
