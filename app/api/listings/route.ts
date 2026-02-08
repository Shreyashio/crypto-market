import { NextResponse } from "next/server"
import { getListings, createListing } from "@/lib/store"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status") || undefined
  const seller = searchParams.get("seller") || undefined

  let listings = getListings(status)
  if (seller) {
    listings = listings.filter(
      (l) => l.sellerAddress.toLowerCase() === seller.toLowerCase()
    )
  }

  return NextResponse.json(listings)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const listing = createListing(body)
    return NextResponse.json(listing, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
