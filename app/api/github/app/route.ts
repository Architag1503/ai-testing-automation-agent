import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAccount } from "@/lib/account";
import { generateGitHubAppJWT } from "@/lib/github-app";

export async function GET(req: NextRequest) {
  const account = await getAuthenticatedAccount();
  if (!account) return NextResponse.redirect(new URL("/sign-in?redirect_url=/workspace", req.nextUrl.origin));
  const fail = (reason: string) => {
    const destination = new URL("/workspace", req.nextUrl.origin);
    destination.searchParams.set("githubError", reason);
    return NextResponse.redirect(destination);
  };
  const appName = process.env.GITHUB_APP_NAME;
  if (!appName || !process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY) return fail("not_configured");
  try { await generateGitHubAppJWT(); }
  catch {
    console.error("GitHub App credentials are not valid");
    return fail("credentials_invalid");
  }
  const state = randomBytes(32).toString("hex");
  const setupUrl = process.env.GITHUB_APP_SETUP_URL || process.env.GITHUB_APP_CALLBACK_URL
    || `${process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin}/api/github/app/callback`;
  let configuredSetupUrl: URL;
  try { configuredSetupUrl = new URL(setupUrl); }
  catch { return fail("setup_url_invalid"); }
  let appOrigin: string;
  try { appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).origin; }
  catch { return fail("app_url_invalid"); }
  if (configuredSetupUrl.origin !== appOrigin || configuredSetupUrl.pathname !== "/api/github/app/callback") {
    return fail("setup_url_mismatch");
  }
  const destination = new URL(`https://github.com/apps/${encodeURIComponent(appName)}/installations/new`);
  destination.searchParams.set("state", state);
  const response = NextResponse.redirect(destination);
  response.cookies.set("github_install_state", state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/",
  });
  return response;
}
