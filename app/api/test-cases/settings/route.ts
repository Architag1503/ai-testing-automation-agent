import { db, TestCasesTable } from "@/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function sanitizeRoute(route: string): string {
    let r = (route || "").trim();
    if (r.includes("://")) {
        try { r = "/" + r.split("/").slice(3).join("/"); } catch { }
    }
    if (!r.startsWith("/")) r = "/" + r;
    return r;
}

export async function POST(req: NextRequest) {

    const { title, description, targetRoute, expectedResult, testCaseId } = await req.json();

    const result = await db.update(TestCasesTable).set({
        title,
        description,
        targetRoute: sanitizeRoute(targetRoute),
        expectedResult,
    }).where(eq(TestCasesTable.id, testCaseId)).returning();

    return NextResponse.json(result);

}