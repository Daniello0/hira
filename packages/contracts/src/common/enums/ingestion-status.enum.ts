/** Outcome of one ingestion run. Values follow Wiki/04-data-model.md. */
export enum IngestionStatus {
  Running = 'RUNNING',
  Success = 'SUCCESS',
  Partial = 'PARTIAL',
  Failed = 'FAILED',
}
