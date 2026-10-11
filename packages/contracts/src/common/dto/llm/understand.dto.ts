import type { MessageRole } from '../../enums/message-role.enum';
import type { SearchIntent } from '../search/search-intent.dto';
import type { LlmMeta } from './token-usage.dto';

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
}

/** Intent plus provider token counts. */
export interface UnderstandResponse {
  intent: SearchIntent;
  meta: LlmMeta;
}
