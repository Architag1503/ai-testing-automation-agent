import { NextRequest, NextResponse } from "next/server";
import { getInstallationAccessToken } from '@/lib/github-app';
import { cookies } from "next/headers";
import { currentUser } from "@clerk/nextjs/server";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { repoInput } = await req.json();

    if (!repoInput) {
      return NextResponse.json({ error: "Repository name or URL is required" }, { status: 400 });
    }

    // Clean input: e.g. "https://github.com/owner/repo" -> "owner/repo" or "owner/repo"
    let cleanPath = repoInput.trim();
    cleanPath = cleanPath.replace(/^https?:\/\/github\.com\//i, '');
    cleanPath = cleanPath.replace(/\.git$/i, '');
    cleanPath = cleanPath.replace(/\/$/, '');

    const parts = cleanPath.split('/');
    if (parts.length < 2) {
      return NextResponse.json({ error: "Please enter a valid repository format: owner/repository-name (e.g. facebook/react)" }, { status: 400 });
    }

    const owner = parts[0];
    const repo = parts[1];

    const cookieStore = await cookies();
    let installationId = cookieStore.get('gh_installation_id')?.value;
    
    if (!installationId) {
      const clerkUser = await currentUser();
      const email = clerkUser?.primaryEmailAddress?.emailAddress;
      if (email) {
        const [userRecord] = await db.select().from(users).where(eq(users.email, email));
        installationId = userRecord?.installationId || undefined;
      }
    }

    let headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "ai-test-automation-agent",
    };

    if (installationId) {
      try {
        const token = await getInstallationAccessToken(installationId);
        headers["Authorization"] = `Bearer ${token}`;
      } catch (e) {
        console.log("Could not get installation token for direct import, attempting public fetch");
      }
    }

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Repository '${owner}/${repo}' not found on GitHub. Please check the name or install the GitHub App for private repos.` },
        { status: 404 }
      );
    }

    const r = await res.json();

    const formattedRepo = {
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      private_: r.private,
      html_url: r.html_url,
      description: r.description || '',
      language: r.language || 'TypeScript',
      default_branch: r.default_branch || 'main',
      owner: r.owner?.login || owner,
    };

    return NextResponse.json(formattedRepo);
  } catch (error: any) {
    console.error("Error importing repository:", error);
    return NextResponse.json({ error: error.message || "Failed to import repository" }, { status: 500 });
  }
}
