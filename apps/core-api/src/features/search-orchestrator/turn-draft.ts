import { DocumentFormat, IntentType, type DocumentDraftDto, type PromptDocument } from '@hira/contracts';
import type { Caller } from '../chat/resolve-actor';
import type { DraftTarget } from '../library/draft-target';
import { DRAFT_TITLE_MAX_CHARS, DRAFT_TITLE_MAX_WORDS, DRAFT_TITLE_RULES } from './draft.constants';
import type { OrchestratorDeps, Understood } from './turn.types';

/** True for turns that end with a `document-draft` event. Demo sessions have no library. */
export function isDraftTurn(caller: Caller, understood: Understood): boolean {
  return caller.kind === 'user' && understood.intent.intentType === IntentType.DraftDocument;
}

/** The library file the message names, when the turn is a draft. A lookup failure is logged and ignored. */
export async function loadDraftTarget(
  deps: OrchestratorDeps,
  caller: Caller,
  understood: Understood,
  text: string,
): Promise<DraftTarget | null> {
  if (!isDraftTurn(caller, understood) || caller.kind !== 'user' || deps.drafts === undefined) return null;
  try {
    return await deps.drafts.draftTarget(caller.userId, text);
  } catch (error) {
    deps.logger.warn({ err: error }, 'draft target lookup failed; drafting a new file');
    return null;
  }
}

/** The target's full text as a prompt document, so the model rewrites it rather than starting over. */
export function targetDocument(target: DraftTarget | null): PromptDocument | null {
  if (target === null) return null;
  return { title: target.title, kind: target.kind, content: target.content };
}

/** Payload of `event: document-draft`. Nothing is stored until the user confirms. */
export function draftEvent(message: string, content: string, target: DraftTarget | null): DocumentDraftDto {
  return {
    title: target?.title ?? draftTitle(message),
    format: DocumentFormat.Md,
    content: content.trim(),
    targetDocumentId: target?.id ?? null,
    targetTitle: target?.title ?? null,
  };
}

/** Title guessed from the request: a known document word, else its first words. No model call. */
export function draftTitle(message: string): string {
  const lower = message.toLowerCase();
  const rule = DRAFT_TITLE_RULES.find((candidate) => candidate.stems.some((stem) => lower.includes(stem)));
  if (rule !== undefined) return rule.title;
  const words = message.trim().split(/\s+/u).slice(0, DRAFT_TITLE_MAX_WORDS).join(' ');
  return Array.from(words).slice(0, DRAFT_TITLE_MAX_CHARS).join('') || DRAFT_TITLE_RULES[DRAFT_TITLE_RULES.length - 1].title;
}
