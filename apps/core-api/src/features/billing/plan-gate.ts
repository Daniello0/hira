import { Inject, Injectable } from '@nestjs/common';
import { PLAN_LIMITS, PLAN_ORDER, UserPlan, type PlanLimits } from '@hira/contracts';
import { USER_STORE, type UserStore } from '../auth/user.store';
import { PlanLimitError } from './plan-limit.error';

type SwitchFeature = 'collections' | 'crossChatMemory' | 'call';
type CountedFeature = 'favorites' | 'libraryFiles';

/** The one place the server checks what a plan allows. */
@Injectable()
export class PlanGate {
  constructor(@Inject(USER_STORE) private readonly users: UserStore) {}

  /** Limits of the account's plan. A missing account gets the free ones. */
  async limits(userId: string): Promise<PlanLimits> {
    const account = await this.users.findById(userId);
    return PLAN_LIMITS[account?.plan ?? UserPlan.Free];
  }

  /** Throws unless the plan includes the feature. */
  async requireFeature(userId: string, feature: SwitchFeature): Promise<void> {
    if ((await this.limits(userId))[feature]) return;
    throw new PlanLimitError(feature, cheapestPlan((limits) => limits[feature]));
  }

  /** Throws unless there is room for one more. What is already saved stays. */
  async requireRoom(userId: string, feature: CountedFeature, used: number): Promise<void> {
    if (hasRoom((await this.limits(userId))[feature], used)) return;
    throw new PlanLimitError(feature, cheapestPlan((limits) => hasRoom(limits[feature], used)));
  }
}

function hasRoom(limit: number | null, used: number): boolean {
  return limit === null || used < limit;
}

function cheapestPlan(allows: (limits: PlanLimits) => boolean): UserPlan {
  return PLAN_ORDER.find((plan) => allows(PLAN_LIMITS[plan])) ?? UserPlan.Max;
}
