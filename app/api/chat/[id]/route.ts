import { NextRequest, NextResponse } from "next/server";
import { db, chatsTable, chatMessagesTable } from "@/db";
import { eq } from "drizzle-orm";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const chatId = parseInt(id);
        if (!chatId) return NextResponse.json({ error: "Invalid chat ID" }, { status: 400 });

        // Messages cascade delete via FK
        await db.delete(chatsTable).where(eq(chatsTable.id, chatId));
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
