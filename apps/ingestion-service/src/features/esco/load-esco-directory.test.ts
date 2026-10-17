import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadEscoDirectory } from './load-esco-directory';

describe('loadEscoDirectory', () => {
  it('returns null until skills_en.csv is present', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'esco-'));
    expect(await loadEscoDirectory(dir)).toBeNull();
  });

  it('reads the official filenames into one classification', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'esco-'));
    await writeFile(
      path.join(dir, 'skills_en.csv'),
      'conceptUri,conceptType,skillType,preferredLabel,altLabels,definition\nhttp://esco/skill/python,SK,knowledge,Python,,Language\n',
    );
    await writeFile(
      path.join(dir, 'occupations_en.csv'),
      'Concept URI,Concept type,Concept PT,Definition\nhttp://esco/occ/dev,OC,Developer,Writes software\n',
    );
    await writeFile(
      path.join(dir, 'languageSkillsCollection.csv'),
      'conceptUri\nhttp://esco/skill/python\n',
    );
    await writeFile(
      path.join(dir, 'broaderRelationsSkillPillar.csv'),
      'conceptUri,broaderUri\nhttp://esco/skill/python,http://esco/group/ict\n',
    );
    await writeFile(
      path.join(dir, 'translations_ru.csv'),
      'conceptUri,preferredLabel\nhttp://esco/skill/python,Питон\n',
    );
    const dump = await loadEscoDirectory(dir);
    expect(dump?.skills[0]?.label).toBe('Python');
    expect(dump?.occupations[0]?.label).toBe('Developer');
    expect(dump?.collections?.language).toEqual(['http://esco/skill/python']);
    expect(dump?.broader).toEqual([
      { uri: 'http://esco/skill/python', broaderUri: 'http://esco/group/ict' },
    ]);
    expect(dump?.translations).toEqual([{ uri: 'http://esco/skill/python', label: 'Питон' }]);
  });
});
