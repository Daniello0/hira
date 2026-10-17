import { SkillAliasSource, SkillEdgeType, type SkillType } from '@hira/contracts';

/** One ESCO concept already mapped onto `SkillType`. Raw ESCO type codes are not accepted here. */
export interface EscoConcept {
  uri: string;
  preferredLabel: string;
  altLabels: readonly string[];
  skillType: SkillType;
  broaderUri: string | null;
}

export interface PlannedAlias {
  alias: string;
  lang: 'en' | 'ru';
  source: SkillAliasSource;
}

export interface PlannedSkill {
  canonicalName: string;
  escoUri: string;
  skillType: SkillType;
  aliases: PlannedAlias[];
}

export interface PlannedEdge {
  sourceUri: string;
  targetUri: string;
  edgeType: SkillEdgeType;
  weight: number;
  evidence: 'TAXONOMY';
}

export interface EscoPlan {
  skills: PlannedSkill[];
  edges: PlannedEdge[];
  collisions: string[];
  occupations: [];
}

/** Plans an ESCO fixture import. Duplicate labels are reported and skipped. */
export function planEscoImport(
  concepts: readonly EscoConcept[],
  translations: ReadonlyMap<string, string> | null,
): EscoPlan {
  const accepted = acceptConcepts(concepts);
  const aliases = planAliases(accepted.skills, translations, accepted.collisions);
  return {
    skills: aliases,
    edges: planEdges(accepted.skills),
    collisions: accepted.collisions,
    occupations: [],
  };
}

function acceptConcepts(concepts: readonly EscoConcept[]): {
  skills: EscoConcept[];
  collisions: string[];
} {
  const seen = new Set<string>();
  const skills: EscoConcept[] = [];
  const collisions: string[] = [];
  for (const concept of concepts) pushConcept(concept, seen, skills, collisions);
  return { skills, collisions };
}

function pushConcept(
  concept: EscoConcept,
  seen: Set<string>,
  skills: EscoConcept[],
  collisions: string[],
): void {
  if (seen.has(concept.preferredLabel)) {
    collisions.push(concept.uri);
    return;
  }
  seen.add(concept.preferredLabel);
  skills.push(concept);
}

function planAliases(
  concepts: readonly EscoConcept[],
  translations: ReadonlyMap<string, string> | null,
  collisions: string[],
): PlannedSkill[] {
  const used = new Set<string>();
  return concepts.map((concept) => toSkill(concept, translations, used, collisions));
}

function toSkill(
  concept: EscoConcept,
  translations: ReadonlyMap<string, string> | null,
  used: Set<string>,
  collisions: string[],
): PlannedSkill {
  const aliases = concept.altLabels.flatMap((alias) =>
    takeAlias(alias, 'en', SkillAliasSource.Esco, used, collisions),
  );
  const translated = translations?.get(concept.uri) ?? '';
  return {
    canonicalName: concept.preferredLabel,
    escoUri: concept.uri,
    skillType: concept.skillType,
    aliases: [
      ...aliases,
      ...takeAlias(translated, 'ru', SkillAliasSource.EscoTranslated, used, collisions),
    ],
  };
}

function takeAlias(
  alias: string,
  lang: 'en' | 'ru',
  source: SkillAliasSource,
  used: Set<string>,
  collisions: string[],
): PlannedAlias[] {
  const label = alias.trim();
  if (label.length === 0) return [];
  const key = `${lang}\n${label}`;
  if (used.has(key)) {
    collisions.push(label);
    return [];
  }
  used.add(key);
  return [{ alias: label, lang, source }];
}

function planEdges(concepts: readonly EscoConcept[]): PlannedEdge[] {
  const uris = new Set(concepts.map((concept) => concept.uri));
  return concepts.flatMap((concept) => edgesFor(concept, uris));
}

function edgesFor(concept: EscoConcept, uris: Set<string>): PlannedEdge[] {
  if (concept.broaderUri === null || !uris.has(concept.broaderUri)) return [];
  return [
    edge(concept.uri, concept.broaderUri, SkillEdgeType.Broader),
    edge(concept.broaderUri, concept.uri, SkillEdgeType.Narrower),
  ];
}

function edge(sourceUri: string, targetUri: string, edgeType: SkillEdgeType): PlannedEdge {
  return { sourceUri, targetUri, edgeType, weight: 1, evidence: 'TAXONOMY' };
}
