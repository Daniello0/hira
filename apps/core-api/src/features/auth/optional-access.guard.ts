import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AUTH_UNAUTHORIZED } from '../../common/constants/app.constants';
import { apiError } from './auth-http';
import { AccessTokenService, type AccessPayload } from './access-token.service';
import { readAuth, type RequestWithAuth } from './access-token.guard';

/** Accepts a bearer token when one is sent, and leaves anonymous calls for the demo cookie. */
@Injectable()
export class OptionalAccessGuard implements CanActivate {
  constructor(@Inject(AccessTokenService) private readonly accessTokens: AccessTokenService) {}

  /** A missing header is anonymous. A present but invalid token is 401. */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = readBearer(request);
    if (token === null) return true;
    const payload = await this.accessTokens.verify(token);
    if (payload === null) {
      throw apiError(401, AUTH_UNAUTHORIZED, 'Authentication is required', request);
    }
    (request as RequestWithAuth).auth = payload;
    return true;
  }
}

/** User payload when the optional guard accepted a bearer token. */
export function readOptionalAuth(request: Request): AccessPayload | null {
  if (!('auth' in request)) return null;
  return readAuth(request);
}

function readBearer(request: Request): string | null {
  const header = request.header('authorization');
  if (header === undefined) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || token === undefined || token.length === 0) return null;
  return token;
}
