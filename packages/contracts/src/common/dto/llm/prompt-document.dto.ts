import type { DocumentKind } from '../../enums/document-kind.enum';

/** One library file sent beside memory, not inside it. */
export interface PromptDocument {
  title: string;
  kind: DocumentKind;
  content: string;
}
