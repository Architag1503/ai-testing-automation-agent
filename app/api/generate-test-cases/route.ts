import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { db, TestCasesTable } from "@/db";
import { cookies } from "next/headers";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
});

const ALLOWED_EXTENSIONS = [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".json",
    ".md",
];

const IMPORTANT_FILES = [
    "package.json",
    "next.config",
    "middleware",
    "app/",
    "pages/",
    "components/",
    "src/",
    "lib/",
    "utils/",
    "actions/",
    "api/",
    "server/",
];

const IGNORE_PATHS = [
    "node_modules",
    ".next",
    "dist",
    "build",
    ".git",
    "coverage",
    "public/",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    ".png",
    ".jpg",
    ".jpeg",
    ".svg",
    ".webp",
    ".mp4",
    ".mov",
];

function isUsefulFile(path: string) {
    const isIgnored = IGNORE_PATHS.some((item) => path.includes(item));

    const isAllowedExtension = ALLOWED_EXTENSIONS.some((ext) =>
        path.endsWith(ext)
    );

    const isImportantPath = IMPORTANT_FILES.some((item) =>
        path.includes(item)
    );

    return !isIgnored && isAllowedExtension && isImportantPath;
}

async function getRepoTree({
    owner,
    repo,
    branch,
    githubToken,
}: {
    owner: string;
    repo: string;
    branch: string;
    githubToken: string;
}) {
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

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to fetch GitHub repo tree. Status: ${res.status}, Body: ${errorText}`);
        throw new Error(`Failed to fetch GitHub repo tree: ${res.status} - ${errorText}`);
    }

    const data = await res.json();

    return data.tree
        .filter((item: any) => item.type === "blob")
        .filter((item: any) => isUsefulFile(item.path))
        .slice(0, 25);
}

async function readGithubFile({
    owner,
    repo,
    path,
    branch,
    githubToken,
}: {
    owner: string;
    repo: string;
    path: string;
    branch: string;
    githubToken: string;
}) {
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

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to read GitHub file ${path}. Status: ${res.status}, Body: ${errorText}`);
        return null;
    }

    const data = await res.json();

    if (!data.content) {
        return null;
    }

    const decodedContent = Buffer.from(data.content, "base64").toString("utf-8");

    return {
        path,
        content: decodedContent.slice(0, 5000),
    };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const cookiesStore = await cookies();
        const githubToken = cookiesStore.get('gh_token')?.value;

        const {
            userId,
            repoId,
            owner,
            repo,
            branch = "main",
        } = body;

        if (!userId || !owner || !repo || !githubToken) {
            return NextResponse.json(
                {
                    error: "userId, owner, repo and githubToken are required",
                },
                { status: 400 }
            );
        }

        // 1. Get repo tree
        const repoFiles = await getRepoTree({
            owner,
            repo,
            branch,
            githubToken,
        });

        // 2. Read useful files
        const fileContents = await Promise.all(
            repoFiles.map((file: any) =>
                readGithubFile({
                    owner,
                    repo,
                    branch,
                    path: file.path,
                    githubToken,
                })
            )
        );

        const validFiles = fileContents.filter(Boolean);

        if (validFiles.length === 0) {
            return NextResponse.json(
                {
                    error: "No useful source files found in this repository",
                },
                { status: 400 }
            );
        }

        // 3. Prepare compact repo context
        const repoContext = validFiles
            .map(
                (file: any) => `
File Path: ${file.path}

File Content:
${file.content}
`
            )
            .join("\n\n----------------------\n\n");

        // 4. Ask Gemini to generate test cases with metadata
        const prompt = `
You are an expert QA automation engineer.

Analyze the GitHub repository source code and generate useful small test cases.

Your goal:
Generate test cases that verify content on a web page. Each test case works by navigating to a route and checking if specific text appears on the page.

IMPORTANT CONTEXT: The test browser will have an authenticated user session (existing cookies are injected). This means:
- Auth pages like /sign-in, /sign-up, /login, /register will REDIRECT to the home page
- Clerk's <SignIn/> and <SignUp/> components CANNOT render because the user is already signed in
- DO NOT generate test cases for sign-in, sign-up, login, or register routes — they will always fail

Repository:
Owner: ${owner}
Repo: ${repo}
Branch: ${branch}

Repository File Context:
${repoContext}

Generate 5 to 10 test cases targeting only routes that work for authenticated users (e.g. /, /workspace, /dashboard, /settings, /pricing, etc.)

Each test case must include:
- title: clear test case title (e.g. "Verify workspace page loads")
- description: one-line description
- type: one of ui, auth, api, form, integration, edge-case
- priority: low, medium, high
- targetRoute: the app route to navigate to (e.g. /workspace, /, /pricing). CRITICAL: Must be ONLY the path portion — do NOT include the full URL (no http:// or https://). Example: "/workspace" is correct, "https://example.com/workspace" is WRONG.
- targetFiles: related file paths from the repository context (max 3)
- expectedResult: a SHORT phrase (3-10 words) that ACTUALLY appears as text on the rendered page. CRITICAL: This must be a hardcoded string literal visible in the source code of that route's page file or its direct child components.

CRITICAL rules for expectedResult:
- Search the source code files of the targetRoute page for JSX string literals (headings, button text, labels, menu items)
- Copy the EXACT text from the source code — every character must match (case-insensitive comparison is used at runtime, but the words must be the same)
- Examples of GOOD expectedResult: "Workspace", "Remaining Credits", "Repositories", "Connect Github & Add Repository", "Automate Your Web Testing", "Go to Workspace", "Pricing", "Features"
- Examples of BAD expectedResult: "Sign in to Testrix" (this text comes from Clerk SDK, not app source code and only shows for unauthenticated users), "Create your account" (same), "Connect Github accounts and add a repository" (actual page text is "Connect Github & Add Repository" — wrong words), "The user should be redirected", "API returns file path" — DO NOT use these
- BAD examples are either auth-page-only text, descriptions of behavior, or paraphrased text. DO NOT use them.
- Keep it short (3-10 words max)

Other important rules:
- Only use file paths that exist in the repository context.
- Do not invent fake target files or fake routes.
- If route is unclear, infer from Next.js app/page structure (app/ directory).
- Keep description short, one line only.
- Return only valid JSON.
`;

        const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        testCases: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: {
                                        type: Type.STRING,
                                    },
                                    description: {
                                        type: Type.STRING,
                                    },
                                    type: {
                                        type: Type.STRING,
                                        enum: [
                                            "ui",
                                            "auth",
                                            "api",
                                            "form",
                                            "integration",
                                            "edge-case",
                                        ],
                                    },
                                    priority: {
                                        type: Type.STRING,
                                        enum: ["low", "medium", "high"],
                                    },
                                    targetRoute: {
                                        type: Type.STRING,
                                    },
                                    targetFiles: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.STRING,
                                        },
                                    },
                                    expectedResult: {
                                        type: Type.STRING,
                                    },
                                },
                                required: [
                                    "title",
                                    "description",
                                    "type",
                                    "priority",
                                    "targetRoute",
                                    "targetFiles",
                                    "expectedResult",
                                ],
                            },
                        },
                    },
                    required: ["testCases"],
                },
            },
        });

        const aiResult = JSON.parse(response.text || "{}");
        const testCases = aiResult.testCases || [];

        if (!testCases.length) {
            return NextResponse.json(
                {
                    error: "Gemini did not generate any test cases",
                },
                { status: 400 }
            );
        }

        // 5. Save generated test cases to Neon DB
        const insertedTestCases = await db
            .insert(TestCasesTable)
            .values(
                testCases.map((testCase: any) => ({
                    userId,
                    repoId,
                    repoName: repo,
                    repoOwner: owner,
                    branch,

                    title: testCase.title,
                    description: testCase.description,
                    type: testCase.type,
                    priority: testCase.priority,

                    targetRoute: testCase.targetRoute,
                    targetFiles: testCase.targetFiles || [],
                    expectedResult: testCase.expectedResult,

                    status: "generated",
                }))
            )
            .returning();

        return NextResponse.json({
            success: true,
            message: "Test cases generated successfully",
            count: insertedTestCases.length,
            testCases: insertedTestCases,
        });
    } catch (error: any) {
        console.error("Generate test cases error:", error);

        let userMessage = error.message || "Failed to generate test cases";
        const errStr = (error.message || "").toLowerCase();
        const causeStr = (error.cause?.message || "").toLowerCase();

        if (errStr.includes("fetch failed") || causeStr.includes("connect timeout") || causeStr.includes("enotfound") || causeStr.includes("econnrefused")) {
            userMessage = "Cannot connect to GitHub API. Check your internet connection and GitHub token, then try again.";
        } else if (errStr.includes("401") || errStr.includes("unauthorized")) {
            userMessage = "GitHub token is invalid or expired. Reconnect your GitHub account.";
        } else if (errStr.includes("403") || errStr.includes("rate limit")) {
            userMessage = "GitHub API rate limit exceeded. Wait a few minutes and try again.";
        } else if (errStr.includes("404") || errStr.includes("not found")) {
            userMessage = "Repository or file not found on GitHub. Check that the repository exists and is accessible.";
        }

        return NextResponse.json(
            {
                success: false,
                error: userMessage,
            },
            { status: 500 }
        );
    }
}
