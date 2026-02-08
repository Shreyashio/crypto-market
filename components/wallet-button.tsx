"use client"

import { useWallet } from "@/lib/wallet-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Wallet, LogOut, Copy, Check } from "lucide-react"
import { useState, useEffect } from "react"

export function WalletButton() {
  const { address, isConnected, isConnecting, connect, disconnect } =
    useWallet()
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const truncated = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : ""

  // SSR placeholder - matches server render exactly
  if (!mounted) {
    return (
      <div className="h-9 w-[150px] rounded-md bg-primary/20 animate-pulse" />
    )
  }

  if (!isConnected) {
    return (
      <Button
        onClick={connect}
        disabled={isConnecting}
        size="sm"
        className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Wallet className="h-4 w-4" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-primary/30 text-foreground bg-transparent"
        >
          <div className="h-2 w-2 rounded-full bg-primary" />
          {truncated}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-card text-card-foreground"
      >
        <DropdownMenuItem
          onClick={copyAddress}
          className="gap-2 cursor-pointer"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? "Copied!" : "Copy Address"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={disconnect}
          className="gap-2 cursor-pointer text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
