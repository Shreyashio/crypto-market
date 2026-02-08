import { NextResponse } from "next/server"
import { getTransactionsByAddress } from "@/lib/store"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get("address")

  if (!address) {
    return NextResponse.json({ error: "Address required" }, { status: 400 })
  }

  const transactions = getTransactionsByAddress(address)
  return NextResponse.json(transactions)
}
