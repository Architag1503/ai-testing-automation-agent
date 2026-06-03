import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {

    const cookieStore = await cookies();
    const token = cookieStore.get('gh_token')?.value

    return NextResponse.json({ token: token });
}