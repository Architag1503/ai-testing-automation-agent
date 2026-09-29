import { NextResponse } from "next/server";
import { getAuthenticatedAccount } from "@/lib/account";

export async function GET() {
  try {
    const user = await getAuthenticatedAccount();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const trialActive = user.createdAt.getTime() + 10 * 24 * 60 * 60 * 1000 > Date.now();
    return NextResponse.json({ user: { ...user, trialActive } });
  } catch {
    return NextResponse.json({ error: "Could not load account" }, { status: 500 });
  }
}

export const POST = GET;
