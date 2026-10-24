import { describe, expect, it } from 'vitest';
import { SeniorityLevel, WorkFormat } from '@hira/contracts';
import { emptyProfileForm, profileSchema, toProfileRequest } from './profile.schema';

describe('profile schema', () => {
  it('accepts a seniority from the contract and rejects an unknown one', async () => {
    const valid = await profileSchema.validate({ ...emptyProfileForm(), seniority: SeniorityLevel.Junior, preferredWorkFormat: [WorkFormat.Remote] });
    expect(valid.seniority).toBe(SeniorityLevel.Junior);
    await expect(profileSchema.validate({ ...emptyProfileForm(), seniority: 'NOPE' })).rejects.toThrow();
  });

  it('turns a blank salary into null and splits roles', () => {
    const body = toProfileRequest({ ...emptyProfileForm(), salaryExpectationMin: '  ', desiredRoles: 'QA,  Python ' });
    expect(body.salaryExpectationMin).toBeNull();
    expect(body.desiredRoles).toEqual(['QA', 'Python']);
    expect(body).not.toHaveProperty('preferredLocations');
  });
});
