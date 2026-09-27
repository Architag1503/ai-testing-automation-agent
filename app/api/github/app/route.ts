import { NextResponse } from 'next/server';

export async function GET() {
  const appName = process.env.GITHUB_APP_NAME || 'your-github-app-name';
  
  // Priority: GITHUB_APP_CALLBACK_URL > constructed from NEXT_PUBLIC_APP_URL > GITHUB_REDIRECT_URI (with fixed path)
  const callbackUrl = process.env.GITHUB_APP_CALLBACK_URL 
    || (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/github/app/callback` : null)
    || (process.env.GITHUB_REDIRECT_URI ? process.env.GITHUB_REDIRECT_URI.replace('/api/github/callback', '/api/github/app/callback') : null);

  if (!callbackUrl) {
    return NextResponse.json({ error: 'GitHub App callback URL not configured' }, { status: 500 });
  }

  const params = new URLSearchParams({
    setup_action: 'install',
    redirect_uri: callbackUrl,
  });

  return NextResponse.redirect(`https://github.com/apps/${appName}/installations/new?${params}`);
}