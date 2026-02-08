"use client"

import type { ReactNode } from "react"
import { WalletProvider } from "@/lib/wallet-context"
import { Header } from "@/components/header"
import { Toaster } from "sonner"

export function ClientShell({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <Header />
      <main className="min-h-[calc(100vh-64px)]">{children}</main>
      <Toaster richColors position="bottom-right" />
    </WalletProvider>
  )
}
