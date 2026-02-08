"use client"

import { useWallet } from "@/lib/wallet-context"
import { MONAD_CHAIN_ID } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Wallet, RefreshCw, Copy, Check, AlertTriangle, Coins } from "lucide-react"
import { useState } from "react"

export function WalletInfo() {
  const {
    address,
    chainId,
    isConnected,
    tokens,
    nativeBalance,
    connect,
    switchToMonad,
    refreshTokens,
  } = useWallet()
  const [copied, setCopied] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const isWrongChain = chainId !== MONAD_CHAIN_ID

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshTokens()
    setTimeout(() => setIsRefreshing(false), 1000)
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
              Connect your wallet to view your balances and token holdings.
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
        <h1 className="text-2xl font-bold text-foreground">Wallet</h1>
        <p className="mt-1 text-muted-foreground">View your connected wallet information and token balances.</p>
      </div>

      {/* Wrong chain warning */}
      {isWrongChain && (
        <Card className="mb-6 border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500" />
            <div className="flex-1">
              <p className="font-medium text-foreground">Wrong Network</p>
              <p className="text-sm text-muted-foreground">Please switch to Monad Testnet to use Crypto-Market.</p>
            </div>
            <Button onClick={switchToMonad} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              Switch Network
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Address Card */}
      <Card className="mb-6 border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Connected Address</CardTitle>
          <CardDescription>Your MetaMask wallet address</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg bg-secondary p-3">
            <code className="flex-1 break-all text-sm text-foreground">{address}</code>
            <Button variant="ghost" size="sm" onClick={copyAddress} className="shrink-0 text-muted-foreground hover:text-foreground">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              {isWrongChain ? "Wrong Network" : "Monad Testnet"}
            </Badge>
            <span className="text-xs text-muted-foreground">Chain ID: {chainId}</span>
          </div>
        </CardContent>
      </Card>

      {/* Native Balance */}
      <Card className="mb-6 border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Native Balance</CardTitle>
            <CardDescription>MON balance on Monad</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Coins className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {Number(nativeBalance).toFixed(4)} <span className="text-base font-normal text-muted-foreground">MON</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Token Balances */}
      <Card className="border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-foreground">Token Balances</CardTitle>
            <CardDescription>ERC-20 tokens detected in your wallet</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="text-muted-foreground hover:text-foreground bg-transparent"
          >
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Coins className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No ERC-20 tokens detected.</p>
              <p className="text-xs text-muted-foreground">
                Make sure you are connected to Monad Testnet and hold tokens.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {tokens.map((token) => (
                <div
                  key={token.address}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                      {token.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{token.symbol}</p>
                      <p className="text-xs text-muted-foreground">{token.name}</p>
                    </div>
                  </div>
                  <p className="font-medium text-foreground">{token.balanceFormatted}</p>
                </div>
              ))}
            </div>
          )}

          <Separator className="my-4 bg-border" />

          <p className="text-center text-xs text-muted-foreground">
            Token detection scans known contract addresses. Some tokens may not appear automatically.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
