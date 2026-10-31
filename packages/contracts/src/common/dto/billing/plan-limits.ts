import { UserPlan } from '../../enums/user-plan.enum';

/** What a plan allows. `null` means no limit. The server enforces it; the web only shows it. */
export interface PlanLimits {
  searchesPerDay: number;
  favorites: number | null;
  collections: boolean;
  libraryFiles: number | null;
  crossChatMemory: boolean;
  call: boolean;
  /** Earlier chats and calls Hira may read. Zero means only the current one. */
  contextChats: number;
}

/** A plan-gated capability, as named in the `PLAN_LIMIT_REACHED` error. */
export type PlanFeature = 'favorites' | 'collections' | 'libraryFiles' | 'crossChatMemory' | 'call';

export const PLAN_LIMITS: Readonly<Record<UserPlan, PlanLimits>> = {
  [UserPlan.Free]: { searchesPerDay: 20, favorites: 20, collections: false, libraryFiles: 3, crossChatMemory: false, call: false, contextChats: 0 },
  [UserPlan.Pro]: { searchesPerDay: 100, favorites: null, collections: true, libraryFiles: 50, crossChatMemory: true, call: true, contextChats: 10 },
  [UserPlan.Max]: { searchesPerDay: 500, favorites: null, collections: true, libraryFiles: null, crossChatMemory: true, call: true, contextChats: 50 },
};

/** Monthly price in dollars, paid month to month or yearly. */
export const PLAN_PRICES: Readonly<Record<UserPlan, { monthly: number; yearly: number }>> = {
  [UserPlan.Free]: { monthly: 0, yearly: 0 },
  [UserPlan.Pro]: { monthly: 19, yearly: 15 },
  [UserPlan.Max]: { monthly: 39, yearly: 31 },
};

/** Plans from the cheapest up. */
export const PLAN_ORDER: readonly UserPlan[] = [UserPlan.Free, UserPlan.Pro, UserPlan.Max];

/** Display name of a plan. */
export const PLAN_NAMES: Readonly<Record<UserPlan, string>> = {
  [UserPlan.Free]: 'Free',
  [UserPlan.Pro]: 'Pro',
  [UserPlan.Max]: 'Max',
};

/** Whether moving from `current` to `next` goes up the list. */
export function isUpgrade(current: UserPlan, next: UserPlan): boolean {
  return PLAN_ORDER.indexOf(next) > PLAN_ORDER.indexOf(current);
}
