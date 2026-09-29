import { createHash, randomBytes } from "crypto";
import { db, repositories } from "@/db";
import { getAuthenticatedAccount } from "@/lib/account";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const account = await getAuthenticatedAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const repoId = Number(body.repoId);
    if (!Number.isSafeInteger(repoId)) return NextResponse.json({ error: "Invalid repoId" }, { status: 400 });
    const ownsRepo = await db.select({ id: repositories.id }).from(repositories)
      .where(and(eq(repositories.repoId, repoId), eq(repositories.userId, account.id))).limit(1);
    if (!ownsRepo.length) return NextResponse.json({ error: "Repository not found" }, { status: 404 });

    const patch: Partial<typeof repositories.$inferInsert> = {};
    if (body.targetDomain !== undefined) {
      const value = String(body.targetDomain).trim();
      if (value) {
        let url: URL;
        try { url = new URL(value); } catch { return NextResponse.json({ error: "Enter a valid application URL" }, { status: 400 }); }
        if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
          return NextResponse.json({ error: "Use an HTTPS application URL" }, { status: 400 });
        }
        patch.targetDomain = url.origin;
      }
    }
    if (body.globalInstruction !== undefined) patch.globalInstruction = String(body.globalInstruction).slice(0, 8000) || null;
    if (body.testEmail) patch.testEmail = String(body.testEmail).slice(0, 320);
    if (body.testPassword) patch.testPassword = String(body.testPassword).slice(0, 1000);
    if (body.clerkSecretKey) patch.clerkSecretKey = String(body.clerkSecretKey).slice(0, 1000);
    if (body.clearTestCredentials === true) { patch.testEmail = null; patch.testPassword = null; }
    if (body.clearClerkSecret === true) patch.clerkSecretKey = null;

    let ciApiKey: string | undefined;
    if (body.generateCiKey === true) {
      ciApiKey = randomBytes(32).toString("hex");
      patch.ciApiKey = createHash("sha256").update(ciApiKey).digest("hex");
    }
    if (Object.keys(patch).length) {
      await db.update(repositories).set(patch)
        .where(and(eq(repositories.repoId, repoId), eq(repositories.userId, account.id)));
    }
    return NextResponse.json({ success: true, ...(ciApiKey ? { ciApiKey } : {}) });
  } catch (error) {
    console.error("Repository settings update failed", error);
    return NextResponse.json({ error: "Could not save repository settings" }, { status: 400 });
  }
}
