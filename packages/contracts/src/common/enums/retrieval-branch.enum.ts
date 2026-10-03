/**
 * Retrieval branch selected for a search or an ablation.
 * Sparse BGE-M3 stays inside the lexical branch; it is not a fourth value.
 */
export enum RetrievalBranch {
  Lexical = 'LEXICAL',
  Dense = 'DENSE',
  Graph = 'GRAPH',
}
