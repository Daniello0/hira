import { ReindexScope } from '@hira/contracts';

export interface ReindexClear {
  embedding: boolean;
  skillsExtractedAt: boolean;
}

/** Which vacancy marks a reindex scope clears. Taxonomy tables are not included. */
export function reindexClears(scope: ReindexScope): ReindexClear {
  if (scope === ReindexScope.Embeddings) return { embedding: true, skillsExtractedAt: false };
  return { embedding: true, skillsExtractedAt: true };
}
