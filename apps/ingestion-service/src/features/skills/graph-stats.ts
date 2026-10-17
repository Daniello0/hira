/** Bouma 2009: an edge is kept only when NPMI is at least this strong. */
export const NPMI_MIN_WEIGHT = 0.2;

/** Pairs seen in fewer vacancies are not evidence. NPMI of a single co-occurrence is 1. */
export const NPMI_MIN_COOCCURRENCE = 5;

/** ESCO essential: the skill is characteristic of the occupation regardless of employer. */
export const TYPICALITY_ESSENTIAL = 1;

/** ESCO optional: the skill depends on the employer or the context. */
export const TYPICALITY_OPTIONAL = 0.5;

/**
 * Normalized PMI, ln(p(xy) / (p(x)p(y))) / -ln(p(xy)).
 * 1 means the skills only occur together, 0 means independence.
 * Returns null when the pair never co-occurs.
 */
export function normalizedPmi(
  cooccurrence: number,
  leftCount: number,
  rightCount: number,
  corpus: number,
): number | null {
  if (cooccurrence <= 0 || corpus <= 0 || leftCount <= 0 || rightCount <= 0) return null;
  const joint = cooccurrence / corpus;
  const independent = (leftCount / corpus) * (rightCount / corpus);
  if (joint <= 0 || independent <= 0) return null;
  return Math.log(joint / independent) / -Math.log(joint);
}

/** Weight in (0, 1] for a RELATED_TO edge, or null when the pair is too rare or too weak. */
export function relatedWeight(
  cooccurrence: number,
  leftCount: number,
  rightCount: number,
  corpus: number,
): number | null {
  if (cooccurrence < NPMI_MIN_COOCCURRENCE) return null;
  const score = normalizedPmi(cooccurrence, leftCount, rightCount, corpus);
  if (score === null || score < NPMI_MIN_WEIGHT) return null;
  return Math.min(score, 1);
}

/** ln(N / df). A skill in every vacancy, or in none, has no inverse frequency. */
export function skillIdf(documentFrequency: number, corpus: number): number {
  if (documentFrequency <= 0 || corpus <= 0 || documentFrequency >= corpus) return 0;
  return Math.log(corpus / documentFrequency);
}

/** Maps an ESCO occupation-skill relation onto `occupation_skills.typicality`. */
export function occupationTypicality(relation: string): number | null {
  if (relation === 'essential') return TYPICALITY_ESSENTIAL;
  if (relation === 'optional') return TYPICALITY_OPTIONAL;
  return null;
}
