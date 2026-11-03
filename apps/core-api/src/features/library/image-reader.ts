import { LibraryInputError } from './library.service';
import type { ImageReader } from './read-attachment';

export const IMAGE_READER = Symbol('IMAGE_READER');
/** A picture goes to the language model once; a slow answer still beats no answer. */
export const READ_IMAGE_TIMEOUT_MS = 40_000;
export const IMAGE_UNREADABLE_MESSAGE = 'Hira could not read the picture. Try again or send it as a PDF.';

/** Reads a picture through llm-service, which alone holds the provider key. */
export function createImageReader(options: { baseUrl: string; token: string }, request: typeof fetch = fetch): ImageReader {
  return async (image, type) => {
    const response = await request(`${options.baseUrl.replace(/\/$/, '')}/internal/v1/read-image?type=${encodeURIComponent(type)}`, {
      method: 'POST',
      headers: { 'content-type': type, 'X-Internal-Token': options.token },
      body: new Uint8Array(image),
      signal: AbortSignal.timeout(READ_IMAGE_TIMEOUT_MS),
    }).catch(() => null);
    if (response === null || !response.ok) throw new LibraryInputError(IMAGE_UNREADABLE_MESSAGE);
    const body = (await response.json()) as { text?: unknown };
    return typeof body.text === 'string' ? body.text : '';
  };
}
