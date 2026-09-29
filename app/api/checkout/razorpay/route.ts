import { NextResponse } from "next/server";
import { createRazorpayClient } from "@/lib/razorpay";
import { getAuthenticatedAccount } from "@/lib/account";
import { getPlan } from "@/lib/plans";

export async function POST(req: Request) {
  const account = await getAuthenticatedAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_ID === "rzp_test_xxxxxxxxxxxx") {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  }
  try {
    const { planName, billingPeriod } = await req.json();
    const plan = typeof planName === "string" ? getPlan(planName) : null;
    if (!plan || planName === "Free Trial" || !["monthly", "annually"].includes(billingPeriod)) {
      return NextResponse.json({ error: "Invalid paid plan or billing period" }, { status: 400 });
    }
    const termMonths = billingPeriod === "annually" ? 12 : plan.billingMonths;
    const unitPrice = billingPeriod === "annually" ? plan.priceAnnually : plan.priceMonthly;
    const amount = unitPrice * termMonths * 100;
    const totalCredits = plan.credits * termMonths;
    const razorpay = createRazorpayClient();
    const order = await razorpay.orders.create({
      amount, currency: "INR", receipt: `tx_${Date.now()}_${account.id}`.slice(0, 40),
      notes: { accountId: String(account.id), planName, billingPeriod, termMonths: String(termMonths), totalCredits: String(totalCredits) },
    });
    return NextResponse.json({ order: { id: order.id, amount: order.amount, currency: order.currency }, planName, billingPeriod });
  } catch (error: any) {
    console.error("Razorpay order creation failed", error);
    return NextResponse.json({ error: "Could not create payment order" }, { status: 502 });
  }
}
