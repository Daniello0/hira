import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { EscoClassification } from './import-classification';
import {
  parseBroaderRelations,
  parseEscoCollection,
  parseEscoOccupations,
  parseEscoSkills,
  parseEscoTranslations,
  parseOccupationSkillRelations,
} from './parse-esco-csv';

const SKILLS_FILE = 'skills_en.csv';
const OCCUPATIONS_FILE = 'occupations_en.csv';
const RELATIONS_FILE = 'occupationSkillRelations.csv';
const BROADER_FILE = 'broaderRelationsSkillPillar.csv';
const LANGUAGE_FILE = 'languageSkillsCollection.csv';
const TRANSVERSAL_FILE = 'transversalSkillsCollection.csv';
const DIGITAL_FILE = 'digitalSkillsCollection.csv';
const TRANSLATIONS_FILE = 'translations_ru.csv';

/** Reads an official ESCO v1.1.1 directory. Missing skills file means there is nothing to import. */
export async function loadEscoDirectory(dir: string): Promise<EscoClassification | null> {
  const skills = await readOptional(dir, SKILLS_FILE);
  if (skills === null) return null;
  const occupations = await readOptional(dir, OCCUPATIONS_FILE);
  const relations = await readOptional(dir, RELATIONS_FILE);
  const broader = await readOptional(dir, BROADER_FILE);
  const translations = await readOptional(dir, TRANSLATIONS_FILE);
  return {
    skills: parseEscoSkills(skills),
    occupations: parseEscoOccupations(occupations ?? ''),
    links: parseOccupationSkillRelations(relations ?? ''),
    collections: {
      language: parseEscoCollection((await readOptional(dir, LANGUAGE_FILE)) ?? ''),
      transversal: parseEscoCollection((await readOptional(dir, TRANSVERSAL_FILE)) ?? ''),
      digital: parseEscoCollection((await readOptional(dir, DIGITAL_FILE)) ?? ''),
    },
    broader: parseBroaderRelations(broader ?? ''),
    translations: parseEscoTranslations(translations ?? ''),
  };
}

async function readOptional(dir: string, name: string): Promise<string | null> {
  try {
    return await readFile(path.join(dir, name), 'utf8');
  } catch {
    return null;
  }
}
