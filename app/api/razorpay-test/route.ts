import { NextResponse } from "next/server"

export async function GET() {
  const KEY_ID = process.env.RAZORPAY_KEY_ID
  const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

  console.log("[v0] Razorpay test endpoint called")
  console.log("[v0] KEY_ID present:", !!KEY_ID)
  console.log("[v0] KEY_SECRET present:", !!KEY_SECRET)

  if (!KEY_ID || !KEY_SECRET) {
    return NextResponse.json(
      {
        error: "Missing credentials",
        hasKeyId: !!KEY_ID,
        hasSecret: !!KEY_SECRET,
      },
      { status: 400 }
    )
  }

  // Test the auth header
  const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")
  const decodedAuth = Buffer.from(auth, "base64").toString("utf-8")

  // Make a test request to Razorpay API (get API key details)
  const testRes = await fetch("https://api.razorpay.com/v1/keys", {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
    },
  })

  const testData = await testRes.text()

  return NextResponse.json({
    statusCode: testRes.status,
    statusOk: testRes.ok,
    auth: auth.slice(0, 15) + "...",
    decodedAuth: decodedAuth.slice(0, 30) + "...",
    response: testData.slice(0, 200),
    keyIdFormat: KEY_ID.slice(0, 10),
  })
}
