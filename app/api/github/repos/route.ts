import { NextResponse } from "next/server";
import { getAuthenticatedAccount, getAuthenticatedClerkGitHubUsername } from "@/lib/account";
import { findInstallationForUser, getInstallationAccessToken, getInstallationRepos } from "@/lib/github-app";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const account = await getAuthenticatedAccount();
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let installationId = account.installationId;

    // If user has no installationId in DB, attempt to auto-link an existing GitHub App installation
    if (!installationId) {
      const githubUsername = await getAuthenticatedClerkGitHubUsername();
      const detectedId = await findInstallationForUser(githubUsername, account.email);
      if (detectedId) {
        await db.update(users).set({ installationId: detectedId }).where(eq(users.id, account.id));
        installationId = detectedId;
      }
    }

    if (!installationId) {
      return NextResponse.json({ error: "Install the Testrix GitHub App first" }, { status: 401 });
    }

    const token = await getInstallationAccessToken(installationId);
    const repos = await getInstallationRepos(installationId, token);
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
