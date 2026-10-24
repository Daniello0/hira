export interface BillingPlan {
  id: string;
  name: string;
  monthly: number;
  yearly: number;
  features: readonly string[];
}

export type BillingPeriod = 'monthly' | 'yearly';

/** Mock prices. Nothing here is charged. */
export const BILLING_PLANS: readonly BillingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    monthly: 0,
    yearly: 0,
    features: ['Demo chat before sign-up', '20 searches a day on an account'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 19,
    yearly: 15,
    features: ['Saved vacancies and collections', 'Library and cross-chat memory'],
  },
  {
    id: 'team',
    name: 'Team',
    monthly: 49,
    yearly: 39,
    features: ['Shared shortlists', 'A library for the whole team'],
  },
];

export const PAYMENT_UNAVAILABLE = 'Payment is not available in this preview.';

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
