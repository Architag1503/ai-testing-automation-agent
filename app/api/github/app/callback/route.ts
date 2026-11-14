import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/db";
import { getAuthenticatedAccount } from "@/lib/account";
import { getInstallationDetails } from "@/lib/github-app";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const baseUrl = req.nextUrl.origin;
  let account;
  try {
    account = await getAuthenticatedAccount();
  } catch (error) {
    console.error("Account resolution failed during GitHub App callback", error);
    return NextResponse.redirect(new URL("/sign-in?redirect_url=/workspace", baseUrl));
  }
  if (!account) return NextResponse.redirect(new URL("/sign-in?redirect_url=/workspace", baseUrl));

  const suppliedState = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("github_install_state")?.value;
  let installationId = req.nextUrl.searchParams.get("installation_id");
  const code = req.nextUrl.searchParams.get("code");

  // If state was provided both in query and cookie, ensure they match to prevent CSRF.
  if (suppliedState && expectedState && suppliedState !== expectedState) {
    console.warn("Mismatched state on GitHub callback");
    return NextResponse.redirect(new URL("/workspace?githubError=invalid_callback", baseUrl));
  }

  // If installation_id was not in the query but OAuth code was returned, exchange code to get the user's installation
  if (!installationId && code && process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    try {
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        const userInstRes = await fetch("https://api.github.com/user/installations", {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "ai-test-automation-agent",
          },
        });
        const userInstData = await userInstRes.json();
        const userInst = userInstData.installations?.[0];
        if (userInst?.id) {
          installationId = String(userInst.id);
        }
      }
    } catch (codeErr) {
      console.warn("Failed to exchange OAuth code for user installation:", codeErr);
    }
  }

  if (!installationId || !/^\d+$/.test(installationId)) {
    return NextResponse.redirect(new URL("/workspace?githubError=invalid_callback", baseUrl));
  }

  try {
    await getInstallationDetails(installationId);
    await db.update(users).set({ installationId }).where(eq(users.id, account.id));
    const response = NextResponse.redirect(new URL("/workspace?github=connected", baseUrl));
    response.cookies.delete("github_install_state");
    response.cookies.delete("gh_installation_id");
    response.cookies.delete("gh_app_token");
    return response;
  } catch (error) {
    console.error("GitHub App callback verification failed", error);
    return NextResponse.redirect(new URL("/workspace?githubError=installation_failed", baseUrl));
  }
}
