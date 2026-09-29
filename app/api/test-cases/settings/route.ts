import { db, TestCasesTable, repositories } from "@/db";
import { getAuthenticatedAccount } from "@/lib/account";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const account = await getAuthenticatedAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { title, description, targetRoute, expectedResult, testCaseId } = await req.json();
    const id = Number(testCaseId);
    if (!Number.isSafeInteger(id)) return NextResponse.json({ error: "Invalid testCaseId" }, { status: 400 });
    const [testCase] = await db.select().from(TestCasesTable).where(eq(TestCasesTable.id, id)).limit(1);
    if (!testCase) return NextResponse.json({ error: "Test case not found" }, { status: 404 });
    const [ownedRepo] = await db.select({ id: repositories.id }).from(repositories).where(and(
      eq(repositories.repoId, Number(testCase.repoId)), eq(repositories.userId, account.id),
    )).limit(1);
    if (!ownedRepo) return NextResponse.json({ error: "Test case not found" }, { status: 404 });
    const route = String(targetRoute || "/");
    if (!route.startsWith("/") || route.startsWith("//")) return NextResponse.json({ error: "Target route must be a relative application path" }, { status: 400 });
    const [updated] = await db.update(TestCasesTable).set({
      title: String(title || "").slice(0, 500), description: String(description || "").slice(0, 5000),
      targetRoute: route.slice(0, 500), expectedResult: String(expectedResult || "").slice(0, 5000),
      browserbaseScript: null,
    }).where(eq(TestCasesTable.id, id)).returning();
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Could not update test case" }, { status: 400 });
  }
}
