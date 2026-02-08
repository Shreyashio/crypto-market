// In-memory store for demo purposes
// In production, this would be backed by PostgreSQL via Prisma
import type { Listing, Transaction, Payout } from "./types"

const listings: Listing[] = [
  {
    id: "1",
    tokenAddress: "0x0000000000000000000000000000000000000001",
    tokenSymbol: "USDT",
    tokenName: "Tether USD",
    tokenDecimals: 6,
    tokenAmount: "500",
    sellerAddress: "0xAb5801a7D398351b8bE11C439e05C5b3259aeC9B",
    askingPriceINR: 38000,
    marketPriceINR: 42000,
    discountPercent: 9.5,
    status: "OPEN",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "2",
    tokenAddress: "0x0000000000000000000000000000000000000002",
    tokenSymbol: "USDC",
    tokenName: "USD Coin",
    tokenDecimals: 6,
    tokenAmount: "1000",
    sellerAddress: "0x1234567890abcdef1234567890abcdef12345678",
    askingPriceINR: 82000,
    marketPriceINR: 84000,
    discountPercent: 2.4,
    status: "OPEN",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "3",
    tokenAddress: "0x0000000000000000000000000000000000000003",
    tokenSymbol: "WETH",
    tokenName: "Wrapped ETH",
    tokenDecimals: 18,
    tokenAmount: "2.5",
    sellerAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    askingPriceINR: 450000,
    marketPriceINR: 520000,
    discountPercent: 13.5,
    status: "OPEN",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "4",
    tokenAddress: "0x0000000000000000000000000000000000000001",
    tokenSymbol: "USDT",
    tokenName: "Tether USD",
    tokenDecimals: 6,
    tokenAmount: "250",
    sellerAddress: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    askingPriceINR: 19500,
    marketPriceINR: 21000,
    discountPercent: 7.1,
    status: "OPEN",
    createdAt: new Date(Date.now() - 900000).toISOString(),
    updatedAt: new Date(Date.now() - 900000).toISOString(),
  },
]

const transactions: Transaction[] = []
const payouts: Payout[] = []

// Purchase lock set: prevents duplicate Razorpay orders for the same listing
const purchaseLocks = new Set<string>()

let nextListingId = 5
let nextTxId = 1
let nextPayoutId = 1

export function acquirePurchaseLock(listingId: string): boolean {
  if (purchaseLocks.has(listingId)) return false
  purchaseLocks.add(listingId)
  return true
}

export function releasePurchaseLock(listingId: string) {
  purchaseLocks.delete(listingId)
}

export function getListings(status?: string): Listing[] {
  if (status) return listings.filter((l) => l.status === status)
  return [...listings]
}

export function getListingById(id: string): Listing | undefined {
  return listings.find((l) => l.id === id)
}

export function getListingsBySeller(sellerAddress: string): Listing[] {
  return listings.filter((l) => l.sellerAddress.toLowerCase() === sellerAddress.toLowerCase())
}

export function createListing(data: Omit<Listing, "id" | "createdAt" | "updatedAt" | "status">): Listing {
  const listing: Listing = {
    ...data,
    id: String(nextListingId++),
    status: "OPEN",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  listings.push(listing)
  return listing
}

export function updateListingStatus(id: string, status: Listing["status"], buyerAddress?: string): Listing | null {
  const listing = listings.find((l) => l.id === id)
  if (!listing) return null
  listing.status = status
  listing.updatedAt = new Date().toISOString()
  if (buyerAddress) listing.buyerAddress = buyerAddress
  return listing
}

export function createTransaction(data: Omit<Transaction, "id" | "createdAt">): Transaction {
  const tx: Transaction = {
    ...data,
    id: String(nextTxId++),
    createdAt: new Date().toISOString(),
  }
  transactions.push(tx)
  return tx
}

export function getTransactionsByAddress(address: string): Transaction[] {
  return transactions.filter(
    (t) =>
      t.buyerAddress.toLowerCase() === address.toLowerCase() ||
      t.sellerAddress.toLowerCase() === address.toLowerCase()
  )
}

export function getTransactionByOrderId(orderId: string): Transaction | undefined {
  return transactions.find((t) => t.razorpayOrderId === orderId)
}

export function updateTransactionStatus(
  id: string,
  status: Transaction["status"],
  extra?: { paymentId?: string; escrowTxHash?: string }
): Transaction | null {
  const tx = transactions.find((t) => t.id === id)
  if (!tx) return null
  tx.status = status
  if (extra?.paymentId) tx.razorpayPaymentId = extra.paymentId
  if (extra?.escrowTxHash) tx.escrowTxHash = extra.escrowTxHash
  return tx
}

export function createPayout(data: Omit<Payout, "id" | "createdAt">): Payout {
  const payout: Payout = {
    ...data,
    id: String(nextPayoutId++),
    createdAt: new Date().toISOString(),
  }
  payouts.push(payout)
  return payout
}

export function getPayoutsBySeller(sellerAddress: string): Payout[] {
  return payouts.filter((p) => p.sellerAddress.toLowerCase() === sellerAddress.toLowerCase())
}
