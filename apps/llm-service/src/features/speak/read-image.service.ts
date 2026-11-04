import { z } from 'zod';
import {
  MAX_TOKENS,
  OPENROUTER_CHAT_COMPLETIONS_PATH,
  OPENROUTER_EXCLUDE_REASONING,
  OPENROUTER_REASONING_EFFORT,
  READ_IMAGE_PROMPT,
  READ_IMAGE_TIMEOUT_MS,
} from '../llm/llm.constants';
import { reachable, upstreamError } from './voice-upstream';

const readImageSchema = z.object({
  image: z.instanceof(Buffer).refine((image) => image.length > 0, 'image is required'),
  type: z.string().regex(/^image\/[a-z0-9.+-]+$/),
});

export type ReadImageRequest = z.infer<typeof readImageSchema>;

/** Reads `POST /internal/v1/read-image`: the picture as the body, `?type=` its media type. */
export function parseReadImageRequest(image: unknown, type: unknown): ReadImageRequest {
  return readImageSchema.parse({ image: Buffer.isBuffer(image) ? image : Buffer.alloc(0), type });
}

/** What a picture says and shows, in words, from Hira's own model: it reads images too. */
export function createImageReader(config: { apiKey: string; baseUrl: string; model: string }, request: typeof fetch = fetch) {
  return async ({ image, type }: ReadImageRequest): Promise<{ text: string }> => {
    const response = await reachable(() =>
      request(`${config.baseUrl.replace(/\/$/, '')}${OPENROUTER_CHAT_COMPLETIONS_PATH}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          max_tokens: MAX_TOKENS.readImage,
          temperature: 0,
          reasoning: { effort: OPENROUTER_REASONING_EFFORT, exclude: OPENROUTER_EXCLUDE_REASONING },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: READ_IMAGE_PROMPT },
                { type: 'image_url', image_url: { url: `data:${type};base64,${image.toString('base64')}` } },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(READ_IMAGE_TIMEOUT_MS),
      }),
    );
    if (!response.ok) throw upstreamError();
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
    const text = body.choices?.[0]?.message?.content;
    return { text: typeof text === 'string' ? text.trim() : '' };
  };
}
