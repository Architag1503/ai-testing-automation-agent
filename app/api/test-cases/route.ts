import { db, TestCasesTable } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

function sanitizeRoute(route: string): string {
    let r = (route || "").trim();
    if (r.includes("://")) {
        try { r = "/" + r.split("/").slice(3).join("/"); } catch { }
    }
    if (!r.startsWith("/")) r = "/" + r;
    return r;
}

export async function GET(req: NextRequest) {
    const searchParams = new URL(req.url).searchParams;
    const repoId = searchParams.get('repoId');

    if (!repoId) {
        return NextResponse.json({ error: 'repoId is required' }, { status: 400 })
    }

    const result = await db.select().from(TestCasesTable).where(
        eq(TestCasesTable.repoId, repoId)
    )

    return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
    try {
        const body = await req.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
        }

        await db.delete(TestCasesTable).where(inArray(TestCasesTable.id, ids));

        return NextResponse.json({ success: true, deleted: ids.length });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to delete test cases' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { userId, repoId, repoName, repoOwner, branch, title, description, type, priority, targetRoute, expectedResult } = body;

        if (!userId || !repoName || !repoOwner || !title) {
            return NextResponse.json({ error: 'userId, repoName, repoOwner, and title are required' }, { status: 400 });
        }

        const [inserted] = await db
            .insert(TestCasesTable)
            .values({
                userId,
                repoId: String(repoId || ''),
                repoName,
                repoOwner,
                branch: branch || 'main',
                title,
                description: description || '',
                type: type || 'ui',
                priority: priority || 'medium',
                targetRoute: sanitizeRoute(targetRoute || '/'),
                expectedResult: expectedResult || '',
                status: 'generated',
            })
            .returning();

        return NextResponse.json({ success: true, testCase: inserted });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to create test case' }, { status: 500 });
    }
}
