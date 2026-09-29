import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getInstallationAccessToken, getInstallationRepos } from '@/lib/github-app';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const installationId = cookieStore.get('gh_installation_id')?.value;

    if (!installationId) {
      return NextResponse.json({ error: 'No GitHub App installation found' }, { status: 401 });
    }

    // Always fetch a fresh token for the installation to avoid stale permissions
    const token = await getInstallationAccessToken(installationId);

    cookieStore.set('gh_app_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60,
      path: '/',
    });

    const repos = await getInstallationRepos(installationId, token);

    return NextResponse.json(repos);
  } catch (error: any) {
    console.error("Error fetching repositories:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch GitHub repositories" },
      { status: 500 }
    );
  }
}