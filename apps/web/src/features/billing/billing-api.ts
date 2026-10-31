import type { CurrentUserDto, UserPlan } from '@hira/contracts';
import { authedFetch } from '../../common/api/authed-fetch';
import { jsonRequest } from '../../common/api/core-api';
import { invalidate } from '../../common/data/data-version.store';
import { readApiMessage } from '../auth/read-api-message';
import { useSession } from '../auth/session.store';

const PLAN_CHANGE_FAILED = 'Could not change the plan';

/** Moves the account to a plan. The screen follows at once. A string is why it did not happen. */
export async function changePlan(plan: UserPlan): Promise<string | null> {
  try {
    const response = await authedFetch('/api/v1/billing/plan', jsonRequest('PUT', { plan }));
    if (!response.ok) return await readApiMessage(response, PLAN_CHANGE_FAILED);
    useSession.getState().patchUser((await response.json()) as CurrentUserDto);
    invalidate('account');
    return null;
  } catch {
    return PLAN_CHANGE_FAILED;
  }
}
