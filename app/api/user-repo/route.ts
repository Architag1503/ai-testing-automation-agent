import { db, repositories } from "@/db";
import { getAuthenticatedAccount } from "@/lib/account";
import { hasRepositoryCapacity } from "@/lib/account-usage";
import { and, eq } from "drizzle-orm";
import { getInstallationAccessToken } from "@/lib/github-app";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const account = await getAuthenticatedAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.select({
    id: repositories.id, repoId: repositories.repoId, name: repositories.name,
    full_name: repositories.full_name, private: repositories.private,
    html_url: repositories.html_url, description: repositories.description,
    owner: repositories.owner, language: repositories.language,
    defaultBranch: repositories.defaultBranch, targetDomain: repositories.targetDomain,
    globalInstruction: repositories.globalInstruction,
    configuredTestCredentials: repositories.testEmail,
    configuredClerkAuth: repositories.clerkSecretKey,
    configuredCiKey: repositories.ciApiKey,
  }).from(repositories).where(eq(repositories.userId, account.id));
  return NextResponse.json(rows.map(({ configuredTestCredentials, configuredClerkAuth, configuredCiKey, ...repo }) => ({
    ...repo,
    hasTestCredentials: Boolean(configuredTestCredentials),
    hasClerkAuth: Boolean(configuredClerkAuth),
    hasCiKey: Boolean(configuredCiKey),
  })));
}

export async function POST(req: NextRequest) {
  const account = await getAuthenticatedAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const repoId = Number(body.repoId);
    const fullName = String(body.full_name || "");
    if (!Number.isSafeInteger(repoId) || repoId <= 0 || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)) {
      return NextResponse.json({ error: "Invalid repository details" }, { status: 400 });
    }
    const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "ai-test-automation-agent" };
    if (account.installationId) headers.Authorization = `Bearer ${await getInstallationAccessToken(account.installationId)}`;
    const githubResponse = await fetch(`https://api.github.com/repos/${fullName.split("/").map(encodeURIComponent).join("/")}`, { headers });
    if (!githubResponse.ok) return NextResponse.json({ error: "This repository is not available to your GitHub App installation" }, { status: 403 });
    const githubRepo = await githubResponse.json();
    if (Number(githubRepo.id) !== repoId || githubRepo.full_name.toLowerCase() !== fullName.toLowerCase()) {
      return NextResponse.json({ error: "Repository details do not match GitHub" }, { status: 400 });
    }
    const existing = await db.select({ id: repositories.id }).from(repositories)
      .where(and(eq(repositories.userId, account.id), eq(repositories.repoId, repoId))).limit(1);
    if (existing.length) return NextResponse.json({ success: true, alreadyAdded: true });
    const capacity = await hasRepositoryCapacity(account);
    if (!capacity.ok) return NextResponse.json({ error: `Your ${capacity.plan.name} plan allows ${capacity.plan.repositories} repositories` }, { status: 403 });
    const [saved] = await db.insert(repositories).values({
      repoId, userId: account.id, name: githubRepo.name, full_name: githubRepo.full_name, owner: githubRepo.owner.login,
      private: githubRepo.private ? 1 : 0, html_url: githubRepo.html_url,
      description: githubRepo.description || null, language: githubRepo.language || null,
      defaultBranch: githubRepo.default_branch || "main",
    }).returning({ id: repositories.id, repoId: repositories.repoId, full_name: repositories.full_name });
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error("Repository save failed", error);
    return NextResponse.json({ error: "Could not save repository" }, { status: 500 });
  }
}
