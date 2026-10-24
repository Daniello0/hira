import { describe, expect, it } from 'vitest';
import { BILLING_PLANS, planPrice, yearlySavings } from './billing.constants';

describe('billing prices', () => {
  it('shows a yearly discount only on paid plans', () => {
    const free = BILLING_PLANS[0];
    const pro = BILLING_PLANS[1];
    if (free === undefined || pro === undefined) throw new Error('plans missing');
    expect(planPrice(free, 'yearly')).toBe('$0');
    expect(yearlySavings(free)).toBeNull();
    expect(planPrice(pro, 'monthly')).toBe('$19/month');
    expect(planPrice(pro, 'yearly')).toBe('$15/month, billed yearly');
    expect(yearlySavings(pro)).toBe('Save 21%');
  });
});
