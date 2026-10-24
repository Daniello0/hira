import { DocumentFormat, type DocumentDraftDto } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { replacementPatch } from './save-draft';

const DRAFT: DocumentDraftDto = {
  title: 'Cover letter',
  format: DocumentFormat.Md,
  content: 'Hello',
  targetDocumentId: 'doc-1',
  targetTitle: 'Cover letter',
};

describe('replacementPatch', () => {
  it('writes the title edited on the card, not only the file text', () => {
    expect(replacementPatch(DRAFT, 'Cover letter Acme')).toEqual({
      title: 'Cover letter Acme',
      content: 'Hello',
    });
  });

  it('refuses a blank title instead of saving the file untitled', () => {
    expect(replacementPatch(DRAFT, '   ')).toBe('Give the file a title');
  });

  it('refuses replace when the draft is a new file', () => {
    expect(replacementPatch({ ...DRAFT, targetDocumentId: null }, 'Notes')).toBe('There is no file to replace');
  });
});
