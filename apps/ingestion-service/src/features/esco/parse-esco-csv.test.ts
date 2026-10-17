import { describe, expect, it } from 'vitest';
import {
  parseBroaderRelations,
  parseEscoOccupations,
  parseEscoSkills,
  parseEscoTranslations,
  parseOccupationSkillRelations,
} from './parse-esco-csv';

const SKILLS = [
  'conceptUri,conceptType,skillType,preferredLabel,altLabels,definition',
  'http://esco/skill/python,SK,skill/competence,Python,py|python3,Programming language',
  'http://esco/group/ict,SG,knowledge,ICT,,"Group"',
].join('\n');

const OCCUPATIONS = [
  'Concept URI,Concept type,Concept PT,Definition',
  'http://esco/occ/dev,OC,Developer,Writes software',
  'http://esco/occ/group,OG,ICT managers,',
].join('\n');

const RELATIONS = [
  'occupationUri,relationType,skillUri',
  'http://esco/occ/dev,essential,http://esco/skill/python',
  'http://esco/occ/dev,optional,http://esco/skill/sql',
].join('\n');

describe('ESCO CSV', () => {
  it('reads skill concepts and keeps the raw ESCO skill type unmapped', () => {
    const rows = parseEscoSkills(SKILLS);
    expect(rows).toEqual([
      {
        uri: 'http://esco/skill/python',
        label: 'Python',
        kind: 'skill',
        escoSkillType: 'skill/competence',
        altLabels: ['py', 'python3'],
        description: 'Programming language',
      },
      {
        uri: 'http://esco/group/ict',
        label: 'ICT',
        kind: 'group',
        escoSkillType: 'knowledge',
        altLabels: [],
        description: 'Group',
      },
    ]);
  });

  it('reads occupations and ignores a group row when asked for concepts only', () => {
    expect(parseEscoOccupations(OCCUPATIONS)).toEqual([
      {
        uri: 'http://esco/occ/dev',
        label: 'Developer',
        kind: 'occupation',
        description: 'Writes software',
      },
      {
        uri: 'http://esco/occ/group',
        label: 'ICT managers',
        kind: 'group',
        description: null,
      },
    ]);
  });

  it('reads essential and optional occupation links and drops an unknown relation', () => {
    const rows = parseOccupationSkillRelations(
      `${RELATIONS}\nhttp://esco/occ/dev,related,http://esco/skill/go`,
    );
    expect(rows).toEqual([
      {
        occupationUri: 'http://esco/occ/dev',
        skillUri: 'http://esco/skill/python',
        relation: 'essential',
      },
      {
        occupationUri: 'http://esco/occ/dev',
        skillUri: 'http://esco/skill/sql',
        relation: 'optional',
      },
    ]);
  });

  it('reads broader links and Russian labels', () => {
    expect(
      parseBroaderRelations(
        'conceptUri,broaderUri\nhttp://esco/skill/python,http://esco/group/ict',
      ),
    ).toEqual([{ uri: 'http://esco/skill/python', broaderUri: 'http://esco/group/ict' }]);
    expect(
      parseEscoTranslations('conceptUri,preferredLabel\nhttp://esco/skill/python,Питон\n,'),
    ).toEqual([{ uri: 'http://esco/skill/python', label: 'Питон' }]);
  });
});
