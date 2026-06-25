import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {

    const code = req.nextUrl.searchParams.get('code');

    if (!code) {
        return NextResponse.redirect(new URL('/workspace?error=missing_code', req.url));
    }

    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
        console.error("GitHub OAuth env vars missing: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set");
        return NextResponse.redirect(new URL('/workspace?error=missing_github_env', req.url));
    }

    let data: any;
    try {
        const res = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code: code
            })
        })
        data = await res.json();
    } catch (err) {
        console.error("GitHub token exchange fetch failed:", err);
        return NextResponse.redirect(new URL('/workspace?error=token_exchange_network_error', req.url));
    }

    const token = data.access_token

    if (!token) {
        console.error("GitHub token exchange responded without access_token:", data);
        return NextResponse.redirect(new URL('/workspace?error=token_exchange_failed', req.url));
    }

    const response = NextResponse.redirect(new URL('/workspace', req.url));

    response.cookies.set('gh_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
        path: '/'
    })

    return response;

}