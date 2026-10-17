/** What `POST /internal/v1/reindex` clears. Values follow Wiki/05-api-contracts.md. */
export enum ReindexScope {
  Embeddings = 'EMBEDDINGS',
  Skills = 'SKILLS',
  All = 'ALL',
}
