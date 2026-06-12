import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { TestCasesTable, repositories } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Browserbase } from "@browserbasehq/sdk";
import { chromium } from "playwright-core";

const bb = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY!,
});

async function postGitHubStatus({
    token,
    owner,
    repo,
    sha,
    state,
    description,
    context,
    targetUrl,
}: {
    token: string;
    owner: string;
    repo: string;
    sha: string;
    state: "pending" | "success" | "failure" | "error";
    description: string;
    context: string;
    targetUrl?: string;
}) {
    await fetch(`https://api.github.com/repos/${owner}/${repo}/statuses/${sha}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "testrix-ci/1.0",
        },
        body: JSON.stringify({
            state,
            description,
            context,
            target_url: targetUrl || "https://app.testrix.ai",
        }),
    }).catch(() => {});
}

async function postPRComment({
    token,
    owner,
    repo,
    prNumber,
    body,
}: {
    token: string;
    owner: string;
    repo: string;
    prNumber: number;
    body: string;
}) {
    if (!prNumber) return;
    await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "testrix-ci/1.0",
        },
        body: JSON.stringify({ body }),
    }).catch(() => {});
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { repoId, repoFullName, branch, commitSha, prNumber, githubToken, runId } = body;

        if (!repoId || !repoFullName || !commitSha || !githubToken) {
            return NextResponse.json({ error: "Missing required fields: repoId, repoFullName, commitSha, githubToken" }, { status: 400 });
        }

        // Verify API key matches a repository
        const authHeader = req.headers.get("authorization") || "";
        const apiKey = authHeader.replace("Bearer ", "").trim();
        if (!apiKey) {
            return NextResponse.json({ error: "Missing Authorization header" }, { status: 401 });
        }

        const repo = await db
            .select()
            .from(repositories)
            .where(and(
                eq(repositories.id, Number(repoId)),
                eq(repositories.clerkSecretKey, apiKey),
            ))
            .limit(1);

        if (!repo || repo.length === 0) {
            return NextResponse.json({ error: "Invalid API key or repository not found" }, { status: 403 });
        }

        const repoRecord = repo[0];
        const [owner, repoName] = repoFullName.split("/");

        // Get all test cases for this repo
        const testCases = await db
            .select()
            .from(TestCasesTable)
            .where(and(
                eq(TestCasesTable.repoId, String(repoId)),
                eq(TestCasesTable.branch, branch || repoRecord.defaultBranch || "main"),
            ));

        if (!testCases || testCases.length === 0) {
            await postGitHubStatus({
                token: githubToken, owner, repo: repoName, sha: commitSha,
                state: "success", description: "No test cases configured",
                context: "testrix/ci",
            });
            return NextResponse.json({ summary: { total: 0, passed: 0, failed: 0, passRate: "0%" }, results: [] });
        }

        const baseUrl = repoRecord.targetDomain || `https://${repoFullName}`;

        // Set initial pending status
        await postGitHubStatus({
            token: githubToken, owner, repo: repoName, sha: commitSha,
            state: "pending", description: `Running ${testCases.length} test cases...`,
            context: "testrix/ci",
            targetUrl: `https://app.testrix.ai/workspace`,
        });

        const results: Array<{ id: number; title: string; status: string; error?: string; sessionUrl?: string }> = [];
        let passed = 0;
        let failed = 0;

        for (let i = 0; i < testCases.length; i++) {
            const tc = testCases[i];
            const testContext = `testrix/${tc.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50)}`;

            await postGitHubStatus({
                token: githubToken, owner, repo: repoName, sha: commitSha,
                state: "pending", description: `[${i + 1}/${testCases.length}] ${tc.title}`,
                context: testContext,
                targetUrl: `https://app.testrix.ai/workspace`,
            });

            let session: any = null;
            let browser: any = null;
            const logs: string[] = [];

            try {
                session = await bb.sessions.create({
                    projectId: process.env.BROWSERBASE_PROJECT_ID!,
                });
                logs.push(`[SYSTEM] Browserbase session: ${session.id}`);

                browser = await chromium.connectOverCDP(session.connectUrl);
                const context = browser.contexts()[0];
                const page = context.pages()[0];

                page.on("console", (msg: any) => {
                    logs.push(`[BROWSER] [${msg.type().toUpperCase()}] ${msg.text()}`);
                });

                const targetRoute = tc.targetRoute || "/";
                const expectedText = tc.expectedResult || "";
                const testEmail = repoRecord.testEmail || "";
                const testPassword = repoRecord.testPassword || "";
                const clerkSk = repoRecord.clerkSecretKey || "";

                const escTpl = (s: string) =>
                    (s || "").replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${").replace(/'/g, "\\'");

                const escapedBaseUrl = escTpl(baseUrl);
                const escapedTargetRoute = escTpl(targetRoute);
                const escapedExpected = escTpl(expectedText);
                const testEmailEsc = escTpl(testEmail);
                const testPasswordEsc = escTpl(testPassword);
                const clerkSkEsc = escTpl(clerkSk);

                const isLocaltunnel = baseUrl.includes(".loca.lt");
                const isNgrok = baseUrl.includes("ngrok-free.app") || baseUrl.includes("ngrok.io");
                if (isLocaltunnel) {
                    await page.setExtraHTTPHeaders({
                        "bypass-tunnel-reminder": "1",
                        "bypass-tunnel-captcha": "1",
                        "user-agent": "Mozilla/5.0 (compatible; Browserbase/1.0; +https://browserbase.com)",
                    });
                } else if (isNgrok) {
                    await page.setExtraHTTPHeaders({
                        "ngrok-skip-browser-warning": "true",
                        "user-agent": "Mozilla/5.0 (compatible; Browserbase/1.0; +https://browserbase.com)",
                    });
                }

                const scriptText = `
async function getPageText() {
  return await page.innerText('body').catch(() => '');
}
async function isOnSignInPage() {
  const text = await getPageText();
  const keywords = ['sign in to', 'welcome back', 'email address', 'password', 'continue with google', 'sign up', 'create account'];
  const matches = keywords.filter(k => text.toLowerCase().includes(k));
  return matches.length >= 2;
}
function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

const expectedText = '${escapedExpected}';
const autoEmail = '${testEmailEsc}';
const autoPassword = '${testPasswordEsc}';
const CLERK_SK = '${clerkSkEsc}';

await page.goto('${escapedBaseUrl}${escapedTargetRoute}', { waitUntil: 'load', timeout: 15000 });
await page.waitForTimeout(2000);
let pageBodyText = await getPageText();

const pageContainsSignIn = pageBodyText.toLowerCase().includes('sign in');
const pageContainsGetStarted = pageBodyText.toLowerCase().includes('get started');
const isPublicLandingPage = pageContainsSignIn && pageContainsGetStarted;
const needsSignIn = await isOnSignInPage() || isPublicLandingPage;

if (needsSignIn) {
  if (!autoEmail || !autoPassword || !CLERK_SK) {
    throw new Error('Auth required but no test credentials configured');
  }

  // Phase 0: Provision user
  const userRes = await fetch('https://api.clerk.com/v1/users?email_address=' + encodeURIComponent(autoEmail), {
    headers: { Authorization: 'Bearer ' + CLERK_SK }
  });
  const userData = await userRes.json();
  const userList = userData.data || userData;
  const clerkUserId = Array.isArray(userList) && userList.length > 0 ? userList[0].id : null;
  if (clerkUserId) {
    await fetch('https://api.clerk.com/v1/users/' + clerkUserId, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + CLERK_SK, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: autoPassword })
    });
  } else {
    const createRes = await fetch('https://api.clerk.com/v1/users', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + CLERK_SK, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_address: [autoEmail], password: autoPassword })
    });
    const created = await createRes.json();
    if (!createRes.ok) throw new Error('Failed to create user: ' + (created.error || created.errors?.[0]?.message || createRes.status));
  }

  // SDK sign-in
  let signInSucceeded = false;
  try {
    const sdkResult = await page.evaluate(async ({ email, password }) => {
      if (!window.Clerk) return { success: false, error: 'No Clerk' };
      await window.Clerk.load();
      const si = await window.Clerk.client.signIn.create({
        strategy: 'password', identifier: email, password
      });
      if (si.status === 'complete' || si.createdSessionId) return { success: true };
      return { success: false, error: 'SDK status: ' + si.status };
    }, { email: autoEmail, password: autoPassword });
    if (sdkResult.success) {
      await page.goto('${escapedBaseUrl}${escapedTargetRoute}', { waitUntil: 'load', timeout: 20000 });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(3000);
      pageBodyText = await getPageText();
      signInSucceeded = !(await isOnSignInPage());
    }
  } catch (e) {}

  // Fallback: Backend API session + cookie
  if (!signInSucceeded) {
    try {
      const sessRes = await fetch('https://api.clerk.com/v1/sessions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + CLERK_SK, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: clerkUserId })
      });
      const sessionData = await sessRes.json();
      const sessionId = sessionData?.id;
      if (sessionId) {
        const tokRes = await fetch('https://api.clerk.com/v1/sessions/' + sessionId + '/tokens', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + CLERK_SK, 'Content-Type': 'application/json' }
        });
        const token = await tokRes.json();
        const jwt = token.jwt || token.object;
        if (jwt) {
          const hostname = new URL(page.url()).hostname;
          await page.context().addCookies([
            { name: '__session', value: jwt, domain: hostname, path: '/' },
            { name: '__client_uat', value: String(Math.floor(Date.now() / 1000)), domain: hostname, path: '/' }
          ]);
          await page.goto('${escapedBaseUrl}${escapedTargetRoute}', { waitUntil: 'load', timeout: 20000 });
          await page.waitForLoadState('networkidle').catch(() => {});
          await page.waitForTimeout(3000);
          pageBodyText = await getPageText();
        }
      }
    } catch (e) {}
  }
}

if (expectedText) {
  pageBodyText = await getPageText();
  assert(pageBodyText.toLowerCase().includes(expectedText.toLowerCase()),
    'Expected: "' + expectedText + '" | Page content: "' + pageBodyText.substring(0, 300) + '"');
}
console.log('Test PASSED.');
`;

                const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
                const runFn = new AsyncFunction("page", "assert", "console", scriptText);
                const assertHelper = (condition: boolean, message?: string) => {
                    if (!condition) throw new Error(message || "Assertion failed");
                };

                await runFn(page, assertHelper, { log: (...args: any[]) => logs.push(args.join(" ")) });

                await page.close().catch(() => {});
                await browser.close().catch(() => {});

                results.push({ id: tc.id, title: tc.title, status: "passed", sessionUrl: `https://www.browserbase.com/sessions/${session.id}` });
                passed++;

                await postGitHubStatus({
                    token: githubToken, owner, repo: repoName, sha: commitSha,
                    state: "success", description: `Passed: ${tc.title}`,
                    context: testContext,
                    targetUrl: `https://www.browserbase.com/sessions/${session.id}`,
                });

                await db.update(TestCasesTable).set({ status: "passed", logs, sessionId: session.id, sessionUrl: `https://www.browserbase.com/sessions/${session.id}` }).where(eq(TestCasesTable.id, tc.id));

            } catch (err: any) {
                results.push({ id: tc.id, title: tc.title, status: "failed", error: err.message, sessionUrl: session ? `https://www.browserbase.com/sessions/${session.id}` : undefined });
                failed++;

                await postGitHubStatus({
                    token: githubToken, owner, repo: repoName, sha: commitSha,
                    state: "failure", description: `Failed: ${err.message?.slice(0, 100)}`,
                    context: testContext,
                    targetUrl: session ? `https://www.browserbase.com/sessions/${session.id}` : undefined,
                });

                await db.update(TestCasesTable).set({ status: "failed", logs, sessionId: session?.id || null, sessionUrl: session ? `https://www.browserbase.com/sessions/${session.id}` : null }).where(eq(TestCasesTable.id, tc.id));

                if (browser) await browser.close().catch(() => {});
            }
        }

        const passRate = testCases.length > 0 ? Math.round((passed / testCases.length) * 100) + "%" : "0%";

        // Post PR comment with summary
        if (prNumber && prNumber > 0) {
            const summaryRows = results.map(r =>
                `| ${r.title} | ${r.status === "passed" ? "✅ Passed" : "❌ Failed"} | ${r.sessionUrl ? `[Recording](${r.sessionUrl})` : "—"} |`
            ).join("\n");

            await postPRComment({
                token: githubToken, owner, repo: repoName, prNumber,
                body: `## Testrix CI Results\n\n| Test | Status | Recording |\n|------|--------|-----------|\n${summaryRows}\n\n**${passed}/${testCases.length} tests passed (${passRate})**\n\n---\n_Run ID: ${runId || "—"}_`,
            });
        }

        // Set final overall status
        const overallState = failed === 0 ? "success" : "failure";
        await postGitHubStatus({
            token: githubToken, owner, repo: repoName, sha: commitSha,
            state: overallState, description: `${passed}/${testCases.length} passed (${passRate})`,
            context: "testrix/ci",
            targetUrl: `https://app.testrix.ai/workspace`,
        });

        return NextResponse.json({
            summary: { total: testCases.length, passed, failed, passRate },
            results,
        });

    } catch (err: any) {
        console.error("CI run error:", err);
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
    }
}
