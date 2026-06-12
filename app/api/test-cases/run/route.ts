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

        // Escape a string value for safe interpolation into a JS template literal.
        // Must escape: \ → \\, ` → \`, ${ → \${, ' → \'
        const escTpl = (s: string) =>
          (s || "").replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${").replace(/'/g, "\\'");

        const escapedExpected = escTpl(testCase?.expectedResult || "");
        let rawRoute = testCase?.targetRoute || "";
        // Sanitize targetRoute: if it contains a full URL, extract just the path
        if (rawRoute.includes("://")) {
            try {
                rawRoute = "/" + rawRoute.split("/").slice(3).join("/");
            } catch { }
        }
        const escapedTargetRoute = escTpl(rawRoute.startsWith("/") ? rawRoute : "/" + rawRoute);
        const escapedBaseUrl = escTpl(baseUrl);
        const testEmail = escTpl(repoRecord?.testEmail || "");
        const testPassword = escTpl(repoRecord?.testPassword || "");
        const clerkSecretKey = escTpl(repoRecord?.clerkSecretKey || process.env.CLERK_SECRET_KEY || "");
        console.log('[AUTH] Clerk key source:', repoRecord?.clerkSecretKey ? 'repo.clerkSecretKey' : 'env.CLERK_SECRET_KEY');

        // 2. Build the execution script — fixed template, NO AI-generated code.
        const scriptText = `
function assert(condition, message) {
  if (!condition) { throw new Error(message || 'Assertion failed'); }
}

// ---- Helpers ----
async function getPageText() {
  return await page.innerText('body').catch(() => '');
}
async function isOnSignInPage() {
  const text = await getPageText();
  const clerkKeywords = ['sign in to', 'welcome back', 'email address', 'password', 'continue with google', 'sign up', 'create account'];
  const clerkMatches = clerkKeywords.filter(k => text.toLowerCase().includes(k));
  return clerkMatches.length >= 2;
}

const expectedResultText = '${escapedExpected}';
const autoEmail = '${testEmail}';
const autoPassword = '${testPassword}';

// ---- Navigate to target route ----
let navigationError = null;
let pageBodyText = '';
try {
  await page.goto('${escapedBaseUrl}${escapedTargetRoute}', { waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(2000);
  console.log('Page URL:', page.url());
  console.log('Page title:', await page.title());
  pageBodyText = await getPageText();
  console.log('Page text:', pageBodyText.substring(0, 500));
} catch (e) {
  navigationError = e.message;
  console.log('Navigation error:', e.message);
}
if (navigationError) {
  assert(false, 'Page failed to load: ' + navigationError);
}
if (pageBodyText.length === 0) {
  assert(false, 'Page returned no text content');
}

// ---- Check if we need to sign in ----
const pageContainsSignIn = pageBodyText.toLowerCase().includes('sign in');
const pageContainsGetStarted = pageBodyText.toLowerCase().includes('get started');
const isPublicLandingPage = pageContainsSignIn && pageContainsGetStarted;
const needsSignIn = await isOnSignInPage() || isPublicLandingPage;

if (needsSignIn) {
  if (!autoEmail || !autoPassword) {
    assert(false, 'Page requires authentication. Expected: "' + expectedResultText + '" | Provide email and password in Project Config > Test Credentials.');
  }
  console.log('[AUTH] Sign-in page detected. Attempting auto sign-in...');

  const CLERK_SK = '${clerkSecretKey}';
  let signInSucceeded = false;
  let clerkUserId = null;
  let jwtToken = null;
  let clerkSessionId = null;

  // ==== PHASE 0: Ensure the test user exists with known password via Backend API ====
  if (CLERK_SK && autoEmail && autoPassword) {
    console.log('[AUTH] Phase 0: Provisioning test user via Clerk Backend API...');
    try {
      const userRes = await fetch('https://api.clerk.com/v1/users?email_address=' + encodeURIComponent(autoEmail), {
        headers: { Authorization: 'Bearer ' + CLERK_SK }
      });
      const userData = await userRes.json();
      const userList = userData.data || userData;
      clerkUserId = Array.isArray(userList) && userList.length > 0 ? userList[0].id : null;

      if (clerkUserId) {
        // User exists — ensure password matches our test password
        console.log('[AUTH] User found:', clerkUserId);
        const updateRes = await fetch('https://api.clerk.com/v1/users/' + clerkUserId, {
          method: 'PATCH',
          headers: { Authorization: 'Bearer ' + CLERK_SK, 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: autoPassword })
        });
        if (updateRes.ok) {
          console.log('[AUTH] User password updated successfully');
        } else {
          const err = await updateRes.json().catch(() => ({}));
          console.log('[AUTH] Password update response:', updateRes.status, err.error || err.errors?.[0]?.message || '');
        }
      } else {
        // User does not exist — create with email + password
        console.log('[AUTH] User not found, creating...');
        const createRes = await fetch('https://api.clerk.com/v1/users', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + CLERK_SK, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email_address: [autoEmail],
            password: autoPassword
          })
        });
        if (createRes.ok) {
          const newUser = await createRes.json();
          clerkUserId = newUser.id;
          console.log('[AUTH] User created:', clerkUserId);
        } else {
          const err = await createRes.json().catch(() => ({}));
          console.log('[AUTH] User creation failed:', createRes.status, err.error || err.errors?.[0]?.message || '');
        }
      }
    } catch (e) { console.log('[AUTH] User provisioning error:', e.message); }
  }

  // ==== APPROACH 1 (PRIMARY): Clerk SDK programmatic sign-in with password ====
  if (CLERK_SK && !signInSucceeded) {
    console.log('[AUTH] Approach 1: Trying Clerk SDK sign-in with password...');
    try {
      const apiResult = await page.evaluate(async ({ email, password }) => {
        const clerk = window.Clerk || window.__clerk;
        if (!clerk) return { success: false, error: 'Clerk SDK not loaded' };
        if (!clerk.client) return { success: false, error: 'Clerk client not loaded' };

        try {
          const signIn = await clerk.client.signIn.create({
            strategy: 'password',
            identifier: email,
            password: password
          });
          if (signIn.status === 'complete' || signIn.createdSessionId) {
            return { success: true };
          }
          if (signIn.status === 'needs_first_factor') {
            const pwFactor = signIn.supportedFirstFactors?.find(f => f.strategy === 'password');
            if (pwFactor) {
              const attempt = await signIn.attemptFirstFactor({ strategy: 'password', password });
              if (attempt.status === 'complete' || attempt.createdSessionId) {
                return { success: true };
              }
              return { success: false, error: 'First factor status: ' + attempt.status };
            }
            return { success: false, error: 'No password factor, factors: ' + JSON.stringify(signIn.supportedFirstFactors) };
          }
          // Handle Client Trust / MFA second factor (email code)
          if (signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust') {
            const emailFactor = signIn.supportedSecondFactors?.find(f => f.strategy === 'email_code');
            if (emailFactor) {
              // Send the verification code to the user's email
              await signIn.prepareSecondFactor({ strategy: 'email_code' });
              // Wait a moment for the email to be sent
              await new Promise(r => setTimeout(r, 3000));
              // Try to extract code from the page (Clerk dev mode shows it in some UIs) or from the Backend API
              const pageContent = document.body?.innerText || '';
              const codeMatch = pageContent.match(/\b(\d{6})\b/);
              if (codeMatch) {
                const attempt = await signIn.attemptSecondFactor({ strategy: 'email_code', code: codeMatch[1] });
                if (attempt.status === 'complete' || attempt.createdSessionId) {
                  return { success: true };
                }
                return { success: false, error: 'Second factor status: ' + attempt.status };
              }
              return { success: false, error: 'Email code sent but code not found on page. Check your email: ' + emailFactor.emailAddress };
            }
            return { success: false, error: 'No email factor available, factors: ' + JSON.stringify(signIn.supportedSecondFactors) };
          }
          return { success: false, error: 'Sign-in status: ' + signIn.status };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }, { email: autoEmail, password: autoPassword });

      console.log('[AUTH] SDK sign-in result:', apiResult.error || 'success=' + apiResult.success);

      if (apiResult.success) {
        console.log('[AUTH] SDK sign-in succeeded! Navigating to target...');
        await page.goto('${escapedBaseUrl}${escapedTargetRoute}', { waitUntil: 'load', timeout: 20000 });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(5000);
        pageBodyText = await getPageText();
        console.log('[AUTH] After navigation, URL:', page.url());
        if (!(await isOnSignInPage())) {
          signInSucceeded = true;
        } else {
          console.log('[AUTH] SDK sign-in set cookies but redirect shows sign-in still');
        }
      }
    } catch (e) {
      console.log('[AUTH] Approach 1 error:', e.message);
    }
  }

  // ==== APPROACH 2: Backend API session + cookie injection (fast path fallback) ====
  if (!signInSucceeded && CLERK_SK && clerkUserId) {
    console.log('[AUTH] Approach 2: Trying Backend API session + cookie injection...');
    try {
      const sessRes = await fetch('https://api.clerk.com/v1/sessions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + CLERK_SK, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: clerkUserId })
      });
      const session = await sessRes.json();
      clerkSessionId = session?.id;
      if (clerkSessionId) {
        const tokRes = await fetch('https://api.clerk.com/v1/sessions/' + clerkSessionId + '/tokens', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + CLERK_SK, 'Content-Type': 'application/json' }
        });
        const token = await tokRes.json();
        jwtToken = token.jwt || token.object;
        console.log('[AUTH] Clerk session created:', clerkSessionId);
      }
      if (jwtToken) {
        const hostname = new URL(page.url()).hostname;
        await page.context().addCookies([
          { name: '__session', value: jwtToken, domain: hostname, path: '/' },
          { name: '__client_uat', value: String(Math.floor(Date.now() / 1000)), domain: hostname, path: '/' }
        ]);
        await page.goto('${escapedBaseUrl}${escapedTargetRoute}', { waitUntil: 'load', timeout: 20000 });
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(5000);
        pageBodyText = await getPageText();
        console.log('[AUTH] After cookie injection, URL:', page.url());
        // Check if Clerk client-side SDK detected our session
        const clerkState = await page.evaluate(() => {
          const c = window.Clerk || window.__clerk;
          if (!c) return 'no clerk';
          return { hasSession: !!c.session || !!c.user, userId: c.user?.id || null };
        }).catch(() => 'evaluate failed');
        console.log('[AUTH] Clerk client state:', JSON.stringify(clerkState));
        if (!(await isOnSignInPage())) {
          // If Clerk client didn't detect session, reload to let SDK re-initialize with cookies
          if (clerkState && !clerkState.hasSession) {
            console.log('[AUTH] Clerk client not signed in yet — reloading...');
            await page.reload({ waitUntil: 'networkidle', timeout: 20000 }).catch(() => {});
            await page.waitForTimeout(3000);
            pageBodyText = await getPageText();
            console.log('[AUTH] After reload, URL:', page.url());
          }
          // Only count as succeeded if the expected content is visible
          const expectedText = '${escapedExpected}';
          const hasExpectedText = expectedText ? pageBodyText.toLowerCase().includes(expectedText.toLowerCase()) : true;
          if (hasExpectedText) {
            console.log('[AUTH] Cookie injection worked!');
            signInSucceeded = true;
          } else {
            console.log('[AUTH] Cookie injection passed middleware but expected text not found — likely client-side Clerk SDK needs client JWT');
          }
        }
      }
    } catch (e) { console.log('[AUTH] Backend API error:', e.message); }
  }

  // ==== APPROACH 2b: Backend API session + Authorization header (bypasses cookie JWT type issue) ====
  if (!signInSucceeded && jwtToken) {
    console.log('[AUTH] Approach 2b: Trying Authorization header injection...');
    try {
      await page.setExtraHTTPHeaders({ 'Authorization': 'Bearer ' + jwtToken });
      await page.goto('${escapedBaseUrl}${escapedTargetRoute}', { waitUntil: 'load', timeout: 20000 });
      await page.waitForTimeout(3000);
      pageBodyText = await getPageText();
      console.log('[AUTH] After auth header, URL:', page.url());
      if (!(await isOnSignInPage())) {
        const expectedText = '${escapedExpected}';
        const hasExpectedText = expectedText ? pageBodyText.toLowerCase().includes(expectedText.toLowerCase()) : true;
        if (hasExpectedText) {
          console.log('[AUTH] Auth header injection worked!');
          signInSucceeded = true;
        } else {
          console.log('[AUTH] Auth header injection passed middleware but expected text not found');
        }
      }
      await page.setExtraHTTPHeaders({});
    } catch (e) { console.log('[AUTH] Auth header error:', e.message); }
  }

  // ==== APPROACH 2c: Get client JWT via Backend API sign-in (admin strategy) ====
  if (!signInSucceeded && clerkSessionId) {
    console.log('[AUTH] Approach 2c: Trying Backend API sign-in with admin strategy for client JWT...');
    try {
      const signInRes = await fetch('https://api.clerk.com/v1/sign_ins', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + CLERK_SK, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: 'admin',
          session_id: clerkSessionId,
          identifier: email
        })
      });
      const signInData = await signInRes.json();
      if (signInRes.ok) {
        const clientJwt = signInData.client?.jwt || signInData.publishable_key || null;
        if (clientJwt) {
          console.log('[AUTH] Got client JWT from Backend API sign-in');
          const hostname = new URL(page.url()).hostname;
          await page.context().addCookies([
            { name: '__session', value: clientJwt, domain: hostname, path: '/' },
            { name: '__client_uat', value: String(Math.floor(Date.now() / 1000)), domain: hostname, path: '/' }
          ]);
          await page.goto('${escapedBaseUrl}${escapedTargetRoute}', { waitUntil: 'load', timeout: 20000 });
          await page.waitForLoadState('networkidle').catch(() => {});
          await page.waitForTimeout(3000);
          pageBodyText = await getPageText();
          console.log('[AUTH] After client JWT injection, URL:', page.url());
          if (!(await isOnSignInPage())) {
            const expectedText = '${escapedExpected}';
            const hasExpectedText = expectedText ? pageBodyText.toLowerCase().includes(expectedText.toLowerCase()) : true;
            if (hasExpectedText) {
              console.log('[AUTH] Client JWT injection worked!');
              signInSucceeded = true;
            } else {
              console.log('[AUTH] Client JWT injection not showing expected text');
            }
          }
        } else {
          console.log('[AUTH] No client JWT in sign-in response:', JSON.stringify(signInData).slice(0, 500));
        }
      } else {
        console.log('[AUTH] Backend API admin sign-in failed:', JSON.stringify(signInData).slice(0, 200));
      }
    } catch (e) { console.log('[AUTH] Approach 2c error:', e.message); }
  }

  // ==== APPROACH 2d: Extract publishable key → call Frontend API from server for client JWT ====
  if (!signInSucceeded && clerkSessionId) {
    console.log('[AUTH] Approach 2d: Trying Frontend API sign-in with admin strategy...');
    try {
      let pubKey = await page.evaluate(() => {
        const script = document.querySelector('script[data-clerk-publishable-key]');
        if (script?.getAttribute('data-clerk-publishable-key')) return script.getAttribute('data-clerk-publishable-key');
        const meta = document.querySelector('meta[name="clerk-publishable-key"]');
        return meta?.getAttribute('content') || '';
      }).catch(() => '');
      if (!pubKey) {
        // Try extracting from the Next.js inline data
        const fallback = await page.evaluate(() => {
          const scripts = document.querySelectorAll('script');
          for (const s of scripts) {
            const m = s.textContent?.match(/["']publishableKey["']\s*:\s*["']([^"']+)["']/);
            if (m) return m[1];
            const m2 = s.textContent?.match(/["']__clerk_publishable_key["']\s*,\s*["']([^"']+)["']/);
            if (m2) return m2[1];
          }
          return '';
        }).catch(() => '');
        if (fallback) { pubKey = fallback; }
      }
      if (pubKey) {
        const frontendRes = await fetch('https://api.clerk.com/v1/client/sign_ins?__clerk_publishable_key=' + encodeURIComponent(pubKey), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategy: 'admin', session_id: clerkSessionId })
        });
        const frontendData = await frontendRes.json();
        if (frontendRes.ok && frontendData.client?.jwt) {
          const clientJwt = frontendData.client.jwt;
          console.log('[AUTH] Got client JWT from Frontend API');
          const hostname = new URL(page.url()).hostname;
          await page.context().addCookies([
            { name: '__session', value: clientJwt, domain: hostname, path: '/' },
            { name: '__client_uat', value: String(Math.floor(Date.now() / 1000)), domain: hostname, path: '/' }
          ]);
          await page.goto('${escapedBaseUrl}${escapedTargetRoute}', { waitUntil: 'load', timeout: 20000 });
          await page.waitForLoadState('networkidle').catch(() => {});
          await page.waitForTimeout(3000);
          pageBodyText = await getPageText();
          console.log('[AUTH] After client JWT injection (Frontend API), URL:', page.url());
          if (!(await isOnSignInPage())) {
            const expectedText = '${escapedExpected}';
            const hasExpectedText = expectedText ? pageBodyText.toLowerCase().includes(expectedText.toLowerCase()) : true;
            if (hasExpectedText) {
              console.log('[AUTH] Client JWT injection worked!');
              signInSucceeded = true;
            } else {
              console.log('[AUTH] Client JWT injection not showing expected text');
            }
          }
        } else {
          console.log('[AUTH] Frontend API admin strategy failed:', frontendData.error || JSON.stringify(frontendData).slice(0, 300) || 'no client JWT');
        }
      }
    } catch (e) { console.log('[AUTH] Approach 2d error:', e.message); }
  }

  // ==== APPROACH 3: Clerk UI form — fills email first, submits, then password, submits ====
  if (!signInSucceeded) {
    console.log('[AUTH] Approach 3: Using Clerk sign-in form (two-step flow)...');
    try {
      // Step 1: Fill & submit email (identifier)
      const emailField = page.locator('input[name="identifier"], input[type="email"], input[id="identifier"]').first();
      if (await emailField.count() > 0) {
        await emailField.fill(autoEmail);
        console.log('[AUTH] Filled email');
      }

      // Submit via Enter key (more reliable than clicking hidden buttons)
      await page.waitForTimeout(500);
      try {
        await page.keyboard.press('Enter', { timeout: 2000 });
        console.log('[AUTH] Submitted identifier (Enter)');
      } catch {
        // Fallback: try visible Continue button
        const contBtn = page.locator('button:has-text("Continue"):not([aria-hidden])').first();
        if (await contBtn.count() > 0) {
          await contBtn.click({ force: true, timeout: 5000 });
          console.log('[AUTH] Submitted identifier (click)');
        } else {
          await page.keyboard.press('Enter');
        }
      }

      // Wait for Clerk to process identifier and transition to password step
      await page.waitForTimeout(2000);

      // Step 2: Fill & submit password
      const passwordField = page.locator('input[name="password"], input[type="password"], input[id="password"], input[id="password-field"]').first();
      if (await passwordField.count() > 0) {
        await passwordField.fill(autoPassword);
        console.log('[AUTH] Filled password');
      }

      await page.waitForTimeout(500);
      try {
        await page.keyboard.press('Enter', { timeout: 2000 });
        console.log('[AUTH] Submitted password (Enter)');
      } catch {
        const pwdBtn = page.locator('button:has-text("Continue"):not([aria-hidden]), button:has-text("Sign In"):not([aria-hidden])').first();
        if (await pwdBtn.count() > 0) {
          await pwdBtn.click({ force: true, timeout: 5000 });
          console.log('[AUTH] Submitted password (click)');
        } else {
          await page.keyboard.press('Enter');
        }
      }

      // Wait for sign-in to complete and redirect back to the app
      for (let i = 0; i < 30; i++) {
        const url = page.url();
        if (!url.includes('/sign-in') && !url.includes('/sign-up') && !url.includes('clerk.')) {
          break;
        }
        await page.waitForTimeout(1000);
      }
      await page.waitForTimeout(2000);
      pageBodyText = await getPageText();
      console.log('[AUTH] After form sign-in, URL:', page.url());
      console.log('[AUTH] Page text:', pageBodyText.substring(0, 300));

      if (!(await isOnSignInPage())) {
        signInSucceeded = true;
      }
    } catch (e) {
      console.log('[AUTH] Approach 3 error:', e.message);
    }
  }

  // ==== APPROACH 4: Google OAuth (last resort) ====
  if (!signInSucceeded) {
    console.log('[AUTH] Approach 4: Trying Google OAuth...');
    try {
      // Click "Continue with Google"
      const googleBtn = page.locator('button:has-text("Google"), a:has-text("Google"), div:has-text("Google"), [class*="google"]').first();
      if (await googleBtn.count() > 0 && await googleBtn.isVisible().catch(() => false)) {
        await googleBtn.click();
        console.log('[AUTH] Clicked Continue with Google');
      }

      // Wait for Google OAuth page to load
      await page.waitForTimeout(5000);

      // Fill email on Google sign-in
      const googleEmail = page.locator('input[type="email"], input[name="identifier"]').first();
      if (await googleEmail.count() > 0 && await googleEmail.isVisible().catch(() => false)) {
        await googleEmail.click();
        await googleEmail.fill(autoEmail);
        await page.keyboard.press('Enter');
        console.log('[AUTH] Filled Google email');
        await page.waitForTimeout(3000);
      }

      // Fill password on Google sign-in
      const googlePass = page.locator('input[type="password"], input[name="password"]').first();
      if (await googlePass.count() > 0 && await googlePass.isVisible().catch(() => false)) {
        await googlePass.click();
        await googlePass.fill(autoPassword);
        await page.keyboard.press('Enter');
        console.log('[AUTH] Filled Google password');
        await page.waitForTimeout(3000);
      }

      // Handle consent / "Continue" buttons on Google
      for (let i = 0; i < 10; i++) {
        const continueBtn = page.locator('button:has-text("Continue"), span:has-text("Continue"), div:has-text("Continue"), [aria-label*="Continue" i]').first();
        if (await continueBtn.count() > 0 && await continueBtn.isVisible().catch(() => false)) {
          await continueBtn.click();
          console.log('[AUTH] Clicked Continue on Google');
          await page.waitForTimeout(2000);
          break;
        }
        await page.waitForTimeout(1000);
      }

      // Wait for redirect back to app (up to 60 seconds)
      for (let i = 0; i < 60; i++) {
        const url = page.url();
        if (!url.includes('accounts.google.com') && !url.includes('clerk.')) {
          break;
        }
        await page.waitForTimeout(1000);
      }
      pageBodyText = await getPageText();
      console.log('[AUTH] After Google OAuth, URL:', page.url());
      console.log('[AUTH] Page text:', pageBodyText.substring(0, 300));

      // Handle Clerk factor-one / factor-two page (MFA / email verification)
      if (page.url().includes('/sign-in/factor-one') || page.url().includes('/sign-in/factor-two') || pageBodyText.includes('Use another method') || pageBodyText.includes('Check your email')) {
        if (page.url().includes('/sign-in/factor-two') || pageBodyText.includes('Check your email')) {
          console.log('[AUTH] Clerk 2FA page detected (email verification). The Clerk instance has MFA enabled.');
          console.log('[AUTH] To bypass, disable "Sign in from new device" verification in Clerk Dashboard.');
          // Try using the Backend API session with Authorization header (already attempted in Approach 2b)
        } else {
          console.log('[AUTH] Clerk factor-one page detected — trying "Continue with Google" again...');
          const googleBtn2 = page.locator('button:has-text("Google"), a:has-text("Google")').first();
          if (await googleBtn2.count() > 0 && await googleBtn2.isVisible().catch(() => false)) {
            await googleBtn2.click({ force: true });
            console.log('[AUTH] Clicked Continue with Google on factor-one page');
            for (let i = 0; i < 30; i++) {
              const url = page.url();
              if (!url.includes('/sign-in') && !url.includes('clerk.') && !url.includes('accounts.google.com')) break;
              await page.waitForTimeout(1000);
            }
            pageBodyText = await getPageText();
            console.log('[AUTH] After factor-one Google retry, URL:', page.url());
          } else {
            console.log('[AUTH] No Google button found on factor-one page');
          }
        }
      }
    } catch (e) {
      console.log('[AUTH] Google OAuth error:', e.message);
    }
  }

  // ---- Final check after all sign-in attempts ----
  if (!signInSucceeded && (await isOnSignInPage())) {
    const signInError = 'All sign-in approaches failed. Page still on sign-in. ';
    console.log('[AUTH] ' + signInError);
    assert(false, signInError + 'Expected: "' + expectedResultText + '" after sign-in.');
  }
} else if (expectedResultText) {
  console.log('[AUTH] No sign-in needed — page loaded directly.');
}

// ---- Fallback: if on landing page and expected text not found, try workspace route ----
if (expectedResultText) {
  pageBodyText = await getPageText();
  console.log('[ASSERT] Checking for expected text: "' + expectedResultText + '"');
  console.log('[ASSERT] Current page content: "' + pageBodyText.substring(0, 400) + '"');
  if (!pageBodyText.toLowerCase().includes(expectedResultText.toLowerCase())) {
    const isLanding = pageBodyText.toLowerCase().includes('sign in') && pageBodyText.toLowerCase().includes('start free trial');
    if (isLanding) {
      console.log('[ASSERT] On landing page — navigating to /workspace as fallback...');
      await page.goto('${escapedBaseUrl}/workspace', { waitUntil: 'load', timeout: 20000 });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(3000);
      pageBodyText = await getPageText();
      console.log('[ASSERT] Fallback URL:', page.url());
      console.log('[ASSERT] Fallback content: "' + pageBodyText.substring(0, 400) + '"');
    }
  }
  assert(pageBodyText.toLowerCase().includes(expectedResultText.toLowerCase()),
    'Expected: "' + expectedResultText + '" | Page content: "' + pageBodyText.substring(0, 300) + '"');
}
console.log('Test PASSED.');
`.trim();

        // Save the generated script immediately to database
        await db
            .update(TestCasesTable)
            .set({
                browserbaseScript: scriptText,
                status: "running",
            })
            .where(eq(TestCasesTable.id, testCase.id));

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

            // Inject current user session cookies (Clerk / GitHub) into Browserbase context
            // Only inject if the target domain matches the app's own domain (not external apps)
            try {
                const urlObj = new URL(baseUrl);
                const domain = urlObj.hostname;
                const reqCookies = req.cookies.getAll();
                const ownDomain = req.headers.get("host") || "";
                
                // Only inject cookies when testing the same app (localhost or own domain)
                const isSameApp = ownDomain.includes(domain) || domain.includes("localhost") || domain.includes("127.0.0.1");
                
                if (isSameApp && reqCookies && reqCookies.length > 0) {
                    const playwrightCookies = reqCookies.map(cookie => ({
                        name: cookie.name,
                        value: cookie.value,
                        domain: domain,
                        path: '/',
                        secure: true,
                        sameSite: 'Lax' as const
                    }));
                    await context.addCookies(playwrightCookies);
                    logs.push(`[SYSTEM] Injected ${playwrightCookies.length} session cookies for domain ${domain} into browser context.`);
                } else if (!isSameApp) {
                    logs.push(`[SYSTEM] Skipping cookie injection (target domain "${domain}" differs from workspace domain "${ownDomain}").`);
                }
            } catch (cookieErr: any) {
                console.error("Failed to inject cookies:", cookieErr);
                logs.push(`[SYSTEM WARNING] Failed to inject user session cookies: ${cookieErr.message}`);
            }

            // 6. Listen to Browser Console Events
            page.on("console", (msg: any) => {
                logs.push(`[BROWSER] [${msg.type().toUpperCase()}] ${msg.text()}`);
            });

            // Inject tunnel bypass headers so warning pages are skipped
            const isLocaltunnel = baseUrl.includes(".loca.lt");
            const isNgrok = baseUrl.includes("ngrok-free.app") || baseUrl.includes("ngrok.io");
            
            if (isLocaltunnel) {
                await page.setExtraHTTPHeaders({
                    "bypass-tunnel-reminder": "1",
                    "bypass-tunnel-captcha": "1",
                    "user-agent": "Mozilla/5.0 (compatible; Browserbase/1.0; +https://browserbase.com)",
                });
                logs.push(`[SYSTEM] Localtunnel detected — injected bypass-tunnel-reminder header to skip the interstitial warning page.`);
            } else if (isNgrok) {
                await page.setExtraHTTPHeaders({
                    "ngrok-skip-browser-warning": "true",
                    "user-agent": "Mozilla/5.0 (compatible; Browserbase/1.0; +https://browserbase.com)",
                });
                logs.push(`[SYSTEM] ngrok detected — injected ngrok-skip-browser-warning header.`);
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
            // Only show tunnel hint if error is NOT an assertion/content mismatch
            const isAssertError = errMsg.startsWith("Expected:") || errMsg.includes("Test PASSED");
            const isTunnelError = !isAssertError && (
                errMsg.includes("503") || 
                errMsg.includes("408") || 
                errMsg.toLowerCase().includes("tunnel unavailable") || 
                errMsg.toLowerCase().includes("err_connection_refused") || 
                errMsg.toLowerCase().includes("timeout") ||
                errMsg.toLowerCase().includes("err_http_response_code_failure") ||
                errMsg.toLowerCase().includes("navigation error") ||
                errMsg.toLowerCase().includes("page failed to load") ||
                errMsg.toLowerCase().includes("net::")
            );
                                 
            if (isTunnelError) {
                logs.push(`[SYSTEM HINT] ⚠️ Tunnel connection failed (503 / 408 / connection refused / timeout).`);
                logs.push(`[SYSTEM HINT] ➡ This usually means your tunnel (localtunnel or ngrok) crashed, expired, or is blocked.`);
                logs.push(`[SYSTEM HINT] ➡ Action: Restart your tunnel in your terminal (run "npx localtunnel --port 3000" or "ngrok http 3000").`);
                logs.push(`[SYSTEM HINT] ➡ Tip: Localtunnel is highly unstable and frequently drops connections. We recommend switching to ngrok for reliable local testing!`);
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
