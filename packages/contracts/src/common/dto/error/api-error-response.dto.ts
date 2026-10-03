/** Error body returned by every service. Shape follows Wiki/05-api-contracts.md. */
export interface ApiErrorResponse {
  errorCode: string;
  message: string;
  details?: unknown;
  requestId: string;
}

/**
 * Builds the shared error body. Omits `details` when the caller has none.
 */
export function createApiErrorResponse(
  errorCode: string,
  message: string,
  requestId: string,
  details?: unknown,
): ApiErrorResponse {
  if (details === undefined) {
    return { errorCode, message, requestId };
  }
  return { errorCode, message, requestId, details };
}
