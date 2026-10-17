import { SkillType } from '@hira/contracts';

export interface EscoTypeInput {
  kind: 'skill' | 'group';
  escoSkillType: string | null;
  inLanguage: boolean;
  inTransversal: boolean;
  inDigital: boolean;
}

/**
 * Maps an ESCO concept onto `SkillType`.
 * Priority: language collection, transversal, digital, then knowledge, then skill/competence.
 * Groups and unrecognized concepts stay unmapped.
 */
export function mapEscoSkillType(input: EscoTypeInput): SkillType | null {
  if (input.kind !== 'skill') return null;
  if (input.inLanguage) return SkillType.Language;
  if (input.inTransversal) return SkillType.Soft;
  if (input.inDigital) return SkillType.Tool;
  return baseSkillType(input.escoSkillType);
}

function baseSkillType(value: string | null): SkillType | null {
  const token = value?.trim().toLowerCase() ?? '';
  if (token === 'knowledge') return SkillType.Domain;
  if (token === 'skill/competence' || token === 'skill') return SkillType.Hard;
  return null;
}
