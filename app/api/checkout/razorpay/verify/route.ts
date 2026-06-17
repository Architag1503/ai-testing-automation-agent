import { NextResponse } from "next/server";
import { db, users, subscriptions } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planName,
      planBadge,
      creditsToGrant,
      billingPeriod,
      priceMonthly,
      priceAnnually,
      simulation,
    } = await req.json();

    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";

    if (!simulation) {
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
        .update(body)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }
    }

    const userResult = await db.select().from(users).where(eq(users.email, userEmail));
    if (userResult.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = userResult[0].id;

    await db
      .update(subscriptions)
      .set({ isActive: 0 })
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.isActive, 1)));

    const newSub = await db
      .insert(subscriptions)
      .values({
        userId,
        planName,
        planBadge,
        creditsToGrant,
        billingPeriod,
        priceMonthly,
        priceAnnually,
        isActive: 1,
        razorpayOrderId: razorpay_order_id || null,
        razorpayPaymentId: razorpay_payment_id || null,
        status: "active",
      })
      .returning();

    const updatedUser = await db
      .update(users)
      .set({ credits: sql`${users.credits} + ${creditsToGrant}` })
      .where(eq(users.email, userEmail))
      .returning();

    const userSubs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    return NextResponse.json({
      success: true,
      subscription: newSub[0],
      user: updatedUser[0],
      subscriptions: userSubs,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
