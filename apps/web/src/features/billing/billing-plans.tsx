'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../common/components/button';
import { Card } from '../../common/components/card';
import { PageHeading } from '../../common/components/page-frame';
import { BILLING_PLANS, PAYMENT_UNAVAILABLE, planPrice, yearlySavings, type BillingPeriod } from './billing.constants';

const PERIODS: readonly { value: BillingPeriod; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

/** Static prices. Upgrade does not start a payment. */
export function BillingPlans() {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <>
      <PageHeading title="Billing" description="A preview of plans. No payment is taken." />
      <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-full bg-surface-raised p-1">
        {PERIODS.map(({ value, label }) => (
          <button key={value} type="button" role="radio" aria-checked={period === value} className={`h-action rounded-full px-4 text-sm transition-colors ${period === value ? 'bg-surface-control text-ink' : 'text-ink-tertiary hover:text-ink'}`} onClick={() => setPeriod(value)}>
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {BILLING_PLANS.map((plan) => (
          <Card key={plan.id} className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">{plan.name}</h2>
            <p key={period} className="motion-fade text-xl">{planPrice(plan, period)}</p>
            {period === 'yearly' && yearlySavings(plan) !== null ? <p className="motion-fade text-sm text-link">{yearlySavings(plan)}</p> : null}
            <ul className="space-y-2 text-sm text-ink-secondary">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2"><Check size={16} aria-hidden="true" className="mt-0.5 shrink-0" />{feature}</li>
              ))}
            </ul>
            <Button className="mt-auto" onClick={() => setNotice(PAYMENT_UNAVAILABLE)}>Upgrade</Button>
          </Card>
        ))}
      </div>
      {notice !== null ? <p role="status" className="motion-fade text-sm text-ink-secondary">{notice}</p> : null}
    </>
  );
}
