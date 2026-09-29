import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getInstallationAccessToken } from '@/lib/github-app';
import { currentUser } from '@clerk/nextjs/server';
import { db, users } from '@/db';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const paramId = req.nextUrl.searchParams.get('installation_id');
    let installationId = paramId || cookieStore.get('gh_installation_id')?.value;

    // Fallback: check DB for logged-in user if cookie is missing/cleared
    if (!installationId) {
      const clerkUser = await currentUser();
      const email = clerkUser?.primaryEmailAddress?.emailAddress;
      if (email) {
        const [userRecord] = await db.select().from(users).where(eq(users.email, email));
        if (userRecord?.installationId) {
          installationId = userRecord.installationId;
        }
      }
    }

    if (!installationId) {
      return NextResponse.json({ error: 'No GitHub App installation found' }, { status: 401 });
    }

    // Restore cookie if we have a valid installationId
    cookieStore.set('gh_installation_id', installationId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

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