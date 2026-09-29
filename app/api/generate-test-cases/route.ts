import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { db, TestCasesTable } from "@/db";
import { eq } from "drizzle-orm";
import { getInstallationAccessToken } from '@/lib/github-app';
import { getAuthenticatedAccount } from "@/lib/account";
import { hasUsageCapacity, refundUsage, reserveUsage } from "@/lib/account-usage";
import { repositories } from "@/db/schema";
import { redactSecrets } from "@/lib/redact-secrets";

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
    githubToken?: string;
}) {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "ai-test-automation-agent",
    };
    if (githubToken) {
        headers["Authorization"] = `Bearer ${githubToken}`;
    }

    const res = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        { headers }
    );

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to fetch GitHub repo tree. Status: ${res.status}, Body: ${errorText}`);
        throw new Error(`Failed to fetch GitHub repo tree: ${res.status} - ${errorText}`);
    }

    const data = await res.json();

    return (data.tree || [])
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
    githubToken?: string;
}) {
    const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "User-Agent": "ai-test-automation-agent",
    };
    if (githubToken) {
        headers["Authorization"] = `Bearer ${githubToken}`;
    }

    const res = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`,
        { headers }
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
    let reservedAccountId: number | undefined;
    let reservedUnits = 0;
    try {
        const account = await getAuthenticatedAccount();
        if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const body = await req.json();
        const repoId = Number(body.repoId);
        if (!Number.isSafeInteger(repoId)) return NextResponse.json({ error: "repoId is required" }, { status: 400 });
        const [repoRecord] = await db.select().from(repositories)
            .where(eq(repositories.repoId, repoId)).limit(1);
        if (!repoRecord || repoRecord.userId !== account.id) return NextResponse.json({ error: "Repository not found" }, { status: 404 });
        if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "AI generation is not configured" }, { status: 503 });
        const capacity = await hasUsageCapacity(account, "generation");
        if (!capacity.ok) return NextResponse.json({ error: `Monthly test-case limit reached (${capacity.limit}). Choose a paid plan or wait for the next monthly period.` }, { status: 403 });
        const maxCases = Math.min(10, capacity.limit - capacity.count, Math.floor(account.credits / 5));
        if (maxCases < 1) return NextResponse.json({ error: "You need at least 5 credits to generate a test case", credits: account.credits }, { status: 402 });
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        const owner = repoRecord.owner;
        const repo = repoRecord.name;
        const branch = typeof body.branch === "string" && /^[A-Za-z0-9._/-]{1,100}$/.test(body.branch) ? body.branch : repoRecord.defaultBranch || "main";
        const githubToken = account.installationId ? await getInstallationAccessToken(account.installationId) : undefined;

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
        const repoContext = redactSecrets(validFiles
            .map(
                (file: any) => `
File Path: ${file.path}

File Content:
${file.content}
`
            )
            .join("\n\n----------------------\n\n"));

        // 4. Ask Gemini to generate test cases with metadata
        const prompt = `
You are an expert QA automation engineer.

Analyze the GitHub repository source code and generate useful small test cases.

Your goal:
Generate test cases that can later be converted into Playwright / Browserbase automation scripts.

Repository:
Owner: ${owner}
Repo: ${repo}
Branch: ${branch}

Repository File Context:
${repoContext}

Generate up to ${maxCases} test cases, and never generate more than ${maxCases}.

Each test case must include:
- title: clear test case title
- description: one-line description
- type: one of ui, auth, api, form, integration, edge-case
- priority: low, medium, high
- targetRoute: most likely app route/page to test, for example /sign-in, /dashboard, /api/users
- targetFiles: related file paths from the repository context
- expectedResult: what should happen when the test passes

Important rules:
- Only use file paths that exist in the repository context.
- Do not invent fake target files.
- If route is unclear, infer from Next.js app/page structure.
- Keep description short, only one line.
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
                            maxItems: maxCases,
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
        const testCases = (aiResult.testCases || []).slice(0, maxCases);

        if (!testCases.length) {
            return NextResponse.json(
                {
                    error: "Gemini did not generate any test cases",
                },
                { status: 400 }
            );
        }

        // 5. Save generated test cases to Neon DB
        const reservation = await reserveUsage(account, "generation", testCases.length);
        if (!reservation.ok) {
            const message = reservation.reason === "credits"
                ? `Not enough credits. ${reservation.required} credits are needed to generate ${testCases.length} cases.`
                : `The generation would exceed your monthly limit of ${reservation.limit} test cases.`;
            return NextResponse.json({ error: message, credits: reservation.reason === "credits" ? reservation.credits : undefined }, { status: 402 });
        }
        reservedAccountId = account.id;
        reservedUnits = testCases.length;

        const insertedTestCases = await db
            .insert(TestCasesTable)
            .values(
                testCases.map((testCase: any) => ({
                    userId: String(account.id),
                    repoId: String(repoRecord.repoId),
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
        if (reservedAccountId && reservedUnits) await refundUsage(reservedAccountId, "generation", reservedUnits).catch(() => {});
        console.error("Generate test cases error:", error);

        return NextResponse.json(
            {
                success: false,
                error: error.message || "Failed to generate test cases",
            },
            { status: 500 }
        );
    }
}
