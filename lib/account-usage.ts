import { and, desc, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { db, subscriptions, users, type User } from "@/db";
import { CREDITS_PER_GENERATION, CREDITS_PER_RUN, getPlan, PLAN_CATALOG } from "@/lib/plans";

type AccountPlan = { name: string; badge: string; priceMonthly: number; priceAnnually: number; billingMonths: number;
  credits: number; generations: number; runs: number; repositories: number | null; recordings: boolean; ci: boolean;
  activeSubscription: typeof subscriptions.$inferSelect | null };

export async function getAccountPlan(account: User): Promise<AccountPlan> {
  const [active] = await db.select().from(subscriptions)
    .where(and(eq(subscriptions.userId, account.id), eq(subscriptions.isActive, 1), eq(subscriptions.status, "active")))
    .orderBy(desc(subscriptions.createdAt)).limit(1);
  const paidPlan = active ? getPlan(active.planName) : null;
  if (active && paidPlan && (!active.expiresAt || active.expiresAt > new Date())) {
    return { name: active.planName, ...paidPlan, activeSubscription: active };
  }
  const trial = PLAN_CATALOG["Free Trial"];
  const trialExpired = account.createdAt.getTime() + 10 * 24 * 60 * 60 * 1000 <= Date.now();
  return { name: "Free Trial", ...trial, generations: trialExpired ? 0 : trial.generations, runs: trialExpired ? 0 : trial.runs, activeSubscription: null };
}

export async function reserveUsage(account: User, kind: "generation" | "run", units = 1) {
  const plan = await getAccountPlan(account);
  const limit = kind === "generation" ? plan.generations : plan.runs;
  const unitCost = kind === "generation" ? CREDITS_PER_GENERATION : CREDITS_PER_RUN;
  const cost = unitCost * units;
  const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const usageColumn = kind === "generation" ? users.usageGenerations : users.usageRuns;
  const usageSet = kind === "generation"
    ? { usageGenerations: sql`CASE WHEN ${users.usagePeriodStart} < ${periodStart} THEN ${units} ELSE ${users.usageGenerations} + ${units} END` }
    : { usageRuns: sql`CASE WHEN ${users.usagePeriodStart} < ${periodStart} THEN ${units} ELSE ${users.usageRuns} + ${units} END` };
  const updated = await db.update(users).set({
    credits: sql`${users.credits} - ${cost}`,
    usageGenerations: sql`CASE WHEN ${users.usagePeriodStart} < ${periodStart} THEN 0 ELSE ${users.usageGenerations} END`,
    usageRuns: sql`CASE WHEN ${users.usagePeriodStart} < ${periodStart} THEN 0 ELSE ${users.usageRuns} END`,
    usagePeriodStart: sql`CASE WHEN ${users.usagePeriodStart} < ${periodStart} THEN ${periodStart} ELSE ${users.usagePeriodStart} END`,
    ...usageSet,
  }).where(and(
    eq(users.id, account.id),
    gte(users.credits, cost),
    or(lt(users.usagePeriodStart, periodStart), isNull(users.usagePeriodStart), sql`${usageColumn} + ${units} <= ${limit}`),
  )).returning();

  if (updated[0]) return { ok: true as const, user: updated[0], plan, cost };
  const [fresh] = await db.select().from(users).where(eq(users.id, account.id)).limit(1);
  const stale = !fresh || fresh.usagePeriodStart < periodStart;
  if (fresh && fresh.credits < cost) return { ok: false as const, reason: "credits", credits: fresh.credits, required: cost, plan };
  const count = kind === "generation" ? (stale ? 0 : fresh?.usageGenerations ?? 0) : (stale ? 0 : fresh?.usageRuns ?? 0);
  return { ok: false as const, reason: "limit", count, limit, plan };
}

export async function hasUsageCapacity(account: User, kind: "generation" | "run") {
  const plan = await getAccountPlan(account);
  const limit = kind === "generation" ? plan.generations : plan.runs;
  const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [fresh] = await db.select().from(users).where(eq(users.id, account.id)).limit(1);
  const count = !fresh || fresh.usagePeriodStart < periodStart ? 0
    : kind === "generation" ? fresh.usageGenerations : fresh.usageRuns;
  return { ok: count < limit, count, limit, plan };
}

export async function refundUsage(accountId: number, kind: "generation" | "run", units = 1) {
  const cost = units * (kind === "generation" ? CREDITS_PER_GENERATION : CREDITS_PER_RUN);
  const countColumn = kind === "generation" ? users.usageGenerations : users.usageRuns;
  await db.update(users).set({
    credits: sql`${users.credits} + ${cost}`,
    [kind === "generation" ? "usageGenerations" : "usageRuns"]: sql`GREATEST(${countColumn} - ${units}, 0)`,
  }).where(eq(users.id, accountId));
}

export async function hasRepositoryCapacity(account: User) {
  const plan = await getAccountPlan(account);
  if (plan.repositories === null) return { ok: true as const, plan };
  const { repositories } = await import("@/db/schema");
  const rows = await db.select({ id: repositories.id }).from(repositories).where(eq(repositories.userId, account.id));
  return { ok: rows.length < plan.repositories, plan, count: rows.length };
}
