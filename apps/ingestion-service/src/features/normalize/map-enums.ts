import { SeniorityLevel, WorkFormat, EmploymentType } from '@hira/contracts';

/** Maps a source experience label (Russian or English) onto the shared seniority enum. */
export function mapSeniority(raw: string | null): SeniorityLevel | null {
  const text = raw?.toLowerCase().trim() ?? '';
  if (text.length === 0) return null;
  if (isNoExperience(text)) return SeniorityLevel.NoExperience;
  if (/\b(?:lead|director|executive|principal|head)\b/.test(text) || text.includes('ведущ')) {
    return SeniorityLevel.Lead;
  }
  if (/\bmid[\s-]*senior\b/.test(text)) return SeniorityLevel.Middle;
  if (/\bsenior\b/.test(text) || text.includes('более 6') || text.includes('morethan6')) {
    return SeniorityLevel.Senior;
  }
  if (/\b(?:middle|mid)\b/.test(text)) return SeniorityLevel.Middle;
  if (/\b(?:junior|entry|associate)\b/.test(text)) return SeniorityLevel.Junior;
  return mapMiddleBand(text);
}

/** Maps a source schedule label (Russian or English) onto the shared work-format enum. */
export function mapWorkFormat(raw: string | null): WorkFormat | null {
  const text = raw?.toLowerCase() ?? '';
  if (text.length === 0) return null;
  if (text.includes('гибрид') || text.includes('можно удал') || text.includes('hybrid')) {
    return WorkFormat.Hybrid;
  }
  if (text.includes('удал') || text.includes('remote') || text.includes('telecommute')) {
    return WorkFormat.Remote;
  }
  if (isOnsite(text)) return WorkFormat.Onsite;
  return null;
}

/** Maps a source employment label (Russian or English) onto the shared employment enum. */
export function mapEmployment(raw: string | null): EmploymentType | null {
  const text = raw?.toLowerCase() ?? '';
  if (text.includes('частич') || text.includes('part')) return EmploymentType.PartTime;
  if (text.includes('проект') || text.includes('project')) return EmploymentType.Project;
  if (/\b(?:contract|contractor|temporary)\b/.test(text)) return EmploymentType.Project;
  if (text.includes('фриланс') || text.includes('freelance')) return EmploymentType.Freelance;
  if (text.includes('полн') || text === 'full' || /\bfull[\s_-]*time\b/.test(text)) {
    return EmploymentType.FullTime;
  }
  return null;
}

function isNoExperience(text: string): boolean {
  if (text.includes('нет опыта') || text.includes('не требуется')) return true;
  if (text.includes('noexperience')) return true;
  return /\b(?:intern|internship|trainee|no experience)\b/.test(text);
}

function isOnsite(text: string): boolean {
  if (text.includes('на месте') || text.includes('офис') || text.includes('на территории')) {
    return true;
  }
  return /\b(?:on[\s-]?site|in[\s-]office|office)\b/.test(text);
}

function mapMiddleBand(text: string): SeniorityLevel | null {
  if (text.includes('3') && text.includes('6')) return SeniorityLevel.Middle;
  if (text.includes('1') && text.includes('3')) return SeniorityLevel.Junior;
  return null;
}
