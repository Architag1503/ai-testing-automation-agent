import { SignJWT } from 'jose';
import { createPrivateKey } from 'node:crypto';

export function normalizePrivateKey(key: string): string {
  let trimmed = key.trim().replace(/^["'\\]+|["'\\]+$/g, '').trim();
  const pemMatch = trimmed.match(/-----BEGIN[ A-Z0-9_-]+PRIVATE KEY-----[\s\S]*?-----END[ A-Z0-9_-]+PRIVATE KEY-----/);
  if (pemMatch) {
    trimmed = pemMatch[0];
  }
  return trimmed
    .split(/\r?\n|\\n/)
    .map((line) => line.trim().replace(/^["']+|["']+$/g, ''))
    .filter(Boolean)
    .join('\n');
}

export async function generateGitHubAppJWT(): Promise<string> {
  const appId = process.env.GITHUB_APP_ID;
  const rawPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !rawPrivateKey) {
    throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set');
  }

  const privateKey = normalizePrivateKey(rawPrivateKey);

  // Node parses both GitHub's traditional PKCS#1 PEM (RSA PRIVATE KEY)
  // and PKCS#8 PEM (PRIVATE KEY).
  let key: ReturnType<typeof createPrivateKey>;
  try {
    key = createPrivateKey(privateKey);
  } catch (error: any) {
    console.error('Failed to parse GITHUB_APP_PRIVATE_KEY', error);
    throw new Error('GITHUB_APP_PRIVATE_KEY is not a valid PEM private key');
  }
  if (key.asymmetricKeyType !== 'rsa') {
    throw new Error('GITHUB_APP_PRIVATE_KEY must be an RSA private key');
  }

  const now = Math.floor(Date.now() / 1000);
  // Backdate issued-at by 60 seconds to tolerate clock drift between servers and GitHub.
  // Expire in 9 minutes (well within GitHub's strict 10-minute maximum limit).
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 540)
    .setIssuer(appId)
    .sign(key);

  return jwt;
}

export async function getAppInstallations(): Promise<any[]> {
  const jwt = await generateGitHubAppJWT();
  const res = await fetch(`https://api.github.com/app/installations?per_page=100`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'ai-test-automation-agent',
    },
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    console.error(`Failed to fetch app installations: ${res.status} ${errorText}`);
    return [];
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function findInstallationForUser(
  githubUsername?: string | null,
  email?: string | null
): Promise<string | null> {
  try {
    const installations = await getAppInstallations();
    if (!installations.length) return null;

    if (githubUsername) {
      const match = installations.find(
        (i: any) => i.account?.login?.toLowerCase() === githubUsername.trim().toLowerCase()
      );
      if (match) return String(match.id);
    }

    if (email) {
      const prefix = email.split('@')[0]?.trim().toLowerCase();
      if (prefix) {
        const match = installations.find(
          (i: any) => i.account?.login?.toLowerCase() === prefix
        );
        if (match) return String(match.id);
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding installation for user:', error);
    return null;
  }
}

export async function getInstallationAccessToken(installationId: string): Promise<string> {
  const jwt = await generateGitHubAppJWT();

  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'ai-test-automation-agent',
      },
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(`Failed to get installation token: ${error.message || res.statusText}`);
  }

  const data = await res.json();
  return data.token;
}

export async function getInstallationDetails(installationId: string) {
  const jwt = await generateGitHubAppJWT();
  const res = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'ai-test-automation-agent',
    },
  });

  if (!res.ok) {
    throw new Error('Failed to fetch installation details');
  }

  return res.json();
}

export async function getInstallationRepos(installationId: string, token: string) {
  const allRepos = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://api.github.com/installation/repositories?per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'ai-test-automation-agent',
        },
      }
    );

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.error(`Failed to fetch installation repos. Status: ${res.status}, Body: ${errorText}`);
      throw new Error(`Failed to fetch repos: ${res.statusText}`);
    }

    const data = await res.json();
    console.log(`Fetched repos for installation ${installationId}: count=${data.total_count}, selection=${data.repository_selection}`);

    if (!data.repositories?.length) break;

    allRepos.push(...data.repositories);
    page++;
  }

  return allRepos.map((r: any) => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    private_: Boolean(r.private),
    html_url: r.html_url,
    description: r.description || '',
    language: r.language || '',
    default_branch: r.default_branch || 'main',
    owner: r.owner?.login || '',
  }));
}
