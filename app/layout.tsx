import React from "react"
import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Toaster } from "sonner"
import "./globals.css"
import { WalletProvider } from "@/lib/wallet-context"
import { Header } from "@/components/header"

const _inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const _jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" })

export const metadata: Metadata = {
  title: "Crypto-Market | P2P Token Marketplace",
  description: "Decentralized P2P token liquidation marketplace. Sell any ERC-20 token at custom INR prices with escrow protection.",
}

export const viewport: Viewport = {
  themeColor: "#0d9668",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <WalletProvider>
          <Header />
          <main className="min-h-[calc(100vh-64px)]">{children}</main>
          <Toaster richColors position="bottom-right" />
        </WalletProvider>
      </body>
    </html>
  )
}
