import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@hira/contracts';
import type { Response as SupertestResponse } from 'supertest';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { CLOCK, type Clock } from '../../common/utils/clock';
import { configureHttpApp } from '../../configure-http-app';
import { AppModule } from '../../app.module';
import { COUNTER_STORE } from '../redis/counter.store';
import { MemoryCounterStore } from '../redis/memory-counter.store';
import { PASSWORD_HASHER, type PasswordHasher } from './password.hasher';
import { decideRefresh } from './refresh-decision';
import {
  REFRESH_TOKEN_STORE,
  type ClientMeta,
  type RefreshTokenStore,
  type RotateResult,
} from './refresh-token.store';
import { hashToken, newRefreshToken, refreshExpiry } from './token-hash';
import {
  EmailTakenError,
  USER_STORE,
  type Account,
  type NewAccount,
  type UserStore,
} from './user.store';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS } from './auth.constants';

const NOW = new Date('2026-10-11T12:00:00.000Z');
const PASSWORD = 'correct-horse';
const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

describe('auth http', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('registers, reads the profile, and keeps email out of the access token', async () => {
    app = await createApp();
    const registered = await register(app, 'Ada@Example.com');
    expect(registered.status).toBe(201);
    expect(registered.body).toEqual({
      accessToken: expect.any(String),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
    expect(cookieFlags(registered, 'refreshToken')).toContain('HttpOnly');
    expect(cookieFlags(registered, 'refreshToken')).toContain('Secure');
    expect(cookieFlags(registered, 'refreshToken').toLowerCase()).toContain('samesite=strict');
    expect(cookieFlags(registered, 'refreshToken')).toContain(
      `Max-Age=${REFRESH_TOKEN_TTL_SECONDS}`,
    );
    const payload = jwtPayload(registered.body.accessToken as string);
    expect(payload.email).toBeUndefined();
    expect(payload.role).toBe('USER');

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registered.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body).toEqual({
      id: payload.sub,
      email: 'ada@example.com',
      displayName: 'Ada',
      role: 'USER',
      crossChatMemoryEnabled: true,
    });
  });

  it('rotates a refresh token and revokes the family when a revoked token is reused', async () => {
    app = await createApp();
    const registered = await register(app);
    const loggedIn = await login(app);
    const firstCookie = cookieValue(registered, 'refreshToken');
    const secondCookie = cookieValue(loggedIn, 'refreshToken');
    const rotated = await refresh(app, firstCookie);
    expect(rotated.status).toBe(200);
    const thirdCookie = cookieValue(rotated, 'refreshToken');
    expect(thirdCookie).not.toBe(firstCookie);

    const reused = await refresh(app, firstCookie);
    expect(reused.status).toBe(401);
    expect(reused.body.errorCode).toBe('AUTH_REFRESH_REUSED');
    expect((await refresh(app, thirdCookie)).body.errorCode).toBe('AUTH_REFRESH_REUSED');
    expect((await refresh(app, secondCookie)).body.errorCode).toBe('AUTH_REFRESH_REUSED');

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registered.body.accessToken}`);
    expect(me.status).toBe(200);
  });

  it('revokes the refresh token on logout without dropping the access token early', async () => {
    app = await createApp();
    const registered = await register(app);
    const rawCookie = cookieValue(registered, 'refreshToken');
    const loggedOut = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', `refreshToken=${rawCookie}`);
    expect(loggedOut.status).toBe(204);
    expect((await refresh(app, rawCookie)).body.errorCode).toBe('AUTH_REFRESH_REUSED');
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registered.body.accessToken}`);
    expect(me.status).toBe(200);
  });

  it('rejects invalid input, a compromised password, a duplicate email, and a forged role', async () => {
    app = await createApp();
    const invalid = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('X-Request-Id', 'req-auth')
      .send({ email: 'not-an-email', password: 'short' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.errorCode).toBe('VALIDATION_FAILED');
    expect(invalid.body.requestId).toBe('req-auth');

    const common = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'ada@example.com', password: 'password1234' });
    expect(common.status).toBe(400);
    expect(common.body.details.fields.password).toMatch(/compromised/);

    expect((await register(app)).status).toBe(201);
    const duplicate = await register(app);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.errorCode).toBe('AUTH_EMAIL_TAKEN');

    const forged = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'other@example.com', password: PASSWORD, role: 'ADMIN' });
    expect(forged.status).toBe(400);
  });

  it('hides unknown emails and locks the sixth failed login', async () => {
    app = await createApp();
    const unknown = await login(app, 'missing@example.com');
    expect(unknown.status).toBe(401);
    expect(unknown.body.errorCode).toBe('AUTH_INVALID_CREDENTIALS');
    await app.close();

    app = await createApp();
    await register(app);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect((await login(app, 'ada@example.com', 'wrong-password-1')).status).toBe(401);
    }
    expect((await login(app)).status).toBe(200);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await login(app, 'ada@example.com', 'wrong-password-1')).status).toBe(401);
    }
    const locked = await login(app, 'ada@example.com', 'wrong-password-1');
    expect(locked.status).toBe(429);
    expect(locked.body.errorCode).toBe('RATE_LIMIT_EXCEEDED');
    expect(locked.headers['retry-after']).toBe('2');
  });

  it('sets a demo cookie for anonymous calls and leaves health alone', async () => {
    app = await createApp();
    const health = await request(app.getHttpServer()).get('/health');
    expect(health.status).toBe(200);
    expect(health.headers['set-cookie']).toBeUndefined();

    const anonymous = await request(app.getHttpServer()).get('/api/v1/auth/me');
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.errorCode).toBe('AUTH_UNAUTHORIZED');
    const demo = cookieValue(anonymous, 'demoSessionId');
    expect(demo).toMatch(/^[0-9a-f-]{36}$/i);
    const again = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', `demoSessionId=${demo}`);
    expect(cookieValue(again, 'demoSessionId')).toBeUndefined();
  });

  it('publishes the auth routes in Swagger', async () => {
    app = await createApp();
    const response = await request(app.getHttpServer()).get('/docs-json');
    expect(response.status).toBe(200);
    expect(response.body.paths['/api/v1/auth/register']).toBeDefined();
    expect(response.body.paths['/api/v1/auth/login']).toBeDefined();
    expect(response.body.paths['/api/v1/auth/refresh']).toBeDefined();
    expect(response.body.paths['/api/v1/auth/logout']).toBeDefined();
    expect(response.body.paths['/api/v1/auth/me']).toBeDefined();
  });
});

async function createApp(): Promise<INestApplication> {
  process.env.JWT_SECRET = JWT_SECRET;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(USER_STORE)
    .useValue(new MemoryUserStore())
    .overrideProvider(REFRESH_TOKEN_STORE)
    .useValue(new MemoryRefreshStore())
    .overrideProvider(COUNTER_STORE)
    .useValue(new MemoryCounterStore())
    .overrideProvider(PASSWORD_HASHER)
    .useValue(new FakePasswords())
    .overrideProvider(CLOCK)
    .useValue(fixedClock())
    .compile();
  const application = moduleRef.createNestApplication({ logger: false });
  configureHttpApp(application);
  await application.init();
  return application;
}

function fixedClock(): Clock {
  return { now: () => NOW };
}

function register(app: INestApplication, email = 'ada@example.com') {
  return request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email, password: PASSWORD, displayName: 'Ada' });
}

function login(app: INestApplication, email = 'ada@example.com', password = PASSWORD) {
  return request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password });
}

function refresh(app: INestApplication, rawCookie: string | undefined) {
  return request(app.getHttpServer())
    .post('/api/v1/auth/refresh')
    .set('Cookie', `refreshToken=${rawCookie ?? ''}`);
}

function cookieValue(response: SupertestResponse, name: string): string | undefined {
  const line = cookieLines(response).find((item) => item.startsWith(`${name}=`));
  return line?.split(';')[0]?.slice(name.length + 1);
}

function cookieFlags(response: SupertestResponse, name: string): string {
  return cookieLines(response).find((item) => item.startsWith(`${name}=`)) ?? '';
}

function cookieLines(response: SupertestResponse): string[] {
  const header = response.headers['set-cookie'];
  if (header === undefined) return [];
  return Array.isArray(header) ? header : [header];
}

function jwtPayload(token: string): Record<string, unknown> {
  const segment = token.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<string, unknown>;
}

class FakePasswords implements PasswordHasher {
  /** @inheritdoc */
  async hash(password: string): Promise<string> {
    return `hashed:${password}`;
  }

  /** @inheritdoc */
  async verify(password: string, passwordHash: string): Promise<boolean> {
    return passwordHash === `hashed:${password}`;
  }

  /** @inheritdoc */
  async dummyHash(): Promise<string> {
    return 'hashed:dummy';
  }
}

class MemoryUserStore implements UserStore {
  private readonly accounts: Account[] = [];

  /** @inheritdoc */
  async findByEmail(email: string): Promise<Account | null> {
    return this.accounts.find((account) => account.email === email) ?? null;
  }

  /** @inheritdoc */
  async findById(id: string): Promise<Account | null> {
    return this.accounts.find((account) => account.id === id) ?? null;
  }

  /** @inheritdoc */
  async insert(input: NewAccount): Promise<Account> {
    if ((await this.findByEmail(input.email)) !== null) throw new EmailTakenError();
    const account: Account = {
      id: randomUUID(),
      email: input.email,
      displayName: input.displayName,
      role: UserRole.User,
      passwordHash: input.passwordHash,
      crossChatMemoryEnabled: true,
    };
    this.accounts.push(account);
    return account;
  }
}

interface StoredRefresh {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

class MemoryRefreshStore implements RefreshTokenStore {
  private readonly rows: StoredRefresh[] = [];

  /** @inheritdoc */
  issue(userId: string, now: Date, _meta: ClientMeta): Promise<string> {
    return Promise.resolve(this.insert(userId, now));
  }

  /** @inheritdoc */
  rotate(rawToken: string, now: Date, _meta: ClientMeta): Promise<RotateResult> {
    const row = this.find(rawToken);
    const decision = decideRefresh(row, now);
    if (row === null || decision === 'invalid') return Promise.resolve({ decision: 'invalid' });
    if (decision === 'reused') {
      this.revokeActive(row.userId, now);
      return Promise.resolve({ decision: 'reused', userId: row.userId });
    }
    row.revokedAt = now;
    return Promise.resolve({
      decision: 'rotate',
      userId: row.userId,
      refreshToken: this.insert(row.userId, now),
    });
  }

  /** @inheritdoc */
  revokeIfActive(rawToken: string, now: Date): Promise<void> {
    const row = this.find(rawToken);
    if (row !== null && row.revokedAt === null) row.revokedAt = now;
    return Promise.resolve();
  }

  private insert(userId: string, now: Date): string {
    const refreshToken = newRefreshToken();
    this.rows.push({
      id: randomUUID(),
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiry(now),
      revokedAt: null,
    });
    return refreshToken;
  }

  private find(rawToken: string): StoredRefresh | null {
    const tokenHash = hashToken(rawToken);
    return this.rows.find((row) => row.tokenHash === tokenHash) ?? null;
  }

  private revokeActive(userId: string, now: Date): void {
    for (const row of this.rows) {
      if (row.userId === userId && row.revokedAt === null) row.revokedAt = now;
    }
  }
}
