'use client';

import { useState } from 'react';
import { Button } from '../../common/components/button';
import { BILLING_PLANS, PAYMENT_UNAVAILABLE, planPrice, yearlySavings, type BillingPeriod } from './billing.constants';

/** Static prices. Upgrade does not start a payment. */
export function BillingPlans() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-2 text-sm text-hira-muted">A preview of plans. No payment is taken.</p>
      </header>
      <div className="flex gap-2">
        <Button type="button" tone={period === 'monthly' ? 'accent' : 'quiet'} onClick={() => setPeriod('monthly')}>Monthly</Button>
        <Button type="button" tone={period === 'yearly' ? 'accent' : 'quiet'} onClick={() => setPeriod('yearly')}>Yearly</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {BILLING_PLANS.map((plan) => (
          <article key={plan.id} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-hira-panel/40 p-4">
            <h2 className="text-lg font-medium">{plan.name}</h2>
            <p className="text-xl">{planPrice(plan, period)}</p>
            {period === 'yearly' && yearlySavings(plan) !== null ? <p className="text-sm text-hira-accent">{yearlySavings(plan)}</p> : null}
            <ul className="space-y-1 text-sm text-hira-muted">
              {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <Button type="button" className="mt-auto" onClick={() => setNotice(PAYMENT_UNAVAILABLE)}>Upgrade</Button>
          </article>
        ))}
      </div>
      {notice !== null ? <p role="status">{notice}</p> : null}
    </div>
  );
}
