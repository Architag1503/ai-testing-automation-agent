import { SignJWT } from 'jose';
import { createPrivateKey } from 'node:crypto';

export function normalizePrivateKey(key: string): string {
  let trimmed = key.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  return trimmed
    .split(/\r?\n|\\n/)
    .map((line) => line.trim())
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
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + 600)
    .setIssuer(appId)
    .sign(key);

  return jwt;
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
