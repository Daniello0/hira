/** A file the user put into a chat message, read to text on the server. */
export interface MessageAttachment {
  name: string;
  text: string;
}

/** What `POST /api/v1/documents/read` answers for one file. */
export interface ReadAttachmentDto extends MessageAttachment {
  /** The text looks like a resume or a CV, so the chat can offer to add it to the profile. */
  looksLikeResume: boolean;
  /** The file was longer than Hira reads; only its start is in `text`. */
  truncated: boolean;
}

/** Files one message can carry, and how much of each Hira reads. */
export const MAX_MESSAGE_ATTACHMENTS = 3;
export const ATTACHMENT_TEXT_MAX_CHARS = 20_000;
export const ATTACHMENT_NAME_MAX_CHARS = 200;

const OPEN = '<<<file: ';
const OPEN_END = '>>>';
const CLOSE = '<<<end of file>>>';

/**
 * The stored message: the user's words, then each file between markers. The model reads the files from
 * there, and the chat shows them as chips instead of their text.
 */
export function withAttachments(content: string, attachments: readonly MessageAttachment[] = []): string {
  const blocks = attachments.map((file) => `${OPEN}${file.name.replaceAll('>', '')}${OPEN_END}\n${file.text.trim()}\n${CLOSE}`);
  return [content.trim(), ...blocks].filter((part) => part.length > 0).join('\n\n');
}

/** The message with each file cut to its start: enough to tell what the user wants, short enough to do it fast. */
export function withAttachmentHeads(content: string, headChars: number): string {
  const { text, attachments } = splitAttachments(content);
  if (attachments.length === 0) return content;
  return withAttachments(text, attachments.map((file) => ({ name: file.name, text: file.text.length > headChars ? `${file.text.slice(0, headChars)}…` : file.text })));
}

/** The user's words and the files of a stored message. A message without files comes back as it is. */
export function splitAttachments(content: string): { text: string; attachments: MessageAttachment[] } {
  const attachments: MessageAttachment[] = [];
  let rest = content;
  let start = rest.indexOf(OPEN);
  const text = start < 0 ? content : content.slice(0, start).trim();
  while (start >= 0) {
    const nameEnd = rest.indexOf(OPEN_END, start + OPEN.length);
    const close = nameEnd < 0 ? -1 : rest.indexOf(CLOSE, nameEnd);
    if (close < 0) return { text: content, attachments: [] };
    attachments.push({ name: rest.slice(start + OPEN.length, nameEnd), text: rest.slice(nameEnd + OPEN_END.length, close).trim() });
    rest = rest.slice(close + CLOSE.length);
    start = rest.indexOf(OPEN);
  }
  return { text, attachments };
}
