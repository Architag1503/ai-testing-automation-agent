import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getInstallationAccessToken } from '@/lib/github-app';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const installationId = cookieStore.get('gh_installation_id')?.value;

    if (!installationId) {
      return NextResponse.json({ error: 'No GitHub App installation found' }, { status: 401 });
    }

    const token = await getInstallationAccessToken(installationId);

    cookieStore.set('gh_app_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60,
      path: '/',
    });

    return NextResponse.json({ token });
  } catch (error: any) {
    console.error('Error getting GitHub App token:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}