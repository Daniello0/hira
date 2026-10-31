import { describe, expect, it } from 'vitest';
import { OTHER_CITIES_REGION, formatLocationLabel } from './location-label';
import { vacancySourceSite } from './source-label';
import { VacancySource } from '../../enums/vacancy-source.enum';

describe('location label', () => {
  it('joins a city and its region', () => {
    expect(formatLocationLabel('Лида', 'Гродненская область')).toBe('Лида, Гродненская область');
  });

  it('does not repeat a city that is its own region', () => {
    expect(formatLocationLabel('Минск', 'Минск')).toBe('Минск');
  });

  it('never shows the storage group of other cities', () => {
    expect(formatLocationLabel('Москва', OTHER_CITIES_REGION)).toBe('Москва');
  });

  it('is null when nothing is known', () => {
    expect(formatLocationLabel(null, ' ')).toBeNull();
  });
});

describe('vacancy source site', () => {
  it('names the site a vacancy came from', () => {
    expect(vacancySourceSite(VacancySource.RabotaBy)).toBe('rabota.by');
    expect(vacancySourceSite(VacancySource.HabrCareer)).toBe('career.habr.com');
    expect(vacancySourceSite('NEW_SITE')).toBe('NEW_SITE');
  });
});
