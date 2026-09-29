import { db, users } from "@/db";
import { getInstallationAccessToken } from "@/lib/github-app";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { userId, installationId } = await req.json();

    if (!userId || !installationId) {
      return NextResponse.json(
        { error: "userId and installationId are required" },
        { status: 400 }
      );
    }

    const numericUserId = parseInt(userId);

    // Update installationId for user in Neon PostgreSQL DB
    const updatedUser = await db
      .update(users)
      .set({ installationId: String(installationId) })
      .where(eq(users.id, numericUserId))
      .returning();

    // Set cookies in browser session
    const cookieStore = await cookies();
    cookieStore.set("gh_installation_id", String(installationId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });

    try {
      const token = await getInstallationAccessToken(String(installationId));
      cookieStore.set("gh_app_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60,
        path: "/",
      });
    } catch (tokenErr) {
      console.warn("Could not immediately mint gh_app_token in link-installation endpoint:", tokenErr);
    }

    return NextResponse.json({
      success: true,
      message: "GitHub App installation linked successfully to user account",
      user: updatedUser[0],
    });
  } catch (error: any) {
    console.error("Error linking installation to user:", error);
    return NextResponse.json(
      { error: error.message || "Failed to link GitHub App installation" },
      { status: 500 }
    );
  }
}
