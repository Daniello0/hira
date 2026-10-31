import { vacancySourceSite, type FavoriteDto, type ProfileDto, type ProfileSkillDto, type PromptActivity, type PromptProfile, type PromptVacancy, type TurnFacts, type VacancyDto } from '@hira/contracts';

/** One earlier chat or call as the stores read it. */
export interface ActivityRecord extends PromptActivity {
  at: Date;
}

/** Most vacancies listed per earlier chat, and most questions quoted from it. */
export const ACTIVITY_VACANCIES = 10;
export const ACTIVITY_QUERIES = 5;
/** A question is quoted up to this long, so one pasted text cannot push every other chat out of the block. */
export const ACTIVITY_QUERY_MAX_CHARS = 300;
/** Most vacancies listed from this conversation. */
export const SHOWN_HERE_MAX = 20;
/** Size of the facts block in characters. When it grows past this, the oldest entries go first. */
export const FACTS_MAX_CHARS = 9000;
/** Most saved vacancies listed, newest first, so a long list leaves room for earlier chats. */
export const FAVORITES_IN_FACTS = 15;

/** A vacancy row as Hira may speak about it. */
export function promptVacancy(vacancy: VacancyDto): PromptVacancy {
  return {
    title: vacancy.title,
    company: vacancy.companyName,
    city: vacancy.locationLabel,
    source: vacancySourceSite(vacancy.source),
    workFormat: vacancy.workFormat,
  };
}

/** A saved vacancy as Hira may speak about it. */
export function promptFavorite(favorite: FavoriteDto): PromptVacancy {
  const { vacancy } = favorite;
  return {
    title: vacancy.title,
    company: vacancy.companyName,
    city: vacancy.locationLabel,
    source: vacancy.source === null ? null : vacancySourceSite(vacancy.source),
    workFormat: vacancy.workFormat,
  };
}

/** What the account filled in. An empty profile is still `name` when the account has one. */
export function promptProfile(name: string | null, profile: ProfileDto, skills: readonly ProfileSkillDto[]): PromptProfile {
  return {
    name,
    headline: profile.headline,
    about: profile.about,
    seniority: profile.seniority,
    desiredRoles: profile.desiredRoles,
    workFormats: profile.preferredWorkFormat,
    salaryMin: profile.salaryExpectationMin,
    currency: profile.currency,
    education: profile.education,
    skills: skills.flatMap((skill) => (skill.canonicalName === null ? [] : [skill.canonicalName])),
  };
}

/** Chats and calls together, newest first, cut to what the plan allows. */
export function mergeActivity(chats: readonly ActivityRecord[], calls: readonly ActivityRecord[], limit: number): PromptActivity[] {
  return [...chats, ...calls]
    .sort((left, right) => right.at.getTime() - left.at.getTime())
    .slice(0, limit)
    .map(({ at: _at, ...activity }) => ({ ...activity, queries: activity.queries.map(clipQuery) }));
}

function clipQuery(query: string): string {
  return query.length <= ACTIVITY_QUERY_MAX_CHARS ? query : `${query.slice(0, ACTIVITY_QUERY_MAX_CHARS)}…`;
}

/** Vacancies of one conversation, the latest search first, each search in the order shown, without repeats. */
export function shownInOrder(searches: ReadonlyArray<readonly VacancyDto[]>): PromptVacancy[] {
  const seen = new Set<string>();
  const shown: PromptVacancy[] = [];
  for (const search of [...searches].reverse()) {
    for (const vacancy of search) {
      if (seen.has(vacancy.id)) continue;
      seen.add(vacancy.id);
      shown.push(promptVacancy(vacancy));
    }
  }
  return shown.slice(0, SHOWN_HERE_MAX);
}

/**
 * Cuts the block down to `maxChars`. The catalog and the profile always stay. The oldest chats go first,
 * then the oldest saved vacancies, the older vacancies of this conversation, and the least relevant facts.
 */
export function fitFacts(facts: TurnFacts, maxChars: number): TurnFacts {
  const next = { ...facts, activity: [...facts.activity], favorites: [...facts.favorites], shownHere: [...facts.shownHere], memory: [...facts.memory] };
  while (JSON.stringify(next).length > maxChars) {
    if (next.activity.pop() !== undefined) continue;
    if (next.favorites.pop() !== undefined) continue;
    if (next.shownHere.pop() !== undefined) continue;
    if (next.memory.pop() === undefined) break;
  }
  return next;
}

/** Vacancies the user may mean by "the second one". Query understanding reads these. */
export function knownVacancies(facts: TurnFacts | undefined): string[] {
  if (facts === undefined) return [];
  const half = SHOWN_HERE_MAX / 2;
  const known = [...facts.shownHere.slice(0, half), ...facts.favorites.slice(0, half)];
  return known.map((vacancy) => `${vacancy.title} (${vacancy.company})`);
}
