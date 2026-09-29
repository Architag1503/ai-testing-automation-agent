import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAccount } from "@/lib/account";
import { getGitHubRepository, GitHubRepositoryError, parseGitHubRepositoryInput } from "@/lib/github-repository";

export async function POST(req: NextRequest) {
  try {
    const account = await getAuthenticatedAccount();
    if (!account) return NextResponse.json({ error: "Sign in before importing a repository" }, { status: 401 });
    const body = await req.json();
    if (typeof body.repoInput !== "string") return NextResponse.json({ error: "Enter owner/repository" }, { status: 400 });
    const parsed = parseGitHubRepositoryInput(body.repoInput);
    if (!parsed) return NextResponse.json({ error: "Enter a valid GitHub repository URL, SSH URL, or owner/repository" }, { status: 400 });
    const repository = await getGitHubRepository(parsed.owner, parsed.repo, account.installationId);
    return NextResponse.json(repository);
  } catch (error) {
    if (error instanceof GitHubRepositoryError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Repository import failed", error);
    return NextResponse.json({ error: "Could not import repository. Check the production database migration and server configuration." }, { status: 500 });
  }
}
