import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { db } from "@/db";
import { TestCasesTable, repositories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { Browserbase } from "@browserbasehq/sdk";
import { chromium } from "playwright-core";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
});

const bb = new Browserbase({
    apiKey: process.env.BROWSERBASE_API_KEY!,
});

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
            },
        }
    );

    if (!res.ok) {
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
        const { testCaseId, baseUrl, mode = "generate", customPrompt = "" } = body;

        if (!testCaseId || !baseUrl) {
            return NextResponse.json(
                { error: "testCaseId and baseUrl are required" },
                { status: 400 }
            );
        }

        // 1. Fetch test case from DB
        const [testCase] = await db
            .select()
            .from(TestCasesTable)
            .where(eq(TestCasesTable.id, testCaseId));

        if (!testCase) {
            return NextResponse.json({ error: "Test case not found" }, { status: 404 });
        }

        // Fetch repository settings for global instructions
        let repoRecord = null;
        if (testCase.repoId) {
            const [r] = await db
                .select()
                .from(repositories)
                .where(eq(repositories.repoId, parseInt(testCase.repoId)));
            repoRecord = r;
        }
        if (!repoRecord) {
            const [r] = await db
                .select()
                .from(repositories)
                .where(eq(repositories.full_name, `${testCase.repoOwner}/${testCase.repoName}`));
            repoRecord = r;
        }

        let scriptText = testCase.browserbaseScript;
        const forceRegenerate = mode === "generate" || !scriptText;

        // 2. Generate script using Gemini if forced, or if no script is cached
        if (forceRegenerate) {
            const cookiesStore = await cookies();
            const githubToken = cookiesStore.get("gh_token")?.value;

            if (!githubToken) {
                return NextResponse.json(
                    { error: "GitHub authentication token is missing or expired" },
                    { status: 401 }
                );
            }

            // Fetch target files context
            const targetFiles = testCase.targetFiles || [];
            let repoContext = "";

            if (targetFiles.length > 0) {
                const fileContents = await Promise.all(
                    targetFiles.map((path) =>
                        readGithubFile({
                            owner: testCase.repoOwner,
                            repo: testCase.repoName,
                            branch: testCase.branch || "main",
                            path,
                            githubToken,
                        })
                    )
                );

                const validFiles = fileContents.filter(Boolean);
                repoContext = validFiles
                    .map(
                        (file: any) => `
                            File Path: ${file.path}
                            File Content:
                            ${file.content}
                        `
                    )
                    .join("\n\n----------------------\n\n");
            }

            // Build global instructions and runtime prompts
            const globalIns = repoRecord?.globalInstruction
                ? `\n[GLOBAL PROJECT INSTRUCTIONS] (Follow strictly):\n${repoRecord.globalInstruction}\n`
                : "";

            const tempIns = customPrompt
                ? `\n[ADDITIONAL RUNTIME INSTRUCTIONS] (Follow strictly):\n${customPrompt}\n`
                : "";

            // Prompt Gemini for Playwright code string
            const prompt = `
You are an expert QA automation engineer.
Your task is to write a Playwright Node.js script body that executes a test case on an application running at URL: "${baseUrl}".
Test Case Details:
Title: ${testCase.title}
Description: ${testCase.description}
Target Route: ${testCase.targetRoute || "/"}
Expected Result: ${testCase.expectedResult}
${globalIns}
${tempIns}
Source File Context for Reference (Read this to extract exact tags, component text, input fields, and class names):
${repoContext || "No source file context available for this test case."}
Write only the JavaScript code that executes within an async function context.
The following variables are pre-injected into your runtime environment:
'page': The Playwright Page object.
'console': The custom console object to output log messages.
IMPORTANT:
Do NOT assume Node.js 'assert' is available.
Do NOT import assert or any other module.
At the top of the generated script, always define this custom assert helper:
function assert(condition, message) {
 if (!condition) {
 throw new Error(message || 'Assertion failed');
 }
}
Rules for your code:
1. DO NOT import playwright, browserbase, assert, or any other modules.
2. Navigate to the target route using:
    \`await page.goto('${baseUrl}${testCase.targetRoute || ""}', { waitUntil: 'load', timeout: 15000 })\`
    followed by a short settle wait: \`await page.waitForTimeout(1000)\`.
3. Carefully analyze the Source File Context provided to find the EXACT forms, inputs, placeholders, buttons, and elements. Look for:
    Input names, placeholder texts, or labels (e.g. \`page.getByPlaceholder('Enter your name')\` or \`page.locator('input[name="email"]')\`).
    Button texts (e.g. \`page.getByRole('button', { name: /submit/i })\` or \`page.locator('button:has-text("Submit")')\`).
4. Apply extreme selector resilience:
    If a specific selector or locator might fail, use flexible text-matching locators or check multiple variations.
    ALWAYS wait for an element to be visible before interacting with it: \`await page.waitForSelector('selector-or-text', { state: 'visible', timeout: 4000 }).catch(() => { })\`.
    Scroll elements into view before interaction to prevent out-of-bounds clicks: \`await locator.scrollIntoViewIfNeeded().catch(() => { })\`.
    If standard click fails or throws a timeout, try forcing it or using DOM-based dispatch click as a safe backup:
    \`await locator.click({ force: true, timeout: 2000 }).catch(async () => { await locator.evaluate(node => node.click()).catch(() => { }) })\`
5. Introduce generous settling times:
    Add \`await page.waitForTimeout(1000)\` after major actions (clicks, inputs, typing, form submissions) to allow React, Next.js, or server state updates to propagate and elements to render.
6. Use lenient, substring-based assertions:
    Do NOT use strict case-sensitive equality matches on text contents.
    Instead, search for presence or substring content in a relaxed, case-insensitive way. E.g.:
    \`const bodyText = await page.innerText('body'); \`
    \`assert(bodyText.toLowerCase().includes('${testCase?.expectedResult?.toLowerCase().replace(/'/g, "\\'")}'), 'Expected result state not matched');\`
    Or assert visibility of key success elements instead of exact string matching.
7. Print descriptive logs at each step using \`console.log()\` to make debugging a breeze for the user.
8. Return ONLY the raw JavaScript executable code.
9. DO NOT wrap the code in markdown code blocks like \`\`\`javascript or \`\`\`.
10. DO NOT include any explanation.
Just return the executable code.
`;

            const response = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite",
                contents: prompt,
            });

            let generatedCode = response.text || "";
            // Clean up any stray markdown wrappers just in case
            generatedCode = generatedCode.replace(/^```javascript\s*/i, "");
            generatedCode = generatedCode.replace(/^```js\s*/i, "");
            generatedCode = generatedCode.replace(/^```\s*/i, "");
            generatedCode = generatedCode.replace(/```\s*$/i, "");
            generatedCode = generatedCode.trim();

            // --- Sanitize: strip any require() or import statements the AI may have generated ---
            // These cannot work inside the AsyncFunction sandbox and will cause runtime errors
            generatedCode = generatedCode
                // Remove CommonJS require lines: const x = require('...'); or require('...');
                .replace(/^[ \t]*(?:const|let|var)\s+\S+\s*=\s*require\s*\([^)]*\)\s*;?\s*$/gm, "")
                .replace(/^[ \t]*require\s*\([^)]*\)\s*;?\s*$/gm, "")
                // Remove ES6 import lines: import ... from '...';
                .replace(/^[ \t]*import\s+.*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, "")
                .replace(/^[ \t]*import\s*\([^)]*\)\s*;?\s*$/gm, "")
                .trim();

            if (!generatedCode) {
                return NextResponse.json(
                    { error: "Gemini failed to generate an automation script" },
                    { status: 500 }
                );
            }

            scriptText = generatedCode;

            // Save the generated script immediately to database
            await db
                .update(TestCasesTable)
                .set({
                    browserbaseScript: scriptText,
                    status: "running",
                })
                .where(eq(TestCasesTable.id, testCase.id));
        } else {
            // 3. Mark database status as running
            await db
                .update(TestCasesTable)
                .set({ status: "running" })
                .where(eq(TestCasesTable.id, testCase.id));
        }

        const logs: string[] = [];
        const customConsole = {
            log: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
            error: (...args: any[]) => logs.push(`[ERROR] ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
            warn: (...args: any[]) => logs.push(`[WARN] ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '))
        };

        let session: any = null;
        let browser: any = null;

        try {
            // 4. Create Browserbase Session
            session = await bb.sessions.create({
                projectId: process.env.BROWSERBASE_PROJECT_ID!,
            });

            logs.push(`[SYSTEM] Browserbase session created successfully with ID: ${session.id}`);

            // 5. Connect Playwright to Session
            browser = await chromium.connectOverCDP(session.connectUrl);
            const context = browser.contexts()[0];
            const page = context.pages()[0];

            // 6. Listen to Browser Console Events
            page.on("console", (msg: any) => {
                logs.push(`[BROWSER] [${msg.type().toUpperCase()}] ${msg.text()}`);
            });

            // Inject localtunnel bypass headers so the interstitial warning page is skipped
            // (localtunnel shows a human-facing "You are about to visit" page to cloud browsers
            // unless the bypass-tunnel-reminder header is set on every request)
            const isLocaltunnel = baseUrl.includes(".loca.lt");
            if (isLocaltunnel) {
                await page.setExtraHTTPHeaders({
                    "bypass-tunnel-reminder": "1",
                    "bypass-tunnel-captcha": "1",
                    "user-agent": "Mozilla/5.0 (compatible; Browserbase/1.0; +https://browserbase.com)",
                });
                logs.push(`[SYSTEM] Localtunnel detected — injected bypass-tunnel-reminder header to skip the interstitial warning page.`);
            }

            logs.push(`[SYSTEM] Connected to Browserbase cloud browser, executing script...`);

            // 7. Compile and run script
            const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
            const runFn = new AsyncFunction("page", "assert", "console", scriptText);

            // Mock assertion helper for runtime container if script assumes assert is global
            const assertHelper = (condition: boolean, message?: string) => {
                if (!condition) {
                    throw new Error(message || "Assertion failed");
                }
            };

            await runFn(page, assertHelper, customConsole);

            logs.push(`[SYSTEM] Script execution completed successfully without errors.`);

            // 8. Clean up session and browser
            await page.close().catch(() => { });
            await browser.close().catch(() => { });

            // 9. Update DB Status to passed
            await db
                .update(TestCasesTable)
                .set({
                    status: "passed",
                    browserbaseScript: scriptText,
                    logs: logs,
                    sessionId: session.id,
                    sessionUrl: `https://www.browserbase.com/sessions/${session.id}`,
                })
                .where(eq(TestCasesTable.id, testCase.id));

            return NextResponse.json({
                success: true,
                status: "passed",
                sessionId: session.id,
                sessionUrl: `https://www.browserbase.com/sessions/${session.id}`,
                logs,
                browserbaseScript: scriptText,
            });
        } catch (execError: any) {
            console.error("Script execution error:", execError);
            const errMsg: string = execError.message || String(execError);
            logs.push(`[SYSTEM ERROR] Script execution failed: ${errMsg}`);

            // Provide actionable hints for common failure patterns
            if (errMsg.includes("503") || errMsg.toLowerCase().includes("tunnel unavailable") || errMsg.toLowerCase().includes("err_connection_refused")) {
                logs.push(`[SYSTEM HINT] ⚠️ Got a 503 / connection refused error. This usually means your tunnel (ngrok/localtunnel) has expired or is not running.`);
                logs.push(`[SYSTEM HINT] ➡ Restart your tunnel: run  npx localtunnel --port 3000  (or  ngrok http 3000)  in a new terminal, then paste the new public URL into the Target Website URL field and try again.`);
            }
            if (errMsg.toLowerCase().includes("dependency is missing") || errMsg.toLowerCase().includes("require is not defined") || errMsg.toLowerCase().includes("cannot find module")) {
                logs.push(`[SYSTEM HINT] ⚠️ The AI-generated script tried to import/require a Node.js module, which is not allowed in the sandboxed runner.`);
                logs.push(`[SYSTEM HINT] ➡ Switch to "AI Regenerate" mode and try running again — the script has been sanitized. If this persists, add an explicit note in the Custom Run Instructions: "Do NOT use require() or import any modules."`);
            }

            // Clean up session and browser if still active
            if (browser) {
                await browser.close().catch(() => { });
            }

            // 10. Update DB Status to failed
            await db
                .update(TestCasesTable)
                .set({
                    status: "failed",
                    browserbaseScript: scriptText,
                    logs: logs,
                    sessionId: session?.id || null,
                    sessionUrl: session ? `https://www.browserbase.com/sessions/${session.id}` : null,
                })
                .where(eq(TestCasesTable.id, testCase.id));

            return NextResponse.json({
                success: false,
                status: "failed",
                error: execError.message || String(execError),
                sessionId: session?.id,
                sessionUrl: session ? `https://www.browserbase.com/sessions/${session.id}` : null,
                logs,
                browserbaseScript: scriptText,
            });
        }
    } catch (error: any) {
        console.error("API endpoint error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || "An unexpected error occurred",
            },
            { status: 500 }
        );
    }
}
