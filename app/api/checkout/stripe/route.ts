import { NextResponse } from "next/server";

// Stripe has no configured plan catalog or fulfillment path in this application.
export async function POST() {
  return NextResponse.json({ error: "Stripe checkout is not enabled. Use the configured Razorpay checkout." }, { status: 501 });
}
