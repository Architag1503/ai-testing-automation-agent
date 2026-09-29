import { NextResponse } from "next/server";
import { getAuthenticatedAccount } from "@/lib/account";
import { getInstallationAccessToken, getInstallationRepos } from "@/lib/github-app";

export async function GET() {
  const account = await getAuthenticatedAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!account.installationId) return NextResponse.json({ error: "Install the Testrix GitHub App first" }, { status: 401 });
  try {
    const token = await getInstallationAccessToken(account.installationId);
    return NextResponse.json(await getInstallationRepos(account.installationId, token));
  } catch (error) {
    console.error("GitHub repository fetch failed", error);
    return NextResponse.json({ error: "Could not load repositories from GitHub" }, { status: 502 });
  }
}
