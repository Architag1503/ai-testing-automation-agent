import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getInstallationAccessToken, getInstallationRepos } from '@/lib/github-app';
import { currentUser } from '@clerk/nextjs/server';
import { db, users } from '@/db';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  let installationId = cookieStore.get('gh_installation_id')?.value;
  let numericUserId: number | undefined = undefined;
  let userEmail: string | undefined = undefined;

  try {
    const userIdParam = req.nextUrl.searchParams.get("userId");
    if (userIdParam && userIdParam !== "undefined" && userIdParam !== "null") {
      numericUserId = parseInt(userIdParam);
    }

    // Attempt DB lookup by userId or email if cookie missing
    if (!installationId) {
      if (numericUserId) {
        const [userRecord] = await db.select().from(users).where(eq(users.id, numericUserId));
        if (userRecord?.installationId) {
          installationId = userRecord.installationId;
        }
      }

      if (!installationId) {
        try {
          const clerkUser = await currentUser();
          userEmail = clerkUser?.primaryEmailAddress?.emailAddress;
          if (userEmail) {
            const [userRecord] = await db.select().from(users).where(eq(users.email, userEmail));
            if (userRecord?.installationId) {
              installationId = userRecord.installationId;
            }
          }
        } catch (e) {
          console.log("Clerk currentUser check omitted or unavailable in GET /api/github/repos");
        }
      }

      if (installationId) {
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
      return NextResponse.json({ error: 'GitHub App not installed. Please connect your GitHub App account.' }, { status: 401 });
    }

    // Always fetch a fresh token for the installation to avoid stale permissions
    let token = "";
    try {
      token = await getInstallationAccessToken(installationId);
    } catch (tokenErr: any) {
      console.warn(`Installation ID ${installationId} is invalid/uninstalled. Clearing stale credentials...`);
      cookieStore.delete('gh_installation_id');
      cookieStore.delete('gh_app_token');
      if (numericUserId) {
        await db.update(users).set({ installationId: null }).where(eq(users.id, numericUserId));
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