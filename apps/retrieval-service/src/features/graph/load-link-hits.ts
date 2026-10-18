import type { SkillMention } from '@hira/contracts';
import { vectorLiteral } from '../dense/embed-query';
import { TRIGRAM_MATCH_THRESHOLD, VECTOR_MATCH_THRESHOLD } from '../search/search.constants';
import type { SqlClient } from '../search/sql-client';
import { linkMention, linkQuerySkill, type LinkHit, type LinkedSkill } from './link-query-skill';

/** Database and encoder the cascade needs. Tests pass fakes. */
export interface LinkDeps {
  knownIds(ids: readonly number[]): Promise<ReadonlySet<number>>;
  hits(surface: string, vector: string | null): Promise<LinkHit[]>;
  embed(texts: readonly string[]): Promise<number[][]>;
}

const DECIMAL_ID = /^[1-9]\d*$/;

/**
 * Resolves query skills without creating nodes.
 * Vector step runs once, and only for surfaces the trigram step missed.
 */
export async function resolveQuerySkills(
  mentions: readonly SkillMention[],
  deps: LinkDeps,
): Promise<LinkedSkill[]> {
  const known = await deps.knownIds(decimalIds(mentions));
  const pending = mentions.filter((mention) => needsCascade(mention, known));
  const plain = await loadHits(pending, deps, null);
  const missed = pending.filter(
    (mention, index) => linkQuerySkill(mention.surface, plain[index] ?? []) === null,
  );
  const vectors = await embedMisses(missed, deps);
  const scored = await loadHits(missed, deps, vectors);
  return mentions.flatMap((mention) =>
    linkedMention(mention, known, pending, plain, missed, scored),
  );
}

/** Skills whose ids are already stored. An empty list does not touch the database. */
export async function loadKnownIds(
  client: SqlClient,
  ids: readonly number[],
): Promise<ReadonlySet<number>> {
  if (ids.length === 0) return new Set();
  const result = await client.query('SELECT id FROM skills WHERE id = ANY($1::int[])', [ids]);
  return new Set(result.rows.map((row) => Number(row.id)));
}

/** Loads cascade scores for one surface. A null vector skips the cosine step. */
export async function loadLinkHits(
  client: SqlClient,
  surface: string,
  vector: string | null,
): Promise<LinkHit[]> {
  if (surface.trim().length === 0) return [];
  const result = await client.query(HITS_SQL, [surface.trim(), vector]);
  return result.rows.map(readHit);
}

async function embedMisses(
  missed: readonly SkillMention[],
  deps: LinkDeps,
): Promise<number[][] | null> {
  if (missed.length === 0) return null;
  return deps.embed(missed.map((mention) => mention.surface.trim()));
}

async function loadHits(
  mentions: readonly SkillMention[],
  deps: LinkDeps,
  vectors: number[][] | null,
): Promise<LinkHit[][]> {
  return Promise.all(
    mentions.map((mention, index) => deps.hits(mention.surface.trim(), vectorOf(vectors, index))),
  );
}

function linkedMention(
  mention: SkillMention,
  known: ReadonlySet<number>,
  pending: readonly SkillMention[],
  plain: readonly LinkHit[][],
  missed: readonly SkillMention[],
  scored: readonly LinkHit[][],
): LinkedSkill[] {
  const linked = linkMention(mention, known, hitsFor(mention, pending, plain, missed, scored));
  return linked === null ? [] : [linked];
}

function hitsFor(
  mention: SkillMention,
  pending: readonly SkillMention[],
  plain: readonly LinkHit[][],
  missed: readonly SkillMention[],
  scored: readonly LinkHit[][],
): LinkHit[] {
  const missedIndex = missed.indexOf(mention);
  if (missedIndex >= 0) return scored[missedIndex] ?? [];
  const pendingIndex = pending.indexOf(mention);
  return pendingIndex < 0 ? [] : (plain[pendingIndex] ?? []);
}

function needsCascade(mention: SkillMention, known: ReadonlySet<number>): boolean {
  const id = parsedId(mention.canonicalId);
  return mention.surface.trim().length > 0 && (id === null || !known.has(id));
}

function decimalIds(mentions: readonly SkillMention[]): number[] {
  return mentions.flatMap((mention) => {
    const id = parsedId(mention.canonicalId);
    return id === null ? [] : [id];
  });
}

function parsedId(value: string | null): number | null {
  if (value === null || !DECIMAL_ID.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function vectorOf(vectors: number[][] | null, index: number): string | null {
  if (vectors === null) return null;
  return vectorLiteral(vectors[index] ?? []);
}

function readHit(row: Record<string, unknown>): LinkHit {
  return {
    skillId: Number(row.skillId),
    exactName: row.exactName === true,
    exactAlias: row.exactAlias === true,
    trigram: Number(row.trigram),
    cosine: Number(row.cosine),
  };
}

const HITS_SQL = `SELECT s.id AS "skillId",
  lower(trim(s.canonical_name)) = lower(trim($1)) AS "exactName",
  EXISTS (
    SELECT 1 FROM skill_aliases a
    WHERE a.skill_id = s.id AND lower(trim(a.alias)) = lower(trim($1))
  ) AS "exactAlias",
  GREATEST(
    similarity(s.canonical_name, $1),
    COALESCE((SELECT MAX(similarity(a.alias, $1)) FROM skill_aliases a WHERE a.skill_id = s.id), 0)
  ) AS trigram,
  CASE
    WHEN $2::vector IS NULL OR s.embedding IS NULL THEN 0
    ELSE 1 - (s.embedding <=> $2::vector)
  END AS cosine
  FROM skills s
  WHERE lower(trim(s.canonical_name)) = lower(trim($1))
     OR EXISTS (
       SELECT 1 FROM skill_aliases a
       WHERE a.skill_id = s.id AND lower(trim(a.alias)) = lower(trim($1))
     )
     OR similarity(s.canonical_name, $1) >= ${TRIGRAM_MATCH_THRESHOLD}
     OR COALESCE((SELECT MAX(similarity(a.alias, $1)) FROM skill_aliases a WHERE a.skill_id = s.id), 0)
          >= ${TRIGRAM_MATCH_THRESHOLD}
     OR (
       $2::vector IS NOT NULL AND s.embedding IS NOT NULL
       AND 1 - (s.embedding <=> $2::vector) >= ${VECTOR_MATCH_THRESHOLD}
     )`;
