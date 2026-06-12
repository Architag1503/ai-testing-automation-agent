import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(req: NextRequest) {
    try {
        const { message, history } = await req.json();

        if (!message || !message.trim()) {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 }
            );
        }

        const systemPrompt = `You are Testy, an expert QA automation support assistant for Testrix — an AI-powered test automation platform.

Testrix allows users to:
- Connect GitHub repositories and auto-generate Playwright test cases using Google Gemini AI.
- Execute test cases in Browserbase cloud browsers with session cookie injection (Clerk auth bypass).
- Run AI-generated Playwright scripts against local servers via tunnels (localtunnel, ngrok, cloudflared).
- View execution logs, session recordings, and test results in a dashboard.
- Configure per-repo target domains and global test instructions.
- Manage credits: 500 per repo upload, 50 per test run, 300 per Voice Agent conversation.
- Upgrade plans: Free Trial (1,000 credits), Pro 3-Month (35,000 credits), Business 6-Month (120,000 credits), Enterprise 1-Year (600,000 credits).

Your role is to help users with:
- Debugging failed test cases and understanding error logs.
- Fixing tunnel connection issues (503, 408, connection refused, timeouts).
- Resolving Playwright selector problems and suggesting resilient locator strategies.
- Configuring repository settings (target domain, global instructions).
- Explaining how credits work and suggesting plan upgrades.
- Guiding users through GitHub OAuth setup and repo syncing.
- Answering any other questions about the Testrix platform.

Be concise, specific, and actionable. When referencing errors, suggest concrete fixes. Use markdown formatting for code snippets and lists.`;

        const conversationHistory = (history || [])
            .map((msg: any) => `${msg.sender === "user" ? "User" : "Testy"}: ${msg.text}`)
            .join("\n");

        const prompt = `${systemPrompt}

${conversationHistory ? `Conversation so far:\n${conversationHistory}\n` : ""}

User: ${message}
Testy:`;

        const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt,
        });

        const answer = response.text || "I'm sorry, I couldn't process that. Please try rephrasing your question.";

        return NextResponse.json({
            success: true,
            answer: answer.trim(),
        });
    } catch (error: any) {
        console.error("Chatbot API error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || "Failed to get response",
            },
            { status: 500 }
        );
    }
}
