import { UserRole } from '@hira/contracts';
import { Injectable } from '@nestjs/common';
import type { JWTPayload } from 'jose';
import { readJwtSecret } from './auth.config';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.constants';

export interface AccessPayload {
  userId: string;
  role: UserRole;
}

type JoseModule = typeof import('jose');

let joseModule: Promise<JoseModule> | undefined;

/** HS256 access tokens. `jose` is ESM-only, so the CommonJS build loads it with a dynamic import. */
@Injectable()
export class AccessTokenService {
  /** Signs `sub` and `role`. Email stays out of the token. */
  async sign(account: { id: string; role: UserRole }): Promise<string> {
    const { SignJWT: Signer } = await loadJose();
    return new Signer({ role: account.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(account.id)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(secretKey());
  }

  /** Returns the payload, or null when the token is missing, expired, or forged. */
  async verify(token: string): Promise<AccessPayload | null> {
    if (token.length === 0) return null;
    try {
      const { jwtVerify: verify } = await loadJose();
      const { payload } = await verify(token, secretKey(), { algorithms: ['HS256'] });
      return readPayload(payload);
    } catch {
      return null;
    }
  }
}

function loadJose(): Promise<JoseModule> {
  joseModule ??= import('jose');
  return joseModule;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(readJwtSecret(process.env));
}

function readPayload(payload: JWTPayload): AccessPayload | null {
  if (typeof payload.sub !== 'string') return null;
  if (!isUserRole(payload.role)) return null;
  return { userId: payload.sub, role: payload.role };
}

function isUserRole(value: unknown): value is UserRole {
  return value === UserRole.User || value === UserRole.Admin;
}
