import type { AuthorKind } from '../../enums/author-kind.enum';
import type { DocumentFormat } from '../../enums/document-format.enum';
import type { DocumentKind } from '../../enums/document-kind.enum';
import type { ParseStatus } from '../../enums/parse-status.enum';

/** Library row without the extracted body. */
export interface DocumentSummaryDto {
  id: string;
  kind: DocumentKind;
  title: string;
  format: DocumentFormat;
  isPinned: boolean;
  parseStatus: ParseStatus | null;
  /** `ASSISTANT` when the user saved a draft Hira proposed. */
  createdBy: AuthorKind;
  createdAt: string;
  updatedAt: string;
}

/** One library file, including the text Hira can read. */
export interface DocumentDetailDto extends DocumentSummaryDto {
  extractedText: string;
}

/** JSON body of `POST /api/v1/documents` for Markdown and plain text. */
export interface CreateTextDocumentRequest {
  kind: DocumentKind;
  title: string;
  format: DocumentFormat;
  content: string;
  /** `true` when the user confirms a draft Hira proposed in a chat or a call. */
  fromAssistant?: boolean;
}

/** Body of `PATCH /api/v1/documents/{id}`. PDF text cannot be replaced. */
export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
  isPinned?: boolean;
}
