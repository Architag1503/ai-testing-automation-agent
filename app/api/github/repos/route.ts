import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getInstallationAccessToken, getInstallationRepos } from '@/lib/github-app';
import { currentUser } from '@clerk/nextjs/server';
import { db, users } from '@/db';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const cookieStore = await cookies();
    let installationId = cookieStore.get('gh_installation_id')?.value;

    // Fallback: check DB for logged-in user if cookie is missing/cleared
    if (!installationId) {
      const clerkUser = await currentUser();
      const email = clerkUser?.primaryEmailAddress?.emailAddress;
      if (email) {
        const [userRecord] = await db.select().from(users).where(eq(users.email, email));
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
    }

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