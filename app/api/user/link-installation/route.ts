import { NextResponse } from "next/server";

// Installations are associated only by the state-checked GitHub callback.
export async function POST() {
  return NextResponse.json({ error: "Use the authenticated GitHub App installation flow" }, { status: 410 });
}
