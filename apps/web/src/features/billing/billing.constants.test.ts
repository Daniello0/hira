import { UserPlan } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { BILLING_PLANS, planAction, planFeatures, planPrice, yearlySavings } from './billing.constants';

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

  it('offers Free, Pro, and Max, and no Team', () => {
    expect(BILLING_PLANS.map((plan) => plan.name)).toEqual(['Free', 'Pro', 'Max']);
    expect(planPrice(BILLING_PLANS[2]!, 'monthly')).toBe('$39/month');
  });

  it('describes the limits the server enforces', () => {
    expect(planFeatures(UserPlan.Free)).toEqual(expect.arrayContaining(['20 searches a day', 'Up to 20 saved vacancies', '3 library files']));
    expect(planFeatures(UserPlan.Free).join()).not.toContain('Voice calls');
    expect(planFeatures(UserPlan.Pro)).toEqual(expect.arrayContaining(['100 searches a day', 'Memory across chats', 'Voice calls in five languages']));
    expect(planFeatures(UserPlan.Max)).toEqual(expect.arrayContaining(['500 searches a day', 'Unlimited library files']));
  });

  it('labels each plan against the current one', () => {
    expect(planAction(UserPlan.Free, UserPlan.Pro)).toBe('Upgrade');
    expect(planAction(UserPlan.Max, UserPlan.Pro)).toBe('Downgrade');
    expect(planAction(UserPlan.Pro, UserPlan.Pro)).toBe('Current plan');
  });
});
