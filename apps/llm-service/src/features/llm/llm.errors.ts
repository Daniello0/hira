/** The model replied, but the payload failed the schema or the mapper. */
export class LlmOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmOutputError';
  }
}

/** The provider call failed before a usable payload was produced. */
export class ProviderTransportError extends Error {
  constructor(
    readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderTransportError';
  }
}

/** A failure the HTTP layer can turn into `ApiErrorResponse`. */
export class LlmRouteError extends Error {
  readonly details?: unknown;

  constructor(
    readonly status: number,
    readonly errorCode: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = 'LlmRouteError';
    this.details = details;
  }
}

/** A generate stream already sent a token, so the route must stay on SSE. */
export class StreamInterruptedError extends Error {
  constructor(readonly cause: unknown) {
    super('stream interrupted');
    this.name = 'StreamInterruptedError';
  }
}
