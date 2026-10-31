'use client';

import type { UserPlan } from '@hira/contracts';
import { Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '../../common/components/button';
import { Card } from '../../common/components/card';
import { PageHeading } from '../../common/components/page-frame';
import { useSession } from '../auth/session.store';
import { changePlan } from './billing-api';
import { BILLING_PLANS, planAction, planPrice, yearlySavings, type BillingPeriod } from './billing.constants';

const PERIODS: readonly { value: BillingPeriod; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

/** Plans. This is a demo: a change applies at once and no payment is taken. A guest signs up first. */
export function BillingPlans() {
  const current = useSession((state) => state.user?.plan ?? null);
  const router = useRouter();
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<UserPlan | null>(null);
  const choose = async (plan: UserPlan) => {
    if (current === null) return router.push('/register');
    setPending(plan);
    setNotice(await changePlan(plan));
    setPending(null);
  };
  return (
    <>
      <PageHeading title="Billing" description="A demo of plans. A change applies at once and no payment is taken." />
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
                <li key={feature} className="flex items-start gap-2"><Check aria-hidden="true" className="size-icon-sm mt-0.5 shrink-0" />{feature}</li>
              ))}
            </ul>
            <Button
              className="mt-auto"
              variant={current === plan.id ? 'secondary' : 'primary'}
              disabled={current === plan.id || pending !== null}
              onClick={() => void choose(plan.id)}
            >
              {current === null ? 'Upgrade' : planAction(current, plan.id)}
            </Button>
          </Card>
        ))}
      </div>
      {notice !== null ? <p role="alert" className="motion-fade text-sm text-danger">{notice}</p> : null}
    </>
  );
}
