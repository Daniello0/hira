import { DocumentKind, ParseStatus } from '@hira/contracts';

export const LIBRARY_SECTIONS: ReadonlyArray<{ kind: DocumentKind; title: string }> = [
  { kind: DocumentKind.Resume, title: 'Resume' },
  { kind: DocumentKind.Preferences, title: 'Preferences' },
  { kind: DocumentKind.Letter, title: 'Letters' },
  { kind: DocumentKind.Script, title: 'Scripts' },
  { kind: DocumentKind.Note, title: 'Notes' },
];

/** Markdown and text kinds. A resume is a PDF upload. */
export const TEXT_KINDS: readonly DocumentKind[] = [
  DocumentKind.Preferences,
  DocumentKind.Letter,
  DocumentKind.Script,
  DocumentKind.Note,
];

/** Short status for a parsed resume. */
export function parseStatusLabel(status: ParseStatus | null): string | null {
  if (status === ParseStatus.Success) return 'Parsed';
  if (status === ParseStatus.Failed) return 'Parse failed';
  if (status === ParseStatus.Pending) return 'Parsing';
  return null;
}
