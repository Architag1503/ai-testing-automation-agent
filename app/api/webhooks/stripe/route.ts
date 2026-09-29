import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "Stripe payment fulfillment is not enabled" }, { status: 501 });
}
