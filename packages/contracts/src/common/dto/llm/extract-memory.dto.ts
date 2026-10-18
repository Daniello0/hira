import type { EmploymentType } from '../../enums/employment-type.enum';
import type { MemoryKind } from '../../enums/memory-kind.enum';
import type { MemoryOperation } from '../../enums/memory-operation.enum';
import type { ProfileSuggestionKind } from '../../enums/profile-suggestion-kind.enum';
import type { SkillLevel } from '../../enums/skill-level.enum';
import type { WorkFormat } from '../../enums/work-format.enum';
import type { PromptTurn } from './understand.dto';

/** One candidate fact. Provenance is attached by core-api, not by the model. */
export interface MemoryCandidate {
  kind: MemoryKind;
  content: string;
  confidence: number;
  operation: MemoryOperation;
  targetMemoryId?: string;
}

/** Profile change proposed in the same model call as the facts. */
export interface ExtractedSuggestion {
  kind: ProfileSuggestionKind;
  surface: string | null;
  level: SkillLevel | null;
  years: number | null;
  workFormat: WorkFormat | null;
  employment: EmploymentType | null;
  salaryMin: number | null;
  currency: string | null;
  city: string | null;
  role: string | null;
  education: string | null;
}

/** Body of `POST /internal/v1/extract-memory`. */
export interface ExtractMemoryRequest {
  messages: PromptTurn[];
  existingMemory: { id: string; kind: MemoryKind; content: string }[];
}

/** Facts plus profile suggestions from one exchange. */
export interface ExtractMemoryResponse {
  candidates: MemoryCandidate[];
  suggestions: ExtractedSuggestion[];
}
