import { timingSafeEqual, createHmac } from "crypto";
import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, users, subscriptions } from "@/db";
import { getAuthenticatedAccount } from "@/lib/account";
import { getPlan } from "@/lib/plans";
import { createRazorpayClient } from "@/lib/razorpay";

export async function POST(req: Request) {
  const account = await getAuthenticatedAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_ID === "rzp_test_xxxxxxxxxxxx") {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  }
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = await req.json();
    if (typeof orderId !== "string" || typeof paymentId !== "string" || typeof signature !== "string") {
      return NextResponse.json({ error: "Missing payment verification fields" }, { status: 400 });
    }
    const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest();
    let supplied: Buffer;
    try { supplied = Buffer.from(signature, "hex"); } catch { supplied = Buffer.alloc(0); }
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    const [previous] = await db.select().from(subscriptions).where(eq(subscriptions.razorpayPaymentId, paymentId)).limit(1);
    if (previous) {
      if (previous.userId !== account.id) return NextResponse.json({ error: "Payment belongs to another account" }, { status: 403 });
      const userSubs = await db.select().from(subscriptions).where(eq(subscriptions.userId, account.id)).orderBy(desc(subscriptions.createdAt));
      return NextResponse.json({ success: true, duplicate: true, user: account, subscriptions: userSubs });
    }

    const razorpay = createRazorpayClient();
    const [order, payment] = await Promise.all([razorpay.orders.fetch(orderId), razorpay.payments.fetch(paymentId)]);
    const notes = order.notes || {};
    const plan = typeof notes.planName === "string" ? getPlan(notes.planName) : null;
    const period = notes.billingPeriod;
    if (!plan || notes.accountId !== String(account.id) || payment.order_id !== orderId || order.status !== "paid" || payment.status !== "captured") {
      return NextResponse.json({ error: "Payment does not match a completed order for this account" }, { status: 400 });
    }
    const termMonths = period === "annually" ? 12 : period === "monthly" ? plan.billingMonths : 0;
    const unitPrice = period === "annually" ? plan.priceAnnually : plan.priceMonthly;
    const expectedAmount = unitPrice * termMonths * 100;
    const credits = plan.credits * termMonths;
    if (!termMonths || Number(order.amount) !== expectedAmount || Number(payment.amount) !== expectedAmount || order.currency !== "INR" || payment.currency !== "INR" || Number(notes.totalCredits) !== credits) {
      return NextResponse.json({ error: "Order amount or plan details do not match" }, { status: 400 });
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + termMonths);
    const [newSub] = await db.insert(subscriptions).values({
      userId: account.id, planName: String(notes.planName), planBadge: plan.badge,
      creditsToGrant: credits, billingPeriod: String(period),
      priceMonthly: plan.priceMonthly, priceAnnually: plan.priceAnnually,
      isActive: 1, razorpayOrderId: orderId, razorpayPaymentId: paymentId,
      status: "active", createdAt: now, expiresAt,
    }).onConflictDoNothing({ target: subscriptions.razorpayPaymentId }).returning();
    if (!newSub) {
      const userSubs = await db.select().from(subscriptions).where(eq(subscriptions.userId, account.id));
      return NextResponse.json({ success: true, duplicate: true, user: account, subscriptions: userSubs });
    }
    await db.update(subscriptions).set({ isActive: 0 }).where(and(
      eq(subscriptions.userId, account.id), eq(subscriptions.isActive, 1), sql`${subscriptions.id} <> ${newSub.id}`,
    ));
    const [updatedUser] = await db.update(users).set({ credits: sql`${users.credits} + ${credits}` })
      .where(eq(users.id, account.id)).returning();
    const userSubs = await db.select().from(subscriptions).where(eq(subscriptions.userId, account.id)).orderBy(desc(subscriptions.createdAt));
    return NextResponse.json({ success: true, subscription: newSub, user: updatedUser, subscriptions: userSubs });
  } catch (error: any) {
    console.error("Razorpay verification failed", error);
    return NextResponse.json({ error: "Could not verify payment" }, { status: 502 });
  }
}
