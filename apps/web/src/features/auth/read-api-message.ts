/** Text from an API error body. Anything that is not JSON uses the fallback. */
export async function readApiMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === 'string' && body.message.trim().length > 0) return body.message;
    return fallback;
  } catch {
    return fallback;
  }
}
