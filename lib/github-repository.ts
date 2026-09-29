import { getInstallationAccessToken } from "@/lib/github-app";

export type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  private_: boolean;
  html_url: string;
  description: string;
  language: string;
  default_branch: string;
  owner: string;
};

export class GitHubRepositoryError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "GitHubRepositoryError";
  }
}

export function parseGitHubRepositoryInput(input: string): { owner: string; repo: string } | null {
  let value = input.trim();
  if (!value || value.length > 300) return null;

  // Accept the common SSH clone form as well as owner/repo and browser URLs.
  value = value.replace(/^git@github\.com:/i, "");
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (!['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())) return null;
      value = url.pathname.replace(/^\/+|\/+$/g, "");
    } catch {
      return null;
    }
  } else if (/^(?:www\.)?github\.com\//i.test(value)) {
    value = value.replace(/^(?:www\.)?github\.com\//i, "");
  } else {
    value = value.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, "");
  }

  value = value.split(/[?#]/, 1)[0].replace(/^\/+|\/+$/g, "");
  const segments = value.split("/").filter(Boolean);
  if (segments.length > 2 && ["tree", "blob", "issues", "pull", "actions", "settings"].includes(segments[2].toLowerCase())) {
    value = segments.slice(0, 2).join("/");
  }
  value = value.replace(/\.git$/i, "");
  const match = value.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!match || match[1] === "." || match[1] === ".." || match[2] === "." || match[2] === "..") return null;
  return { owner: match[1], repo: match[2] };
}

function toRepository(data: any): GitHubRepository {
  return {
    id: Number(data.id),
    name: data.name,
    full_name: data.full_name,
    private_: Boolean(data.private),
    html_url: data.html_url,
    description: data.description || "",
    language: data.language || "",
    default_branch: data.default_branch || "main",
    owner: data.owner?.login || "",
  };
}

async function fetchRepository(owner: string, repo: string, token?: string) {
  return fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "ai-test-automation-agent",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });
}

/** Fetch public repositories without requiring a GitHub App; use the user's
 * installation only when anonymous access cannot see the repository. */
export async function getGitHubRepository(owner: string, repo: string, installationId?: string | null) {
  const publicResponse = await fetchRepository(owner, repo);
  if (publicResponse.ok) return toRepository(await publicResponse.json());

  if (installationId && [401, 403, 404].includes(publicResponse.status)) {
    let token: string;
    try {
      token = await getInstallationAccessToken(installationId);
    } catch (error) {
      console.error("Could not create GitHub installation token", error);
      throw new GitHubRepositoryError(
        "The GitHub App connection needs to be reinstalled or its private key configuration fixed",
        502,
      );
    }

    const installedResponse = await fetchRepository(owner, repo, token);
    if (installedResponse.ok) return toRepository(await installedResponse.json());
    if (installedResponse.status === 404) {
      throw new GitHubRepositoryError("Repository not found or not selected in your GitHub App installation", 404);
    }
    throw new GitHubRepositoryError("GitHub could not provide access to this repository", 502);
  }

  if (publicResponse.status === 404) {
    throw new GitHubRepositoryError("Repository not found or private; connect the GitHub App to access private repositories", 404);
  }
  if (publicResponse.status === 403) {
    throw new GitHubRepositoryError("GitHub API rate limit reached; connect the GitHub App and try again", 429);
  }
  throw new GitHubRepositoryError("GitHub could not load this repository", 502);
}
