import { createApiErrorResponse } from '@hira/contracts';
import { HttpStatus } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { readRequestId } from '../../common/interceptors/request-id.interceptor';
import {
  AUTH_UNAUTHORIZED,
  RATE_LIMIT_ERROR_CODE,
  VALIDATION_ERROR_CODE,
} from '../../common/constants/app.constants';
import { ApiHttpException } from '../../common/filters/api-http.exception';
import { readWebOrigin } from './auth.config';
import {
  AUTH_EMAIL_TAKEN,
  AUTH_INVALID_CREDENTIALS,
  AUTH_REFRESH_INVALID,
  AUTH_REFRESH_REUSED,
  CLIENT_IP_MAX_LENGTH,
  CLIENT_USER_AGENT_MAX_LENGTH,
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_SECONDS,
} from './auth.constants';
import {
  InvalidCredentialsError,
  LoginLimitedError,
  RefreshInvalidError,
  RefreshReusedError,
  UnauthorizedError,
} from './auth.errors';
import { EmailTakenError } from './user.store';
import { WeakPasswordError } from './password-policy';
import type { ClientMeta } from './refresh-token.store';
import type { IssuedSession } from './auth.service';
import type { AuthSessionDto } from '@hira/contracts';

/** `Secure` follows the web origin: Safari drops a `Secure` cookie on `http://localhost`. */
function secureCookies(): boolean {
  return readWebOrigin(process.env).startsWith('https://');
}

/** Cookie flags from Wiki/07: httpOnly, SameSite=Strict, and Secure on https. */
export function sessionCookieOptions(maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    secure: secureCookies(),
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  };
}

/** Options that must match the setter, or `clearCookie` will not remove the cookie. */
export function clearSessionCookieOptions(): CookieOptions {
  return { httpOnly: true, secure: secureCookies(), sameSite: 'strict', path: '/' };
}

/** Writes the refresh cookie. */
export function setRefreshCookie(response: Response, refreshToken: string): void {
  response.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    sessionCookieOptions(REFRESH_TOKEN_TTL_SECONDS),
  );
}

/** Removes the refresh cookie. */
export function clearRefreshCookie(response: Response): void {
  response.clearCookie(REFRESH_COOKIE_NAME, clearSessionCookieOptions());
}

/** Reads the refresh cookie. An empty value is treated as missing. */
export function readRefreshCookie(request: Request): string | undefined {
  return readCookie(request, REFRESH_COOKIE_NAME);
}

/** IP and user agent stored beside the refresh-token hash. Both are clipped to the column width. */
export function clientMeta(request: Request): ClientMeta {
  return {
    ip: clip(request.ip, CLIENT_IP_MAX_LENGTH),
    userAgent: clip(request.header('user-agent'), CLIENT_USER_AGENT_MAX_LENGTH),
  };
}

/** JSON body. The raw refresh token stays in the cookie. */
export function sessionBody(session: IssuedSession): AuthSessionDto {
  return { accessToken: session.accessToken, expiresIn: session.expiresIn };
}

/** Maps auth failures onto the shared error body. Unknown errors return null so the filter can log them. */
export function mapAuthError(error: unknown, request: Request): ApiHttpException | null {
  if (error instanceof WeakPasswordError) return weakPassword(error, request);
  if (error instanceof EmailTakenError)
    return statusError(HttpStatus.CONFLICT, AUTH_EMAIL_TAKEN, error, request);
  if (error instanceof InvalidCredentialsError) {
    return statusError(HttpStatus.UNAUTHORIZED, AUTH_INVALID_CREDENTIALS, error, request);
  }
  if (error instanceof RefreshReusedError) {
    return statusError(HttpStatus.UNAUTHORIZED, AUTH_REFRESH_REUSED, error, request);
  }
  if (error instanceof RefreshInvalidError) {
    return statusError(HttpStatus.UNAUTHORIZED, AUTH_REFRESH_INVALID, error, request);
  }
  if (error instanceof UnauthorizedError) {
    return statusError(HttpStatus.UNAUTHORIZED, AUTH_UNAUTHORIZED, error, request);
  }
  if (error instanceof LoginLimitedError) return loginLimited(error, request);
  return null;
}

/** Builds an `ApiHttpException` for a request. */
export function apiError(
  status: number,
  errorCode: string,
  message: string,
  request: Request,
  details?: unknown,
  retryAfterSeconds?: number,
): ApiHttpException {
  return new ApiHttpException(
    status,
    createApiErrorResponse(errorCode, message, readRequestId(request), details),
    retryAfterSeconds,
  );
}

function weakPassword(error: WeakPasswordError, request: Request): ApiHttpException {
  return apiError(HttpStatus.BAD_REQUEST, VALIDATION_ERROR_CODE, error.message, request, {
    fields: { password: error.message },
  });
}

function loginLimited(error: LoginLimitedError, request: Request): ApiHttpException {
  return apiError(
    HttpStatus.TOO_MANY_REQUESTS,
    RATE_LIMIT_ERROR_CODE,
    error.message,
    request,
    undefined,
    error.retryAfterSeconds,
  );
}

function statusError(
  status: number,
  errorCode: string,
  error: Error,
  request: Request,
): ApiHttpException {
  return apiError(status, errorCode, error.message, request);
}

function readCookie(request: Request, name: string): string | undefined {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function clip(value: string | undefined, max: number): string | null {
  if (value === undefined || value.length === 0) return null;
  return value.slice(0, max);
}
