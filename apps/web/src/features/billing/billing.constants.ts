import { PLAN_LIMITS, PLAN_NAMES, PLAN_ORDER, PLAN_PRICES, UserPlan, isUpgrade } from '@hira/contracts';

export interface BillingPlan {
  id: UserPlan;
  name: string;
  monthly: number;
  yearly: number;
  features: readonly string[];
}

export type BillingPeriod = 'monthly' | 'yearly';

/** Plans as the page shows them. Prices and limits come from the one list the server also reads. */
export const BILLING_PLANS: readonly BillingPlan[] = PLAN_ORDER.map((plan) => ({
  id: plan,
  name: PLAN_NAMES[plan],
  ...PLAN_PRICES[plan],
  features: planFeatures(plan),
}));

/** What the plan gives, in words. */
export function planFeatures(plan: UserPlan): string[] {
  const limits = PLAN_LIMITS[plan];
  return [
    `${limits.searchesPerDay} searches a day`,
    limits.favorites === null ? 'Unlimited saved vacancies' : `Up to ${limits.favorites} saved vacancies`,
    ...(limits.collections ? ['Collections for saved vacancies'] : []),
    limits.libraryFiles === null ? 'Unlimited library files' : `${limits.libraryFiles} library files`,
    ...(limits.crossChatMemory ? ['Memory across chats'] : []),
    ...(limits.call ? ['Voice calls in five languages'] : []),
    limits.contextChats === 0 ? 'Hira knows the current chat' : `Hira knows your last ${limits.contextChats} chats and calls`,
  ];
}

/** Label of a plan's button for this account. */
export function planAction(current: UserPlan, plan: UserPlan): string {
  if (current === plan) return 'Current plan';
  return isUpgrade(current, plan) ? 'Upgrade' : 'Downgrade';
}

/** Price line for the selected period. Yearly is a lower monthly equivalent. */
export function planPrice(plan: BillingPlan, period: BillingPeriod): string {
  const amount = period === 'monthly' ? plan.monthly : plan.yearly;
  if (amount === 0) return '$0';
  if (period === 'monthly') return `$${amount}/month`;
  return `$${amount}/month, billed yearly`;
}

/** Percent off the monthly price when the yearly plan is cheaper. */
export function yearlySavings(plan: BillingPlan): string | null {
  if (plan.monthly === 0 || plan.yearly >= plan.monthly) return null;
  return `Save ${Math.round((1 - plan.yearly / plan.monthly) * 100)}%`;
}
