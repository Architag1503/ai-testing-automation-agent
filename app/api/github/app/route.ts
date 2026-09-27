import { NextResponse } from 'next/server';

export async function GET() {
  const appName = process.env.GITHUB_APP_NAME || 'your-github-app-name';
  const callbackUrl = process.env.GITHUB_APP_CALLBACK_URL;

  if (!callbackUrl) {
    return NextResponse.json({ error: 'GITHUB_APP_CALLBACK_URL not configured' }, { status: 500 });
  }

  const params = new URLSearchParams({
    setup_action: 'install',
    redirect_uri: callbackUrl,
  });

  return NextResponse.redirect(`https://github.com/apps/${appName}/installations/new?${params}`);
}