import { describe, expect, it } from 'vitest';
import { isFetchAllowed } from './robots';

const GSZ = `User-agent: *
Allow: /
Disallow: /user/recovery-password
Disallow: /registration/resume-search/list/
`;

const HABR = `User-agent: *
Disallow: /vacancies/*/responses
Disallow: /resumes/new
`;

describe('isFetchAllowed', () => {
  it('allows a public vacancy page and blocks a disallowed path', () => {
    expect(isFetchAllowed(GSZ, '/registration/vacancy-search/')).toBe(true);
    expect(isFetchAllowed(GSZ, '/user/recovery-password')).toBe(false);
    expect(isFetchAllowed(GSZ, '/registration/resume-search/list/1')).toBe(false);
  });

  it('treats a star in a disallow rule as a single path segment gap', () => {
    expect(isFetchAllowed(HABR, '/vacancies/1000161368')).toBe(true);
    expect(isFetchAllowed(HABR, '/vacancies/1000161368/responses')).toBe(false);
    expect(isFetchAllowed(HABR, '/resumes/new')).toBe(false);
  });

  it('refuses the fetch when robots.txt itself could not be read', () => {
    expect(isFetchAllowed(null, '/vacancies/1')).toBe(false);
  });
});
