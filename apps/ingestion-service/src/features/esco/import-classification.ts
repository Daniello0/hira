import { SkillAliasSource, type SkillType } from '@hira/contracts';
import type { SqlClient } from '../store/sql-client';
import { occupationTypicality } from '../skills/graph-stats';
import { mapEscoSkillType } from './map-esco-skill-type';
import type {
  BroaderRelation,
  EscoOccupationRow,
  EscoSkillRow,
  EscoTranslation,
  OccupationSkillLink,
} from './parse-esco-csv';

export interface EscoCollections {
  language: readonly string[];
  transversal: readonly string[];
  digital: readonly string[];
}

export interface EscoClassification {
  occupations: readonly EscoOccupationRow[];
  skills: readonly EscoSkillRow[];
  links: readonly OccupationSkillLink[];
  collections?: EscoCollections;
  broader?: readonly BroaderRelation[];
  translations?: readonly EscoTranslation[];
}

export interface ClassificationResult {
  occupations: number;
  skillsImported: number;
  skillsSkipped: number;
  links: number;
}

const EMPTY_COLLECTIONS: EscoCollections = { language: [], transversal: [], digital: [] };

/**
 * Writes ESCO occupations and skill concepts.
 * A skill group is ignored. An individual skill without a collection or ESCO skill type is skipped.
 */
export async function importEscoClassification(
  client: SqlClient,
  dump: EscoClassification,
): Promise<ClassificationResult> {
  const occupations = await insertOccupations(client, dump.occupations);
  const skills = await insertSkills(client, dump.skills, dump.collections ?? EMPTY_COLLECTIONS);
  await insertBroader(client, dump.broader ?? []);
  await insertTranslations(client, dump.translations ?? []);
  const links = await insertLinks(client, dump.links);
  return { occupations, ...skills, links };
}

async function insertOccupations(
  client: SqlClient,
  occupations: readonly EscoOccupationRow[],
): Promise<number> {
  let written = 0;
  for (const occupation of occupations) {
    if (occupation.kind !== 'occupation') continue;
    await insertOccupation(client, occupation);
    written += 1;
  }
  return written;
}

async function insertSkills(
  client: SqlClient,
  skills: readonly EscoSkillRow[],
  collections: EscoCollections,
): Promise<{ skillsImported: number; skillsSkipped: number }> {
  const membership = membershipOf(collections);
  let skillsImported = 0;
  let skillsSkipped = 0;
  for (const skill of skills) {
    const wrote = await insertMappedSkill(client, skill, membership);
    if (wrote === null) continue;
    if (wrote) skillsImported += 1;
    else skillsSkipped += 1;
  }
  return { skillsImported, skillsSkipped };
}

async function insertMappedSkill(
  client: SqlClient,
  skill: EscoSkillRow,
  membership: Membership,
): Promise<boolean | null> {
  if (skill.kind !== 'skill') return null;
  const skillType = mapEscoSkillType({
    kind: skill.kind,
    escoSkillType: skill.escoSkillType,
    inLanguage: membership.language.has(skill.uri),
    inTransversal: membership.transversal.has(skill.uri),
    inDigital: membership.digital.has(skill.uri),
  });
  if (skillType === null) return false;
  await insertSkill(client, skill, skillType);
  return true;
}

async function insertLinks(
  client: SqlClient,
  links: readonly OccupationSkillLink[],
): Promise<number> {
  let written = 0;
  for (const link of links) {
    if ((await insertLink(client, link)) > 0) written += 1;
  }
  return written;
}

interface Membership {
  language: Set<string>;
  transversal: Set<string>;
  digital: Set<string>;
}

function membershipOf(collections: EscoCollections): Membership {
  return {
    language: new Set(collections.language),
    transversal: new Set(collections.transversal),
    digital: new Set(collections.digital),
  };
}

async function insertSkill(
  client: SqlClient,
  skill: EscoSkillRow,
  skillType: SkillType,
): Promise<void> {
  const inserted = await client.query(
    `INSERT INTO skills (canonical_name, skill_type, esco_uri, description, needs_review)
     VALUES ($1, $2, $3, $4, false)
     ON CONFLICT (canonical_name) DO UPDATE SET
       skill_type = EXCLUDED.skill_type,
       esco_uri = EXCLUDED.esco_uri,
       description = EXCLUDED.description
     RETURNING id`,
    [skill.label, skillType, skill.uri, skill.description],
  );
  const skillId = Number(inserted.rows[0]?.id);
  for (const alias of skill.altLabels) await insertAlias(client, skillId, alias);
}

async function insertAlias(client: SqlClient, skillId: number, alias: string): Promise<void> {
  await client.query(
    `INSERT INTO skill_aliases (skill_id, alias, lang, source)
     VALUES ($1, $2, 'en', $3)
     ON CONFLICT (alias, lang) DO NOTHING`,
    [skillId, alias, SkillAliasSource.Esco],
  );
}

async function insertBroader(
  client: SqlClient,
  relations: readonly BroaderRelation[],
): Promise<void> {
  for (const relation of relations) {
    await insertTaxonomyEdge(client, relation.uri, relation.broaderUri, 'BROADER');
    await insertTaxonomyEdge(client, relation.broaderUri, relation.uri, 'NARROWER');
  }
}

async function insertTaxonomyEdge(
  client: SqlClient,
  sourceUri: string,
  targetUri: string,
  edgeType: 'BROADER' | 'NARROWER',
): Promise<void> {
  await client.query(
    `INSERT INTO skill_edges (source_skill_id, target_skill_id, edge_type, weight, evidence)
     SELECT source.id, target.id, $3, 1, 'TAXONOMY'
     FROM skills source, skills target
     WHERE source.esco_uri = $1 AND target.esco_uri = $2
     ON CONFLICT DO NOTHING`,
    [sourceUri, targetUri, edgeType],
  );
}

async function insertTranslations(
  client: SqlClient,
  translations: readonly EscoTranslation[],
): Promise<void> {
  for (const translation of translations) await insertRussianAlias(client, translation);
}

async function insertRussianAlias(client: SqlClient, translation: EscoTranslation): Promise<void> {
  await client.query(
    `INSERT INTO skill_aliases (skill_id, alias, lang, source)
     SELECT id, $2, 'ru', 'ESCO_TRANSLATED' FROM skills WHERE esco_uri = $1
     ON CONFLICT (alias, lang) DO NOTHING`,
    [translation.uri, translation.label],
  );
}

async function insertOccupation(client: SqlClient, occupation: EscoOccupationRow): Promise<void> {
  await client.query(
    `INSERT INTO occupations (canonical_name, esco_uri, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (canonical_name) DO UPDATE SET
       esco_uri = EXCLUDED.esco_uri,
       description = EXCLUDED.description`,
    [occupation.label, occupation.uri, occupation.description],
  );
}

async function insertLink(client: SqlClient, link: OccupationSkillLink): Promise<number> {
  const typicality = occupationTypicality(link.relation);
  if (typicality === null) return 0;
  const result = await client.query(
    `INSERT INTO occupation_skills (occupation_id, skill_id, typicality)
     SELECT occupations.id, skills.id, $3
     FROM occupations, skills
     WHERE occupations.esco_uri = $1 AND skills.esco_uri = $2
     ON CONFLICT DO NOTHING`,
    [link.occupationUri, link.skillUri, typicality],
  );
  return result.rowCount ?? 0;
}
