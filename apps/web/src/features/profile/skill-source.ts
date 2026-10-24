import { ProfileSkillSource } from '@hira/contracts';

const SOURCE_LABELS: Record<ProfileSkillSource, string> = {
  [ProfileSkillSource.SelfReported]: 'Manual',
  [ProfileSkillSource.ExtractedFromResume]: 'Resume',
  [ProfileSkillSource.ExtractedFromChat]: 'Dialog',
};

/** Where the skill came from, in the English UI. */
export function skillSourceLabel(source: ProfileSkillSource): string {
  return SOURCE_LABELS[source];
}
