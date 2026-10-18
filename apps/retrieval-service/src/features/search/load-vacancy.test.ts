import { describe, expect, it } from 'vitest';
import { VACANCY_SQL, loadVacancies } from './load-vacancy';
import type { SqlClient } from './sql-client';

describe('loadVacancies', () => {
  it('selects the company and the place', () => {
    expect(VACANCY_SQL).toContain('company_name');
    expect(VACANCY_SQL).toContain('locations');
  });

  it('builds a location label from the joined row', async () => {
    const client: SqlClient = {
      query: async () => ({
        rows: [
          {
            id: '10000000-0000-4000-8000-000000000001',
            source: 'RABOTA_BY',
            language: 'ru',
            externalId: 'ext',
            url: 'https://example.test',
            title: 'Python',
            companyName: 'Hira Labs',
            locationCity: 'Grodno',
            locationRegion: null,
            status: 'ACTIVE',
            isForeignRemote: false,
            searchDocument: 'Python',
          },
        ],
      }),
    };
    const loaded = await loadVacancies(client, ['10000000-0000-4000-8000-000000000001']);
    expect(loaded[0]?.vacancy.companyName).toBe('Hira Labs');
    expect(loaded[0]?.vacancy.locationLabel).toBe('Grodno');
  });
});
