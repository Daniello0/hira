import { MatchFactor, RetrievalBranch, VacancyStatus, type SkillMatch, type VacancyResult } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { factorBars, skillGroups, toVacancyCardModel } from './vacancy-card-model';

describe('vacancy card model', () => {
  it('keeps four badges and does not replace an empty company with the title', () => {
    const model = toVacancyCardModel(result({ companyName: '', matched: 6 }));
    expect(model.company).toBe('');
    expect(model.title).toBe('Python');
    expect(model.badges).toHaveLength(4);
  });

  it('marks a closed vacancy and keeps the original url', () => {
    const model = toVacancyCardModel(result({ status: VacancyStatus.Closed }));
    expect(model.closed).toBe(true);
    expect(model.originalUrl).toBe('https://example.test/job');
  });

  it('sizes a bar from the factor score', () => {
    const bars = factorBars(result({ skill: 40 }).explanation);
    expect(bars.find((bar) => bar.factor === MatchFactor.SkillFit)?.width).toBe(40);
  });

  it('shows the graph path on related skills', () => {
    const groups = skillGroups(result({ path: 'Docker → Kubernetes' }).explanation);
    const related = groups.find((group) => group.title === 'Related through the graph');
    expect(related?.skills[0]?.path).toBe('Docker → Kubernetes');
  });
});

function result(patch: { companyName?: string; matched?: number; status?: VacancyStatus; skill?: number; path?: string | null }): VacancyResult {
  const score = patch.skill ?? 80;
  const factor = { score };
  const matched = Array.from({ length: patch.matched ?? 1 }, (_, index) => skill(`Skill ${index}`, null));
  return {
    vacancy: {
      id: 'v',
      source: 'RABOTA_BY' as never,
      language: 'en' as never,
      externalId: 'e',
      url: 'https://example.test/job',
      title: 'Python',
      companyId: null,
      companyName: patch.companyName ?? 'Labs',
      locationId: 1,
      locationLabel: 'Minsk',
      description: '',
      seniority: null,
      employment: null,
      workFormat: null,
      schedule: null,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      salaryMinByn: null,
      salaryMaxByn: null,
      isGross: null,
      rateAmount: null,
      rateUnit: null,
      projectDurationDays: null,
      isForeignRemote: false,
      status: patch.status ?? VacancyStatus.Active,
      publishedAt: '',
    },
    score,
    explanation: {
      totalScore: score,
      factors: { skillFit: { score }, semanticFit: factor, lexicalFit: factor, experienceFit: factor, formatFit: factor, salaryFit: factor },
      matchedSkills: matched,
      relatedSkills: [skill('Kubernetes', patch.path ?? null)],
      missingSkills: [],
      retrievedBy: [RetrievalBranch.Graph],
    },
    retrievedBy: [RetrievalBranch.Graph],
  };
}

function skill(surface: string, path: string | null): SkillMatch {
  return { surface, canonicalId: null, evidenceSpan: 'from the posting', path };
}
