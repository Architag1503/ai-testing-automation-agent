import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getInstallationAccessToken, getInstallationRepos } from '@/lib/github-app';
import { currentUser } from '@clerk/nextjs/server';
import { db, users } from '@/db';
import { eq } from 'drizzle-orm';

export async function GET() {
  const cookieStore = await cookies();
  let installationId = cookieStore.get('gh_installation_id')?.value;
  let userEmail: string | undefined = undefined;

  try {
    const clerkUser = await currentUser();
    userEmail = clerkUser?.primaryEmailAddress?.emailAddress;

    // Fallback: check DB for logged-in user if cookie is missing/cleared
    if (!installationId && userEmail) {
      const [userRecord] = await db.select().from(users).where(eq(users.email, userEmail));
      if (userRecord?.installationId) {
        installationId = userRecord.installationId;
        cookieStore.set('gh_installation_id', installationId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
          path: '/',
        });
      }
    }

    if (!installationId) {
      return NextResponse.json({ error: 'GitHub App not installed. Please install the GitHub App first.' }, { status: 401 });
    }

    // Always fetch a fresh token for the installation to avoid stale permissions
    let token = "";
    try {
      token = await getInstallationAccessToken(installationId);
    } catch (tokenErr: any) {
      console.warn(`Installation ID ${installationId} is invalid/uninstalled. Clearing stale credentials...`);
      cookieStore.delete('gh_installation_id');
      cookieStore.delete('gh_app_token');
      if (userEmail) {
        await db.update(users).set({ installationId: null }).where(eq(users.email, userEmail));
      }
      return NextResponse.json({ error: 'GitHub App installation is expired or missing. Please reinstall the GitHub App.' }, { status: 401 });
    }

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