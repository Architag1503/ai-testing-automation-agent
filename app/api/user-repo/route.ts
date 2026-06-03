import { db, repositories } from "@/db";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {

    const { repoId, userId, name, full_name, private_, html_url, description, language, default_branch, owner } = await req.json();

    const result = await db.insert(repositories).values({
        repoId,
        userId,
        name,
        full_name,
        private: private_ ? 1 : 0,
        html_url,
        description,
        language,
        defaultBranch: default_branch,
        owner
    }).returning();

    return NextResponse.json(result[0]);

}

export async function GET(req: NextRequest) {

    const { searchParams } = new URL(req.url);

    const userId = searchParams.get("userId");

    //@ts-ignore
    const result = await db.select().from(repositories).where(eq(repositories.userId, userId))

    return NextResponse.json(result);
}