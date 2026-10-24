import type { DocumentFormat } from '../../enums/document-format.enum';

/**
 * Payload of the `document-draft` stream event.
 * Hira proposes text; nothing is written until the user confirms (ADR-024).
 */
export interface DocumentDraftDto {
  /** Suggested file title. The user may change it before saving. */
  title: string;
  format: DocumentFormat;
  content: string;
  /** Library file the request names, when the user asked to extend an existing one. */
  targetDocumentId: string | null;
  targetTitle: string | null;
}
