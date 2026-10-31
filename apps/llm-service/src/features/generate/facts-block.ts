import { vacancySourceSite, type CatalogStats, type PromptActivity, type PromptProfile, type PromptVacancy, type TurnFacts } from '@hira/contracts';

/** The facts block of a reply. A draft only needs who the user is. */
export function factsBlock(facts: TurnFacts | undefined, draft: boolean): string {
  if (facts === undefined) return '';
  const lines = draft ? profileLines(facts.profile) : everyLine(facts);
  return lines.length === 0 ? '' : ['Known facts:', ...lines].join('\n');
}

function everyLine(facts: TurnFacts): string[] {
  return [
    ...catalogLines(facts.catalog),
    ...profileLines(facts.profile),
    ...memoryLines(facts),
    ...savedLines(facts),
    ...vacancyList('Shown earlier in this conversation, latest search first', facts.shownHere),
    ...activityLines(facts.activity),
  ];
}

function catalogLines(catalog: CatalogStats | null): string[] {
  if (catalog === null) return [];
  return [
    `Catalog: ${catalog.total} active vacancies, remote ${catalog.remote}, remote from abroad ${catalog.foreignRemote}, no city stated ${catalog.noLocation}.`,
    `By region: ${counts(catalog.byRegion.map((row) => [row.region, row.count]))}.`,
    `By city: ${counts(catalog.topCities.map((row) => [row.city, row.count]))}.`,
    `By site: ${counts(catalog.bySource.map((row) => [vacancySourceSite(row.source), row.count]))}.`,
  ];
}

function counts(rows: Array<[string, number]>): string {
  return rows.length === 0 ? 'none' : rows.map(([name, count]) => `${name} ${count}`).join(', ');
}

function profileLines(profile: PromptProfile | null): string[] {
  if (profile === null) return [];
  const parts = [
    field('name', profile.name),
    field('headline', profile.headline),
    field('about', profile.about),
    field('seniority', profile.seniority),
    field('desired roles', profile.desiredRoles.join(', ')),
    field('work formats', profile.workFormats.join(', ')),
    field('salary from', profile.salaryMin === null ? null : `${profile.salaryMin} ${profile.currency ?? ''}`.trim()),
    field('education', profile.education),
    field('skills', profile.skills.join(', ')),
  ].filter((part) => part !== null);
  return parts.length === 0 ? [] : [`User profile: ${parts.join('; ')}.`];
}

function field(label: string, value: string | null): string | null {
  return value === null || value.length === 0 ? null : `${label}: ${value}`;
}

function memoryLines(facts: TurnFacts): string[] {
  if (facts.memory.length === 0) return [];
  return ['Remembered about the user:', ...facts.memory.map((fact) => `- ${fact.content}`)];
}

function savedLines({ favorites, favoritesTotal }: TurnFacts): string[] {
  if (favorites.length === 0) return favoritesTotal === 0 ? [] : [`Saved vacancies: ${favoritesTotal}.`];
  const title = favorites.length < favoritesTotal ? `Saved vacancies, the latest ${favorites.length} of ${favoritesTotal}` : 'Saved vacancies';
  return vacancyList(title, favorites);
}

function vacancyList(title: string, vacancies: readonly PromptVacancy[]): string[] {
  if (vacancies.length === 0) return [];
  return [`${title}:`, ...vacancies.map((vacancy, index) => `${index + 1}. ${vacancyLine(vacancy)}`)];
}

function vacancyLine(vacancy: PromptVacancy): string {
  const details = [vacancy.company, vacancy.city ?? 'city not stated', vacancy.workFormat, vacancy.source];
  return `${vacancy.title} | ${details.filter(Boolean).join(' | ')}`;
}

function activityLines(activity: readonly PromptActivity[]): string[] {
  if (activity.length === 0) return [];
  return ['Earlier chats and calls, newest first:', ...activity.map(activityLine)];
}

function activityLine(item: PromptActivity): string {
  const parts = [
    `- ${item.kind === 'chat' ? 'Chat' : 'Call'} ${item.title === null ? '' : `"${item.title}"`}`.trimEnd(),
    item.summary === null ? null : `summary: ${item.summary}`,
    item.queries.length === 0 ? null : `asked: ${item.queries.join('; ')}`,
    item.vacancies.length === 0 ? null : `shown: ${item.vacancies.map(vacancyLine).join('; ')}`,
  ];
  return parts.filter((part) => part !== null).join(' | ');
}
