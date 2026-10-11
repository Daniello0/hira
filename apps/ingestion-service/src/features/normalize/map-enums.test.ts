import { SeniorityLevel } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { mapSeniority } from './map-enums';

describe('mapSeniority', () => {
  it('treats a rabota.by "не требуется" label as no experience', () => {
    expect(mapSeniority('не требуется')).toBe(SeniorityLevel.NoExperience);
  });
});
