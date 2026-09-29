import { NextResponse } from "next/server";
import { db, users, subscriptions } from "@/db";
import { eq, and } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  try {
    const { subscriptionId } = await req.json();

    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    const userResult = await db.select().from(users).where(eq(users.email, userEmail));

    if (userResult.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = userResult[0].id;

    const [candidate] = await db.select().from(subscriptions).where(and(
      eq(subscriptions.id, Number(subscriptionId)),
      eq(subscriptions.userId, userId),
      eq(subscriptions.status, "active"),
    )).limit(1);
    if (!candidate || (candidate.expiresAt && candidate.expiresAt <= new Date())) {
      return NextResponse.json({ error: "Subscription is not active or has expired" }, { status: 404 });
    }

    await db
      .update(subscriptions)
      .set({ isActive: 0 })
      .where(and(eq(subscriptions.userId, userId), eq(subscriptions.isActive, 1)));

    await db
      .update(subscriptions)
      .set({ isActive: 1 })
      .where(and(eq(subscriptions.id, candidate.id), eq(subscriptions.userId, userId), eq(subscriptions.status, "active")));

    const userSubs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    const now = new Date();
    return NextResponse.json({ success: true, subscriptions: userSubs.map((subscription) => ({
      ...subscription,
      isActive: subscription.expiresAt && subscription.expiresAt <= now ? 0 : subscription.isActive,
    })) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
