import { NextResponse } from "next/server"
import { getListingById, updateListingStatus } from "@/lib/store"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const listing = getListingById(id)
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }
  return NextResponse.json(listing)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json()
  const listing = updateListingStatus(id, body.status, body.buyerAddress)
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }
  return NextResponse.json(listing)
}
