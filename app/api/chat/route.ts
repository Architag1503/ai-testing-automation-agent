import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { db, chatsTable, chatMessagesTable, TestCasesTable, repositories, users } from "@/db";
import { eq, desc, and } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
});

const ALLOWED_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".css", ".html"];
const IMPORTANT_FILES = ["app/", "components/", "lib/", "utils/", "db/", "package.json", "next.config", "middleware", "actions/"];
const IGNORE_PATHS = ["node_modules", ".next", "dist", "build", ".git", "coverage", "public/", ".png", ".jpg", ".jpeg", ".svg", ".webp", ".mp4"];

function isUsefulFile(path: string) {
    const isIgnored = IGNORE_PATHS.some((item) => path.includes(item));
    const isAllowed = ALLOWED_EXTENSIONS.some((ext) => path.endsWith(ext));
    const isImportant = IMPORTANT_FILES.some((item) => path.includes(item));
    return !isIgnored && isAllowed && isImportant;
}

async function getRepoFiles(owner: string, repo: string, branch: string, githubToken: string): Promise<string[]> {
    try {
        const res = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
            {
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                    Accept: "application/vnd.github+json",
                    "User-Agent": "ai-test-automation-agent",
                },
            }
        );
        if (!res.ok) return [];
        const data = await res.json();
        return (data.tree || [])
            .filter((item: any) => item.type === "blob" && isUsefulFile(item.path))
            .slice(0, 30)
            .map((item: any) => item.path);
    } catch { return []; }
}

async function readFileContent(owner: string, repo: string, path: string, branch: string, githubToken: string): Promise<string | null> {
    try {
        const res = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
            {
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                    Accept: "application/vnd.github+json",
                    "User-Agent": "ai-test-automation-agent",
                },
            }
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.content) return null;
        return Buffer.from(data.content, "base64").toString("utf-8").slice(0, 3000);
    } catch { return null; }
}

async function pushToGithub(owner: string, repo: string, path: string, content: string, message: string, branch: string, githubToken: string): Promise<boolean> {
    try {
        // Get current file SHA
        const getRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
            {
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                    Accept: "application/vnd.github+json",
                    "User-Agent": "ai-test-automation-agent",
                },
            }
        );
        const existingData = getRes.ok ? await getRes.json() : null;
        const sha = existingData?.sha;

        const putRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                    "Content-Type": "application/json",
                    "User-Agent": "ai-test-automation-agent",
                },
                body: JSON.stringify({
                    message,
                    content: Buffer.from(content).toString("base64"),
                    sha: sha || undefined,
                    branch,
                }),
            }
        );
        return putRes.ok;
    } catch { return false; }
}

// GET /api/chat?chatId=X — messages for a chat
// GET /api/chat?repoId=X — list chats
export async function GET(req: NextRequest) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        const userId = clerkUser.id;

        const { searchParams } = new URL(req.url);
        const chatId = searchParams.get("chatId");
        const repoId = searchParams.get("repoId");

        if (chatId) {
            const messages = await db
                .select()
                .from(chatMessagesTable)
                .where(eq(chatMessagesTable.chatId, parseInt(chatId)))
                .orderBy(chatMessagesTable.createdAt);
            return NextResponse.json(messages);
        }

        const condition = repoId
            ? and(eq(chatsTable.userId, userId), eq(chatsTable.repoId, repoId))
            : eq(chatsTable.userId, userId);

        const chats = await db
            .select()
            .from(chatsTable)
            .where(condition)
            .orderBy(desc(chatsTable.updatedAt));

        return NextResponse.json(chats);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
// POST /api/chat — send message, get AI response
export async function POST(req: NextRequest) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        const clerkUserId = clerkUser.id;
        const userEmail = clerkUser.primaryEmailAddress?.emailAddress || "";

        // Resolve DB user ID from Clerk email
        const [dbUser] = await db.select().from(users).where(eq(users.email, userEmail));
        const dbUserId = dbUser?.id;

        const { chatId, message, repoId, repoName, repoOwner, branch } = await req.json();
        if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 });

        // Find or create chat
        let activeChatId = chatId;
        if (!activeChatId) {
            const existing = await db
                .select()
                .from(chatsTable)
                .where(and(eq(chatsTable.userId, clerkUserId)))
                .orderBy(desc(chatsTable.updatedAt))
                .limit(1);
            if (existing.length > 0 && !repoId) activeChatId = existing[0].id;
        }

        if (!activeChatId) {
            const [newChat] = await db
                .insert(chatsTable)
                .values({
                    userId: clerkUserId,
                    repoId: repoId ? String(repoId) : null,
                    repoName: repoName || null,
                    repoOwner: repoOwner || null,
                    title: message.slice(0, 80),
                })
                .returning();
            activeChatId = newChat.id;
        }

        // Save user message
        await db.insert(chatMessagesTable).values({ chatId: activeChatId, role: "user", content: message });

        // Get previous messages
        const prevMessages = await db
            .select()
            .from(chatMessagesTable)
            .where(eq(chatMessagesTable.chatId, activeChatId))
            .orderBy(chatMessagesTable.createdAt);

        // Build context from repos + test cases
        let reposContext = "";
        let testCasesContext = "";
        const cookieStore = await cookies();
        const githubToken = cookieStore.get("gh_token")?.value;

        try {
            const allRepos = dbUserId ? await db.select().from(repositories).where(eq(repositories.userId, dbUserId)) : [];
            if (allRepos.length > 0) {
                reposContext = `## Connected Repositories\n`;
                for (const r of allRepos) {
                    reposContext += `- ${r.full_name} (${r.language || "unknown"}, branch: ${r.defaultBranch || "main"})\n`;

                    const testCases = await db
                        .select()
                        .from(TestCasesTable)
                        .where(eq(TestCasesTable.repoId, String(r.repoId)));
                    if (testCases.length > 0) {
                        reposContext += `  Test Cases (${testCases.length}):\n`;
                        testCasesContext += `\n## Test Cases for ${r.full_name}\n`;
                        for (const tc of testCases) {
                            testCasesContext += `- [${tc.status}] ID:${tc.id} "${tc.title}"\n  Route: ${tc.targetRoute}\n  Expected: "${tc.expectedResult}"\n  ${tc.logs && tc.logs.length > 0 ? `  Last Logs: ${tc.logs.slice(-3).join(" | ")}\n` : ""}`;
                        }
                    }

                    // Read source files for the current repo context
                    if (githubToken && r.full_name === `${repoOwner || ""}/${repoName || ""}`) {
                        const owner = repoOwner || r.owner;
                        const name = repoName || r.name;
                        const br = branch || r.defaultBranch || "main";
                        const files = await getRepoFiles(owner, name, br, githubToken);
                        const fileContents: string[] = [];
                        for (const filePath of files.slice(0, 8)) {
                            const content = await readFileContent(owner, name, filePath, br, githubToken);
                            if (content) fileContents.push(`--- ${filePath} ---\n${content}`);
                        }
                        if (fileContents.length > 0) {
                            reposContext += `\n  Key Source Files:\n${fileContents.join("\n\n")}`;
                        }
                    }
                }
            } else {
                reposContext = "No repositories connected to this account yet.";
            }
        } catch (e) {
            reposContext = "Unable to fetch repository data at this time.";
        }

        const conversationText = prevMessages.slice(-20).map(m =>
            `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`
        ).join("\n\n");

        const systemPrompt = `You are an expert AI assistant integrated into Testrix, an AI-powered test automation platform. You can answer ANY question — general knowledge, coding, debugging, or repository-specific.

## Your Capabilities
1. Answer general questions (like ChatGPT, Claude, Gemini)
2. Analyze test case failures and suggest fixes by examining the test cases, their expected results, logs, and actual page content
3. Answer questions about the codebase using the provided source files and repository listing
4. Suggest code improvements and implementations
5. Debug API errors, frontend issues, and test automation problems
6. When asked to make changes, respond with an action block:

To update a test case, end your response with:
[ACTION: update-test-case id=ID title="..." description="..." targetRoute="..." expectedResult="..."]

To delete a test case:
[ACTION: delete-test-case id=ID]

To edit a file on GitHub:
[ACTION: github-edit file="path/to/file" message="commit message" content="full file content"]

The system will ask for user confirmation before executing any action.

## Context
${reposContext || "No repositories connected."}
${testCasesContext}

## Response Guidelines
- For general questions: answer directly and helpfully
- For code questions: reference specific file paths
- For test failures: analyze logs, expected vs actual content, and route issues
- Keep responses clear, concise, and actionable
- When suggesting file edits, provide the FULL new file content`;

        const prompt = `${systemPrompt}

${conversationText ? `\nConversation so far:\n${conversationText}\n` : ""}

User: ${message}
Assistant:`;

        const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt,
            config: { temperature: 0.7 },
        });

        let aiMessage = response.text || "I'm sorry, I couldn't generate a response.";

        // Check for actions in AI response
        const githubEditMatch = aiMessage.match(/\[ACTION:\s*github-edit\s+file="([^"]+)"\s+message="([^"]*)"\s+content="([\s\S]*?)"\]/);
        const updateTestCaseMatch = aiMessage.match(/\[ACTION:\s*update-test-case\s+id=(\d+)\s+title="([^"]*)"\s+description="([^"]*)"\s+targetRoute="([^"]*)"\s+expectedResult="([^"]*)"\]/);
        const deleteTestCaseMatch = aiMessage.match(/\[ACTION:\s*delete-test-case\s+id=(\d+)\]/);

        if (githubEditMatch && githubToken) {
            const [, filePath, commitMsg, fileContent] = githubEditMatch;
            const owner = repoOwner || "";
            const repo = repoName || "";
            const br = branch || "main";
            aiMessage += `\n\n> ⚠️ I'd like to edit \`${filePath}\` on GitHub. **Do you want to proceed?** (Reply "yes" to confirm, "no" to cancel)`;
            // Store pending action in a response header or the message — we'll handle confirmation in future messages
        }

        if (updateTestCaseMatch) {
            const [, id, title, description, targetRoute, expectedResult] = updateTestCaseMatch;
            aiMessage = aiMessage.replace(/\[ACTION:.*?\]/, "");
            aiMessage += `\n\n> 📝 **Proposed test case update:** ID:${id} — title: "${title}", route: "${targetRoute}", expected: "${expectedResult}"\n> Reply "**yes**" to apply or "**no**" to cancel.`;
        }

        if (deleteTestCaseMatch) {
            const [, id] = deleteTestCaseMatch;
            aiMessage = aiMessage.replace(/\[ACTION:.*?\]/, "");
            aiMessage += `\n\n> 🗑️ **Proposed deletion:** Test case ID:${id}\n> Reply "**yes**" to delete or "**no**" to cancel.`;
        }

        // Save AI response
        await db.insert(chatMessagesTable).values({ chatId: activeChatId, role: "assistant", content: aiMessage });

        // Update chat timestamp and title if first message
        await db.update(chatsTable).set({ updatedAt: new Date() }).where(eq(chatsTable.id, activeChatId));

        if (prevMessages.length <= 2) {
            await db.update(chatsTable).set({ title: message.slice(0, 80) }).where(eq(chatsTable.id, activeChatId));
        }

        return NextResponse.json({ chatId: activeChatId, message: aiMessage });
    } catch (error: any) {
        console.error("Chat API error:", error);
        return NextResponse.json({ error: error.message || "Failed to process message" }, { status: 500 });
    }
}

// PATCH /api/chat — execute a confirmed action
export async function PATCH(req: NextRequest) {
    try {
        const clerkUser = await currentUser();
        if (!clerkUser) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        const userId = clerkUser.id;

        const { action, chatId, params } = await req.json();
        if (!action || !chatId) return NextResponse.json({ error: "action and chatId required" }, { status: 400 });

        let result = "";

        switch (action) {
            case "update-test-case": {
                const { id, title, description, targetRoute, expectedResult } = params;
                await db.update(TestCasesTable)
                    .set({ title, description, targetRoute, expectedResult, status: "generated", browserbaseScript: null })
                    .where(eq(TestCasesTable.id, parseInt(id)));
                result = `Test case #${id} updated successfully.`;
                break;
            }
            case "delete-test-case": {
                const { id } = params;
                await db.delete(TestCasesTable).where(eq(TestCasesTable.id, parseInt(id)));
                result = `Test case #${id} deleted successfully.`;
                break;
            }
            case "github-edit": {
                const cookieStore = await cookies();
                const githubToken = cookieStore.get("gh_token")?.value;
                if (!githubToken) throw new Error("GitHub token not available");

                const { file, message, content, owner, repo, branch: br } = params;
                const success = await pushToGithub(owner, repo, file, content, message, br || "main", githubToken);
                result = success ? `File \`${file}\` pushed to GitHub successfully.` : `Failed to push \`${file}\` to GitHub.`;
                break;
            }
            default:
                return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
        }

        // Save result as assistant message
        await db.insert(chatMessagesTable).values({ chatId, role: "assistant", content: result });
        return NextResponse.json({ success: true, message: result });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
