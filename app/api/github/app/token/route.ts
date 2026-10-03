import { NextResponse } from "next/server";
import { getAuthenticatedAccount } from "@/lib/account";
import { getInstallationAccessToken } from "@/lib/github-app";

export async function GET() {
  try {
    const account = await getAuthenticatedAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!account.installationId) return NextResponse.json({ error: "GitHub App not installed" }, { status: 404 });
    // Mint credentials only for server-to-server use. Never return the installation token.
    await getInstallationAccessToken(account.installationId);
    return NextResponse.json({ connected: true });
  } catch {
    return NextResponse.json({ error: "GitHub installation is unavailable; reconnect the app" }, { status: 401 });
  }
}
