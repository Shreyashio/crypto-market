"use client"

import useSWR from "swr"
import { useWallet } from "@/lib/wallet-context"
import type { Transaction } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Wallet, ArrowUpRight, ArrowDownLeft, Clock, History, ExternalLink } from "lucide-react"

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
    PENDING: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    PAID: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    RELEASING: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    RELEASED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    FAILED: "bg-destructive/10 text-destructive border-destructive/20",
  }
  return (
    <Badge variant="outline" className={styles[status] || "text-muted-foreground"}>
      {status}
    </Badge>
  )
}

export function TransactionHistory() {
  const { address, isConnected, connect } = useWallet()
  const { data: transactions = [] } = useSWR<Transaction[]>(
    address ? `/api/transactions?address=${address}` : null,
    fetcher,
    { refreshInterval: 10000 }
  )

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
              Connect your wallet to view your transaction history.
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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Transaction History</h1>
        <p className="mt-1 text-muted-foreground">Track all your buy and sell transactions.</p>
      </div>

      {transactions.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center py-16">
            <History className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium text-foreground">No transactions yet</p>
            <p className="text-sm text-muted-foreground">
              Your buy and sell transactions will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {transactions.map((tx) => {
            const isBuyer = tx.buyerAddress.toLowerCase() === address?.toLowerCase()
            return (
              <Card key={tx.id} className="border-border bg-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        isBuyer ? "bg-emerald-500/10" : "bg-blue-500/10"
                      }`}
                    >
                      {isBuyer ? (
                        <ArrowDownLeft className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5 text-blue-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">
                          {isBuyer ? "Bought" : "Sold"} {tx.tokenAmount} {tx.tokenSymbol}
                        </p>
                        <StatusBadge status={tx.status} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(tx.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${isBuyer ? "text-destructive" : "text-emerald-400"}`}>
                      {isBuyer ? "-" : "+"}{formatINR(tx.amountINR)}
                    </p>
                    {tx.escrowTxHash ? (
                      <a
                        href={`https://testnet.monadexplorer.com/tx/${tx.escrowTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-end gap-1 text-xs text-primary hover:underline"
                      >
                        Tx: {tx.escrowTxHash.slice(0, 10)}...
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Order: {tx.razorpayOrderId.slice(0, 12)}...
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
