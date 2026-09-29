import { db, TestCasesTable, repositories } from "@/db";
import { getAuthenticatedAccount } from "@/lib/account";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const account = await getAuthenticatedAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const repoId = Number(req.nextUrl.searchParams.get("repoId"));
  if (!Number.isSafeInteger(repoId)) return NextResponse.json({ error: "Valid repoId is required" }, { status: 400 });
  const [ownedRepo] = await db.select({ id: repositories.id }).from(repositories)
    .where(and(eq(repositories.repoId, repoId), eq(repositories.userId, account.id))).limit(1);
  if (!ownedRepo) return NextResponse.json({ error: "Repository not found" }, { status: 404 });
  const result = await db.select().from(TestCasesTable).where(eq(TestCasesTable.repoId, String(repoId)));
  return NextResponse.json(result);
}
