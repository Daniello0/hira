import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AUTH_UNAUTHORIZED } from '../../common/constants/app.constants';
import { AccessTokenService, type AccessPayload } from './access-token.service';
import { apiError } from './auth-http';

export interface RequestWithAuth extends Request {
  auth: AccessPayload;
}

/** Requires `Authorization: Bearer` and attaches the access-token payload. */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(@Inject(AccessTokenService) private readonly accessTokens: AccessTokenService) {}

  /** Rejects a missing or invalid access token with 401. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const payload = await this.accessTokens.verify(readBearer(request) ?? '');
    if (payload === null) {
      throw apiError(401, AUTH_UNAUTHORIZED, 'Authentication is required', request);
    }
    (request as RequestWithAuth).auth = payload;
    return true;
  }
}

/** User id placed by `AccessTokenGuard`. */
export function readAuth(request: Request): AccessPayload {
  return (request as RequestWithAuth).auth;
}

function readBearer(request: Request): string | null {
  const header = request.header('authorization');
  if (header === undefined) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || token === undefined || token.length === 0) return null;
  return token;
}
