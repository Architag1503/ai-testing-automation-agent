import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAccount } from "@/lib/account";
import { getInstallationAccessToken } from "@/lib/github-app";

export async function POST(req: NextRequest) {
  const account = await getAuthenticatedAccount();
  if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { repoInput } = await req.json();
    if (typeof repoInput !== "string" || repoInput.length > 300) return NextResponse.json({ error: "Enter owner/repository" }, { status: 400 });
    const clean = repoInput.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/$/, "");
    const match = clean.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
    if (!match) return NextResponse.json({ error: "Enter a valid GitHub repository URL or owner/repository" }, { status: 400 });
    const [, owner, repo] = match;
    const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "ai-test-automation-agent" };
    if (account.installationId) headers.Authorization = `Bearer ${await getInstallationAccessToken(account.installationId)}`;
    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, { headers });
    if (!response.ok) return NextResponse.json({ error: "Repository not found or unavailable to this GitHub installation" }, { status: response.status === 404 ? 404 : 502 });
    const r = await response.json();
    return NextResponse.json({ id: r.id, name: r.name, full_name: r.full_name, private_: r.private,
      html_url: r.html_url, description: r.description || "", language: r.language || "",
      default_branch: r.default_branch || "main", owner: r.owner?.login || owner });
  } catch (error) {
    console.error("Repository import failed", error);
    return NextResponse.json({ error: "Could not import repository" }, { status: 500 });
  }
}
