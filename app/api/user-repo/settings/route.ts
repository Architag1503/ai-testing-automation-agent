import { db, repositories } from "@/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const { repoId, userId, targetDomain, globalInstruction, testEmail, testPassword, clerkSecretKey } = await req.json();

    const result = await db?.update(repositories).set({
        targetDomain: targetDomain,
        globalInstruction: globalInstruction,
        testEmail: testEmail || null,
        testPassword: testPassword || null,
        clerkSecretKey: clerkSecretKey || null,
    }).where(eq(repositories.repoId, repoId)).returning();

    return NextResponse.json(result);
}
