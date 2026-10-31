import { VacancySource, type TurnFacts, type VacancyDto } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { fitFacts, knownVacancies, mergeActivity, promptVacancy, shownInOrder } from './account-activity';

const vacancy = (id: string, overrides: Partial<VacancyDto> = {}) =>
  ({ id, title: `Job ${id}`, companyName: 'Acme', locationLabel: 'Минск', source: VacancySource.RabotaBy, workFormat: null, ...overrides }) as VacancyDto;

const line = (title: string) => ({ title, company: 'Acme', city: null, source: 'rabota.by', workFormat: null });

const facts = (partial: Partial<TurnFacts>): TurnFacts => ({ catalog: null, profile: null, memory: [], favorites: [], activity: [], shownHere: [], ...partial });

describe('account activity', () => {
  it('names the site and the city of a vacancy', () => {
    expect(promptVacancy(vacancy('1', { source: VacancySource.Gsz }))).toMatchObject({ source: 'gsz.gov.by', city: 'Минск', company: 'Acme' });
  });

  it('merges chats and calls, newest first, up to the plan limit', () => {
    const at = (minute: number) => new Date(2026, 9, 31, 12, minute);
    const row = (title: string, kind: 'chat' | 'call', minute: number) => ({ kind, title, summary: null, queries: [], vacancies: [], at: at(minute) });
    const merged = mergeActivity([row('old chat', 'chat', 1), row('new chat', 'chat', 3)], [row('call', 'call', 2)], 2);
    expect(merged.map((item) => item.title)).toEqual(['new chat', 'call']);
    expect(merged[0]).not.toHaveProperty('at');
  });

  it('gives no earlier chats when the plan allows none', () => {
    expect(mergeActivity([{ kind: 'chat', title: 'x', summary: null, queries: [], vacancies: [], at: new Date() }], [], 0)).toEqual([]);
  });

  it('keeps earlier chats in the block when one question in them is a pasted text', () => {
    const row = (title: string, queries: string[]) => ({ kind: 'chat' as const, title, summary: null, queries, vacancies: [], at: new Date() });
    const pasted = 'я'.repeat(4000);
    const merged = mergeActivity([row('resume', [pasted, pasted]), row('older', ['python']), row('oldest', ['qa'])], [], 10);
    expect(fitFacts(facts({ activity: merged }), 6000).activity.map((item) => item.title)).toEqual(['resume', 'older', 'oldest']);
  });

  it('lists the latest search first and keeps the order shown', () => {
    const shown = shownInOrder([[vacancy('old')], [vacancy('a'), vacancy('b'), vacancy('old')]]);
    expect(shown.map((item) => item.title)).toEqual(['Job a', 'Job b', 'Job old']);
  });

  it('leaves a small block alone', () => {
    const small = facts({ favorites: [line('Saved')], activity: [{ kind: 'chat', title: 't', summary: null, queries: [], vacancies: [] }] });
    expect(fitFacts(small, 6000)).toEqual(small);
  });

  it('drops the oldest chats first, and only then saved vacancies', () => {
    const activity = ['newest', 'older', 'oldest'].map((title) => ({ kind: 'chat' as const, title, summary: 'x'.repeat(500), queries: [], vacancies: [] }));
    const big = facts({ favorites: [line('Saved')], activity });
    const fitted = fitFacts(big, JSON.stringify(big).length - 400);
    expect(fitted.activity.map((item) => item.title)).toEqual(['newest', 'older']);
    expect(fitted.favorites).toHaveLength(1);
    expect(fitFacts(big, 300).activity).toEqual([]);
  });

  it('keeps the catalog and the profile whatever the size', () => {
    const catalog = { total: 1, byRegion: [], topCities: [], noLocation: 0, remote: 0, foreignRemote: 0, bySource: [] };
    const big = facts({ catalog, favorites: [line('a'), line('b')], memory: [{ content: 'c' }] });
    const fitted = fitFacts(big, 10);
    expect(fitted.catalog).toEqual(catalog);
    expect(fitted.favorites).toEqual([]);
    expect(fitted.memory).toEqual([]);
  });

  it('offers query understanding the vacancies the user may mean', () => {
    expect(knownVacancies(facts({ shownHere: [line('Shown')], favorites: [line('Saved')] }))).toEqual(['Shown (Acme)', 'Saved (Acme)']);
    expect(knownVacancies(undefined)).toEqual([]);
  });
});
