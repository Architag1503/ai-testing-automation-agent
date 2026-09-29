import { NextResponse } from "next/server";

// Credits may only be granted by a verified payment or a trusted server workflow.
export async function POST() {
  return NextResponse.json({ error: "Direct credit grants are disabled" }, { status: 410 });
}
