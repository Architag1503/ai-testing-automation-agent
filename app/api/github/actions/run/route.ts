import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db, repositories, users, TestCasesTable } from "@/db";
import { and, eq } from "drizzle-orm";
import { getAccountPlan } from "@/lib/account-usage";
import { runBrowserTest } from "@/lib/browser-test";

async function githubRequest(url: string, token: string, init?: RequestInit) {
  return fetch(url, { ...init, headers: {
    Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json",
    "Content-Type": "application/json", "User-Agent": "testrix-ci/1.0", ...init?.headers,
  } });
}

export async function POST(req: NextRequest) {
  try {
    const { repoId: rawRepoId, repoFullName, branch, commitSha, prNumber, githubToken, runId } = await req.json();
    const repoId = Number(rawRepoId);
    if (!Number.isSafeInteger(repoId) || typeof repoFullName !== "string" || typeof commitSha !== "string" || typeof githubToken !== "string") {
      return NextResponse.json({ error: "Missing or invalid CI request fields" }, { status: 400 });
    }
    const apiKey = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!apiKey) return NextResponse.json({ error: "Missing Testrix API key" }, { status: 401 });
    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const [repo] = await db.select().from(repositories).where(and(
      eq(repositories.repoId, repoId), eq(repositories.ciApiKey, keyHash),
    )).limit(1);
    if (!repo) return NextResponse.json({ error: "Invalid CI key or repository" }, { status: 403 });
    if (repoFullName.toLowerCase() !== repo.full_name.toLowerCase()) return NextResponse.json({ error: "Repository does not match this CI key" }, { status: 403 });

    const [account] = await db.select().from(users).where(eq(users.id, repo.userId)).limit(1);
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    const plan = await getAccountPlan(account);
    if (!plan.ci) return NextResponse.json({ error: "GitHub Actions requires a paid plan" }, { status: 403 });

    const [owner, name] = repo.full_name.split("/");
    const remoteRepoResponse = await githubRequest(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`, githubToken);
    if (!remoteRepoResponse.ok) return NextResponse.json({ error: "GitHub token cannot access the configured repository" }, { status: 403 });
    const remoteRepo = await remoteRepoResponse.json();
    if (Number(remoteRepo.id) !== repo.repoId) return NextResponse.json({ error: "GitHub token repository does not match" }, { status: 403 });
    if (!/^[a-f0-9]{7,64}$/i.test(commitSha)) return NextResponse.json({ error: "Invalid commit SHA" }, { status: 400 });

    const testCases = await db.select().from(TestCasesTable).where(and(
      eq(TestCasesTable.repoId, String(repo.repoId)), eq(TestCasesTable.branch, repo.defaultBranch || "main"),
    ));
    if (!testCases.length) return NextResponse.json({ summary: { total: 0, passed: 0, failed: 0, passRate: "0%" }, results: [] });

    const statusUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/statuses/${encodeURIComponent(commitSha)}`;
    await githubRequest(statusUrl, githubToken, { method: "POST", body: JSON.stringify({ state: "pending", description: `Running ${testCases.length} Testrix tests`, context: "testrix/ci" }) });
    const results: Array<{ id: number; title: string; status: string; error?: string; sessionUrl?: string }> = [];
    for (const testCase of testCases) {
      try {
        const result = await runBrowserTest({ account, testCase, repo, baseUrl: repo.targetDomain || "", mode: "cache" });
        results.push({ id: testCase.id, title: testCase.title, status: result.status, error: result.status === "failed" ? result.error : undefined, sessionUrl: result.sessionUrl || undefined });
      } catch (error: any) {
        results.push({ id: testCase.id, title: testCase.title, status: "failed", error: String(error?.message || error) });
      }
    }
    const passed = results.filter((item) => item.status === "passed").length;
    const failed = results.length - passed;
    const passRate = `${Math.round((passed / results.length) * 100)}%`;
    const state = failed === 0 ? "success" : "failure";
    await githubRequest(statusUrl, githubToken, { method: "POST", body: JSON.stringify({ state, description: `${passed}/${results.length} passed (${passRate})`, context: "testrix/ci", target_url: results.find((item) => item.sessionUrl)?.sessionUrl }) });

    const pr = Number(prNumber);
    if (Number.isInteger(pr) && pr > 0) {
      const rows = results.map((item) => `| ${item.title.replace(/\|/g, "\\|")} | ${item.status} | ${item.sessionUrl ? `[Recording](${item.sessionUrl})` : "—"} |`).join("\n");
      await githubRequest(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/${pr}/comments`, githubToken, {
        method: "POST", body: JSON.stringify({ body: `## Testrix CI Results\n\n| Test | Status | Recording |\n|---|---|---|\n${rows}\n\n**${passed}/${results.length} passed (${passRate})**\n\nRun ID: ${String(runId || "—").slice(0, 100)}` }),
      });
    }
    return NextResponse.json({ summary: { total: results.length, passed, failed, passRate }, results });
  } catch (error: any) {
    console.error("CI run failed", error);
    return NextResponse.json({ error: error.message || "CI run failed" }, { status: 500 });
  }
}
