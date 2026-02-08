"use client"

import useSWR from "swr"
import { useWallet } from "@/lib/wallet-context"
import type { Listing } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Wallet, Package, CircleDollarSign, Clock, XCircle } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    OPEN: "bg-primary/10 text-primary border-primary/20",
    SOLD: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    CANCELLED: "bg-destructive/10 text-destructive border-destructive/20",
  }
  return (
    <Badge variant="outline" className={styles[status] || "text-muted-foreground"}>
      {status}
    </Badge>
  )
}

export function Dashboard() {
  const { address, isConnected, connect } = useWallet()
  const { data: listings = [], mutate } = useSWR<Listing[]>(
    address ? `/api/listings?seller=${address}` : null,
    fetcher,
    { refreshInterval: 10000 }
  )

  const openListings = listings.filter((l) => l.status === "OPEN")
  const soldListings = listings.filter((l) => l.status === "SOLD")
  const cancelledListings = listings.filter((l) => l.status === "CANCELLED")
  const totalEarnings = soldListings.reduce((acc, l) => acc + l.askingPriceINR, 0)

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      })
      if (!res.ok) throw new Error()
      toast.success("Listing cancelled successfully")
      mutate()
    } catch {
      toast.error("Failed to cancel listing")
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
            <p className="text-muted-foreground">
              Connect your wallet to view your listings and dashboard.
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
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Manage your token listings and track earnings.</p>
        </div>
        <Link href="/create-listing">
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            New Listing
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Listings</p>
              <p className="text-2xl font-bold text-foreground">{openListings.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <CircleDollarSign className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Earnings</p>
              <p className="text-2xl font-bold text-foreground">{formatINR(totalEarnings)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Clock className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sold Listings</p>
              <p className="text-2xl font-bold text-foreground">{soldListings.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Listings Tabs */}
      <Tabs defaultValue="open">
        <TabsList className="bg-secondary">
          <TabsTrigger value="open" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
            Open ({openListings.length})
          </TabsTrigger>
          <TabsTrigger value="sold" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
            Sold ({soldListings.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="data-[state=active]:bg-card data-[state=active]:text-foreground">
            Cancelled ({cancelledListings.length})
          </TabsTrigger>
        </TabsList>

        {["open", "sold", "cancelled"].map((tab) => {
          const items =
            tab === "open" ? openListings : tab === "sold" ? soldListings : cancelledListings
          return (
            <TabsContent key={tab} value={tab} className="mt-4">
              {items.length === 0 ? (
                <Card className="border-border bg-card">
                  <CardContent className="flex flex-col items-center py-12">
                    <Package className="mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No {tab} listings</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-3">
                  {items.map((listing) => (
                    <Card key={listing.id} className="border-border bg-card">
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                            {listing.tokenSymbol.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">
                                {listing.tokenAmount} {listing.tokenSymbol}
                              </p>
                              <StatusBadge status={listing.status} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formatINR(listing.askingPriceINR)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/listing/${listing.id}`}>
                            <Button variant="outline" size="sm" className="text-foreground bg-transparent">
                              View
                            </Button>
                          </Link>
                          {listing.status === "OPEN" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancel(listing.id)}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <XCircle className="mr-1 h-3.5 w-3.5" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
