# Testrix

Testrix connects a signed-in user to a GitHub App installation, analyzes selected repositories with Gemini, creates test cases, and runs those tests in Browserbase. AI-generated browser behavior is stored and executed as a validated action plan; the app does not evaluate generated JavaScript on its server.

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and configure Clerk, Neon, the GitHub App, Gemini, and Browserbase. For production, `NEXT_PUBLIC_APP_URL` and `GITHUB_APP_SETUP_URL` must use the same HTTPS application origin. Set `GITHUB_APP_NAME` to the GitHub App's URL slug, and set the GitHub App's **Setup URL** to the full `https://<app-domain>/api/github/app/callback` URL. GitHub App Setup URL and “Request user authorization (OAuth) during installation” cannot be enabled together; leave that OAuth option off for this installation flow. Enable repository contents read access plus commit status and pull-request comment permissions for CI.
3. Apply the database migration with `npm run db:migrate` before starting locally. Render and Vercel run migrations as part of their configured deployment build, so set `DATABASE_URL` in each service's build/runtime environment.
4. Start the app with `npm run dev`, sign in, and install the Testrix GitHub App. Choose the repositories the installation may access, add them to the workspace, set a public HTTPS target URL, and generate test cases.

For Browserbase, the target application must be reachable from its cloud browser. Use a public HTTPS deployment or secure HTTPS tunnel; localhost and private IP targets are rejected. Optional test credentials are stored server-side and may be used only to fill matching login fields during a test.

The GitHub App needs its App ID and RSA private key (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`) on both deployment providers. The install button redirects to GitHub; after approval, GitHub returns to the configured Setup URL and the app verifies the installation before linking it to the signed-in account. Public repositories can be imported without installing the app. Private repositories must be selected in the user's installation.

## Credits and plan limits

Each generated test case costs 5 credits and each test run costs 5 credits. AI browser-script creation is included in the run cost. Generation and run quotas reset on the first day of each UTC month. A first-time account receives 200 credits and a 10-day free trial with 20 generated cases, 20 runs, one repository, no replay links, and no CI. Paid monthly allowances are 500 / 2,000 / 10,000 generated cases and the same number of runs, with 5 / 15 / unlimited repositories. Credits granted at checkout cover the purchased billing term. Paid plans include replay links and GitHub Actions CI.

Payment amounts and credit grants are derived from the server-side plan catalog. Razorpay must be configured for checkout; development mode does not simulate paid purchases. CI uses a separate one-time displayed API key, stored as a hash. Rotate it from Project Config if it is lost.

## Commands

- `npm run dev` — local development server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run db:migrate` — apply checked-in Drizzle SQL migrations
