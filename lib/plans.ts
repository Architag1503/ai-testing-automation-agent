export const PLAN_CATALOG = {
  "Free Trial": {
    badge: "Trial", priceMonthly: 0, priceAnnually: 0, billingMonths: 0,
    credits: 200, generations: 20, runs: 20, repositories: 1,
    recordings: false, ci: false,
  },
  "Pro 3-Month": {
    badge: "Quarterly", priceMonthly: 29, priceAnnually: 23, billingMonths: 3,
    credits: 5_000, generations: 500, runs: 500, repositories: 5,
    recordings: true, ci: true,
  },
  "Business 6-Month": {
    badge: "Semi-Annually", priceMonthly: 49, priceAnnually: 39, billingMonths: 6,
    credits: 20_000, generations: 2_000, runs: 2_000, repositories: 15,
    recordings: true, ci: true,
  },
  "Enterprise 1-Year": {
    badge: "Annually", priceMonthly: 79, priceAnnually: 63, billingMonths: 12,
    credits: 100_000, generations: 10_000, runs: 10_000, repositories: null,
    recordings: true, ci: true,
  },
} as const;

export type PlanName = keyof typeof PLAN_CATALOG;
export type PlanEntitlements = (typeof PLAN_CATALOG)[PlanName];
export const CREDITS_PER_GENERATION = 5;
export const CREDITS_PER_RUN = 5;

export function getPlan(name: string): PlanEntitlements | null {
  return Object.prototype.hasOwnProperty.call(PLAN_CATALOG, name)
    ? PLAN_CATALOG[name as PlanName]
    : null;
}
