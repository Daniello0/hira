import { describe, expect, it } from 'vitest';
import { VACANCY_CARD_SQL, toVacancyCard } from './vacancy-card';

describe('vacancy card row', () => {
  it('selects the company and the place', () => {
    expect(VACANCY_CARD_SQL).toContain('company_name');
    expect(VACANCY_CARD_SQL).toContain('locations');
  });

  it('builds a location label from city and region', () => {
    const card = toVacancyCard({
      id: '1',
      source: 'RABOTA_BY',
      language: 'ru',
      externalId: 'ext',
      url: 'https://example.test',
      title: 'Python',
      companyName: 'Hira Labs',
      locationCity: 'Minsk',
      locationRegion: 'Minsk Region',
      status: 'ACTIVE',
      isForeignRemote: false,
    });
    expect(card.companyName).toBe('Hira Labs');
    expect(card.locationLabel).toBe('Minsk, Minsk Region');
  });
});
