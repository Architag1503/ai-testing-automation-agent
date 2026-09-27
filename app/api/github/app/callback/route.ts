import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getInstallationAccessToken, getUserInstallations, generateGitHubAppJWT } from '@/lib/github-app';
import { db, repositories } from '@/db';
import { eq, and } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const installationId = req.nextUrl.searchParams.get('installation_id');
  const setupAction = req.nextUrl.searchParams.get('setup_action');

  if (!installationId || setupAction !== 'install') {
    return NextResponse.redirect(new URL('/workspace?error=invalid_callback', req.url));
  }

  try {
    const jwt = await generateGitHubAppJWT();
    const installations = await getUserInstallations(jwt);
    
    const installation = installations.installations?.find(
      (inst: any) => inst.id.toString() === installationId
    );

    if (!installation) {
      return NextResponse.redirect(new URL('/workspace?error=installation_not_found', req.url));
    }

    const token = await getInstallationAccessToken(installationId);

    const cookieStore = await cookies();
    cookieStore.set('gh_installation_id', installationId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    cookieStore.set('gh_app_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60, // 1 hour - tokens expire in 1 hour
      path: '/',
    });

    return NextResponse.redirect(new URL('/workspace', req.url));
  } catch (error: any) {
    console.error('GitHub App callback error:', error);
    return NextResponse.redirect(new URL(`/workspace?error=${encodeURIComponent(error.message)}`, req.url));
  }
}