import { SeniorityLevel, WorkFormat, EmploymentType } from '@hira/contracts';

/** Maps a source experience label onto the shared seniority enum. */
export function mapSeniority(raw: string | null): SeniorityLevel | null {
  const text = raw?.toLowerCase().trim() ?? '';
  if (text.length === 0) return null;
  if (text.includes('нет опыта') || text.includes('noexperience'))
    return SeniorityLevel.NoExperience;
  if (text.includes('lead') || text.includes('ведущ')) return SeniorityLevel.Lead;
  if (text.includes('более 6') || text.includes('morethan6')) return SeniorityLevel.Senior;
  return mapMiddleBand(text);
}

/** Maps a source schedule label onto the shared work-format enum. */
export function mapWorkFormat(raw: string | null): WorkFormat | null {
  const text = raw?.toLowerCase() ?? '';
  if (text.length === 0) return null;
  if (text.includes('гибрид') || text.includes('можно удал')) return WorkFormat.Hybrid;
  if (text.includes('удал')) return WorkFormat.Remote;
  if (text.includes('на месте') || text.includes('офис')) return WorkFormat.Onsite;
  return null;
}

/** Maps a source employment label onto the shared employment enum. */
export function mapEmployment(raw: string | null): EmploymentType | null {
  const text = raw?.toLowerCase() ?? '';
  if (text.includes('частич') || text.includes('part')) return EmploymentType.PartTime;
  if (text.includes('проект') || text.includes('project')) return EmploymentType.Project;
  if (text.includes('фриланс') || text.includes('freelance')) return EmploymentType.Freelance;
  if (text.includes('полн') || text === 'full') return EmploymentType.FullTime;
  return null;
}

function mapMiddleBand(text: string): SeniorityLevel | null {
  if (text.includes('3') && text.includes('6')) return SeniorityLevel.Middle;
  if (text.includes('1') && text.includes('3')) return SeniorityLevel.Junior;
  return null;
}
