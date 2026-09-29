import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAccount } from "@/lib/account";

export async function GET(req: NextRequest) {
  const account = await getAuthenticatedAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const appName = process.env.GITHUB_APP_NAME;
  if (!appName) return NextResponse.json({ error: "GitHub App is not configured" }, { status: 503 });
  const state = randomBytes(32).toString("hex");
  const setupUrl = process.env.GITHUB_APP_SETUP_URL || process.env.GITHUB_APP_CALLBACK_URL
    || `${process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin}/api/github/app/callback`;
  let configuredSetupUrl: URL;
  try { configuredSetupUrl = new URL(setupUrl); }
  catch { return NextResponse.json({ error: "GitHub App setup URL is invalid" }, { status: 503 }); }
  const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).origin;
  if (configuredSetupUrl.origin !== appOrigin || configuredSetupUrl.pathname !== "/api/github/app/callback") {
    return NextResponse.json({ error: "Set the GitHub App Setup URL to /api/github/app/callback" }, { status: 503 });
  }
  const destination = new URL(`https://github.com/apps/${encodeURIComponent(appName)}/installations/new`);
  destination.searchParams.set("state", state);
  const response = NextResponse.redirect(destination);
  response.cookies.set("github_install_state", state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/",
  });
  return response;
}
