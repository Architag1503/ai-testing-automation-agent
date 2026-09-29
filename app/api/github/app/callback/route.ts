import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { getInstallationAccessToken, getInstallationDetails } from '@/lib/github-app';
import { db, users } from '@/db';
import { eq } from 'drizzle-orm';
import { currentUser } from '@clerk/nextjs/server';

export async function GET(req: NextRequest) {
  const installationId = req.nextUrl.searchParams.get('installation_id');

  if (!installationId) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    return NextResponse.redirect(`${baseUrl}/workspace?error=invalid_callback`);
  }

  try {
    const installation = await getInstallationDetails(installationId);

    if (!installation) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
      return NextResponse.redirect(`${baseUrl}/workspace?error=installation_not_found`);
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
      maxAge: 60 * 60,
      path: '/',
    });

    // Permanently link installationId to user record in DB
    try {
      const clerkUser = await currentUser();
      const email = clerkUser?.primaryEmailAddress?.emailAddress;
      if (email) {
        await db.update(users)
          .set({ installationId })
          .where(eq(users.email, email));
      }
    } catch (dbErr) {
      console.error('Error linking installationId to user in DB:', dbErr);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    return NextResponse.redirect(`${baseUrl}/workspace?installation_id=${installationId}`);
  } catch (error: any) {
    console.error('GitHub App callback error:', error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    return NextResponse.redirect(`${baseUrl}/workspace?error=${encodeURIComponent(error.message)}`);
  }
}