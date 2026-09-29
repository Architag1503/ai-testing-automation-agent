import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAccount } from "@/lib/account";
import { getOwnedTestCase, runBrowserTest } from "@/lib/browser-test";

export async function POST(req: NextRequest) {
  const account = await getAuthenticatedAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const testCaseId = Number(body.testCaseId);
    if (!Number.isSafeInteger(testCaseId) || typeof body.baseUrl !== "string") {
      return NextResponse.json({ error: "testCaseId and baseUrl are required" }, { status: 400 });
    }
    if (typeof body.customPrompt === "string" && body.customPrompt.length > 1500) {
      return NextResponse.json({ error: "Custom instructions must be under 1,500 characters" }, { status: 400 });
    }
    const owned = await getOwnedTestCase(account, testCaseId);
    if (!owned) return NextResponse.json({ error: "Test case not found" }, { status: 404 });
    const result = await runBrowserTest({
      account, testCase: owned.testCase, repo: owned.repo, baseUrl: body.baseUrl,
      mode: body.mode === "generate" ? "generate" : "cache", customPrompt: String(body.customPrompt || ""),
    });
    return NextResponse.json(result);
  } catch (error: any) {
    const message = String(error?.message || "Test execution failed");
    const status = /not enough credits/i.test(message) ? 402
      : /monthly .*limit reached/i.test(message) ? 403
      : /configured application URL|must match|HTTPS|private and local/i.test(message) ? 400
      : 500;
    console.error("Browser test request failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}
