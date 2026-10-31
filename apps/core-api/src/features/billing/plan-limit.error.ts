import type { PlanFeature, UserPlan } from '@hira/contracts';

const MESSAGES: Readonly<Record<PlanFeature, string>> = {
  favorites: 'You have reached the limit of saved vacancies on your plan.',
  collections: 'Collections are part of the Pro plan.',
  libraryFiles: 'You have reached the limit of library files on your plan.',
  crossChatMemory: 'Cross-chat memory is part of the Pro plan.',
  call: 'Voice calls are part of the Pro plan.',
};

/** The account's plan does not allow this. */
export class PlanLimitError extends Error {
  constructor(
    readonly feature: PlanFeature,
    readonly requiredPlan: UserPlan,
  ) {
    super(MESSAGES[feature]);
    this.name = 'PlanLimitError';
  }
}
