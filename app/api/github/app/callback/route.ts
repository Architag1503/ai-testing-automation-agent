import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/db";
import { getAuthenticatedAccount } from "@/lib/account";
import { getInstallationDetails } from "@/lib/github-app";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const baseUrl = req.nextUrl.origin;
  const account = await getAuthenticatedAccount();
  if (!account) return NextResponse.redirect(new URL("/sign-in?redirect_url=/workspace", baseUrl));

  const suppliedState = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get("github_install_state")?.value;
  const installationId = req.nextUrl.searchParams.get("installation_id");
  const setupAction = req.nextUrl.searchParams.get("setup_action");
  if (!suppliedState || !expectedState || suppliedState !== expectedState || !installationId || !/^\d+$/.test(installationId) || !["install", "update"].includes(setupAction || "")) {
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
    console.error("GitHub App callback failed", error);
    return NextResponse.redirect(new URL("/workspace?githubError=installation_failed", baseUrl));
  }
}
