import { SkillType } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { mapEscoSkillType } from './map-esco-skill-type';
import { parseEscoCollection } from './parse-esco-csv';

const none = { inLanguage: false, inTransversal: false, inDigital: false };

describe('mapEscoSkillType', () => {
  it('prefers language, then transversal, then digital', () => {
    expect(
      mapEscoSkillType({
        kind: 'skill',
        escoSkillType: 'knowledge',
        inLanguage: true,
        inTransversal: true,
        inDigital: true,
      }),
    ).toBe(SkillType.Language);
    expect(
      mapEscoSkillType({
        kind: 'skill',
        escoSkillType: 'skill/competence',
        ...none,
        inTransversal: true,
        inDigital: true,
      }),
    ).toBe(SkillType.Soft);
    expect(
      mapEscoSkillType({
        kind: 'skill',
        escoSkillType: 'knowledge',
        ...none,
        inDigital: true,
      }),
    ).toBe(SkillType.Tool);
  });

  it('maps leftover knowledge to domain and skill/competence to hard', () => {
    expect(mapEscoSkillType({ kind: 'skill', escoSkillType: 'knowledge', ...none })).toBe(
      SkillType.Domain,
    );
    expect(mapEscoSkillType({ kind: 'skill', escoSkillType: 'skill/competence', ...none })).toBe(
      SkillType.Hard,
    );
  });

  it('skips groups and skills that match neither a collection nor an ESCO skill type', () => {
    expect(mapEscoSkillType({ kind: 'group', escoSkillType: 'knowledge', ...none })).toBeNull();
    expect(mapEscoSkillType({ kind: 'skill', escoSkillType: null, ...none })).toBeNull();
    expect(mapEscoSkillType({ kind: 'skill', escoSkillType: 'attitude', ...none })).toBeNull();
  });
});

describe('parseEscoCollection', () => {
  it('reads concept URIs and ignores a blank row', () => {
    expect(
      parseEscoCollection('conceptUri\nhttp://esco/skill/python\n\nhttp://esco/skill/sql'),
    ).toEqual(['http://esco/skill/python', 'http://esco/skill/sql']);
  });
});
