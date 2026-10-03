import { NextResponse } from "next/server";
import { getAuthenticatedAccount } from "@/lib/account";
import { getInstallationAccessToken, getInstallationRepos } from "@/lib/github-app";

export async function GET() {
  try {
    const account = await getAuthenticatedAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!account.installationId) return NextResponse.json({ error: "Install the Testrix GitHub App first" }, { status: 401 });

    const token = await getInstallationAccessToken(account.installationId);
    const repos = await getInstallationRepos(account.installationId, token);
    return NextResponse.json(repos);
  } catch (error: any) {
    console.error("GitHub repository fetch failed", error);
    const status = typeof error?.status === "number" ? error.status : 502;
    return NextResponse.json(
      { error: error?.message || "Could not load repositories from GitHub" },
      { status: status >= 400 && status < 600 ? status : 502 }
    );
  }
}
