import { EmploymentType, WorkFormat } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { profileOf } from './typeorm-profile.store';

describe('profile row', () => {
  it('keeps work format and employment that node-pg returns as enum-array text', () => {
    const profile = profileOf({
      headline: 'dev',
      about: null,
      seniority: null,
      desired_roles: ['backend'],
      preferred_work_format: '{REMOTE,HYBRID}',
      preferred_employment: '{FULL_TIME}',
      preferred_locations: [3],
      salary_expectation_min: '2000',
      currency: 'BYN',
      education: null,
    });
    expect(profile.preferredWorkFormat).toEqual([WorkFormat.Remote, WorkFormat.Hybrid]);
    expect(profile.preferredEmployment).toEqual([EmploymentType.FullTime]);
    expect(profile.desiredRoles).toEqual(['backend']);
    expect(profile.preferredLocations).toEqual([3]);
    expect(profile.salaryExpectationMin).toBe(2000);
  });

  it('reads an empty enum array and a quoted label', () => {
    const profile = profileOf({
      preferred_work_format: '{}',
      preferred_employment: '{"FULL_TIME"}',
      preferred_locations: '{3,4}',
    });
    expect(profile.preferredWorkFormat).toEqual([]);
    expect(profile.preferredEmployment).toEqual([EmploymentType.FullTime]);
    expect(profile.preferredLocations).toEqual([3, 4]);
  });
});
