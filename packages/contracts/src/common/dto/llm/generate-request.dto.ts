import type { VacancyResult } from '../search/retrieval.dto';
import type { SearchIntent } from '../search/search-intent.dto';
import type { PromptTurn } from './understand.dto';

/** Body of `POST /internal/v1/generate`. The reply is an SSE stream, not this shape. */
export interface GenerateRequest {
  intent: SearchIntent;
  results: VacancyResult[];
  history: PromptTurn[];
}
