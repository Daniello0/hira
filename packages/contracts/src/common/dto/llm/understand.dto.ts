import type { MessageRole } from '../../enums/message-role.enum';
import type { SearchIntent } from '../search/search-intent.dto';
import type { LlmMeta } from './token-usage.dto';
import type { PromptDocument } from './prompt-document.dto';

/** One prior turn sent into query understanding. */
export interface PromptTurn {
  role: MessageRole;
  content: string;
}

/** One memory fact sent as text. The service does not resolve fact ids. */
export interface PromptMemory {
  content: string;
}

/** Body of `POST /internal/v1/understand`. Shape follows Wiki/05-api-contracts.md. */
export interface UnderstandRequest {
  query: string;
  history: PromptTurn[];
  memory: PromptMemory[];
  summary?: string | null;
  documents?: PromptDocument[];
  /** Vacancies the user may refer to: saved, or shown in this conversation. */
  knownVacancies?: string[];
}

/** Intent plus provider token counts. */
export interface UnderstandResponse {
  intent: SearchIntent;
  meta: LlmMeta;
}
