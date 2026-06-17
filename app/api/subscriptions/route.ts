import { NextResponse } from "next/server";
import { db, users, subscriptions } from "@/db";
import { eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";

export async function GET() {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
    const userResult = await db.select().from(users).where(eq(users.email, userEmail));

    if (userResult.length === 0) {
      return NextResponse.json({ subscriptions: [] });
    }

    const userSubs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userResult[0].id));

    return NextResponse.json({ subscriptions: userSubs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
