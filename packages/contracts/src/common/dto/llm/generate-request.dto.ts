import type { VoiceLanguage } from '../../enums/voice-language.enum';
import type { VacancyResult } from '../search/retrieval.dto';
import type { SearchIntent } from '../search/search-intent.dto';
import type { PromptDocument } from './prompt-document.dto';
import type { TurnFacts } from './turn-facts.dto';
import type { PromptTurn } from './understand.dto';

/** Body of `POST /internal/v1/generate`. The reply is an SSE stream, not this shape. */
export interface GenerateRequest {
  intent: SearchIntent;
  results: VacancyResult[];
  history: PromptTurn[];
  summary?: string | null;
  documents?: PromptDocument[];
  facts?: TurnFacts;
  /** This reply will be spoken on a call. `language` is set when the user chose one. */
  voice?: { language: VoiceLanguage | null };
}
