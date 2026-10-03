/** How a duplicate vacancy was detected. Values follow Wiki/04-data-model.md. */
export enum DuplicateDetection {
  Exact = 'EXACT',
  Fuzzy = 'FUZZY',
  Embedding = 'EMBEDDING',
}
