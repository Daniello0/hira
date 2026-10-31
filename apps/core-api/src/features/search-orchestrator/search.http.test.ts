import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole, type GenerateRequest, type RetrievalRequest, type UnderstandRequest, type UnderstandResponse } from '@hira/contracts';
import { UserPlan } from '@hira/contracts';
import type { Response as SupertestResponse } from 'supertest';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { CLOCK, type Clock } from '../../common/utils/clock';
import { configureHttpApp } from '../../configure-http-app';
import { AppModule } from '../../app.module';
import { PASSWORD_HASHER, type PasswordHasher } from '../auth/password.hasher';
import { REFRESH_TOKEN_STORE, type ClientMeta, type RefreshTokenStore, type RotateResult } from '../auth/refresh-token.store';
import { EmailTakenError, USER_STORE, type Account, type NewAccount, type UserStore } from '../auth/user.store';
import { SSE_EVENT } from '../chat/chat.constants';
import { CHAT_STORE } from '../chat/chat.store';
import { MemoryChatStore } from '../chat/memory-chat.store';
import { SearchUpstreamError } from '../chat/chat.errors';
import { COUNTER_STORE } from '../redis/counter.store';
import { MemoryCounterStore } from '../redis/memory-counter.store';
import { heuristicIntent } from './heuristic-intent';
import { CALL_STORE } from '../call/call.store';
import { MemoryCallStore } from '../call/memory-call.store';
import { TEXT_EMBEDDER } from '../library/library.store';
import { LIBRARY_STORE } from '../library/library.store';
import { MemoryLibraryStore } from '../library/memory-library.store';
import { MEMORY_STORE } from '../memory/memory.store';
import { MemoryMemoryStore } from '../memory/memory-memory.store';
import { PROFILE_STORE } from '../profile/profile.store';
import { MemoryProfileStore } from '../profile/memory-profile.store';
import { LLM_GATEWAY, RETRIEVAL_GATEWAY } from './search.constants';
import { TOKEN_USAGE, retrievalResponse } from './search-fixture';
import type { LlmGateway, LlmGenerateEvent, RetrievalGateway } from './upstream-gateway';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
const PASSWORD = 'correct-horse';

describe('search http', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('streams a chat turn and hides another user chat', async () => {
    const rig = buildRig();
    app = await createApp(rig);
    const ada = await register(app, 'ada@example.com');
    const grace = await register(app, 'grace@example.com');
    const created = await request(app.getHttpServer())
      .post('/api/v1/chats')
      .set('Authorization', `Bearer ${token(ada)}`);
    expect(created.status).toBe(201);
    const chatId = created.body.id as string;

    const sent = await request(app.getHttpServer())
      .post(`/api/v1/chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${token(ada)}`)
      .set('X-Request-Id', 'req-turn')
      .send({ content: 'remote python' });
    expect(sent.status).toBe(200);
    expect(sent.headers['content-type']).toContain('text/event-stream');
    expect(events(sent.text)).toEqual([
      SSE_EVENT.userMessage,
      SSE_EVENT.intent,
      SSE_EVENT.results,
      SSE_EVENT.token,
      SSE_EVENT.assistantMessage,
      SSE_EVENT.done,
    ]);

    const history = await request(app.getHttpServer())
      .get(`/api/v1/chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${token(ada)}`);
    expect(history.status).toBe(200);
    expect(history.body.items[0].role).toBe('USER');
    expect(history.body.items[1].results[0].vacancy.id).toBe(retrievalResponse().results[0]?.vacancy.id);

    const hidden = await request(app.getHttpServer())
      .get(`/api/v1/chats/${chatId}`)
      .set('Authorization', `Bearer ${token(grace)}`);
    expect(hidden.status).toBe(404);
    expect(hidden.body.errorCode).toBe('CHAT_NOT_FOUND');
  });

  it('returns 503 when retrieval is down and keeps the user message', async () => {
    const rig = buildRig();
    rig.retrieval.error = new SearchUpstreamError();
    app = await createApp(rig);
    const ada = await register(app);
    const chatId = (await request(app.getHttpServer()).post('/api/v1/chats').set('Authorization', `Bearer ${token(ada)}`)).body.id;
    const sent = await request(app.getHttpServer())
      .post(`/api/v1/chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${token(ada)}`)
      .send({ content: 'remote python' });
    expect(sent.status).toBe(200);
    expect(sent.text).toContain('event: error');
    expect(sent.text).toContain('SEARCH_UPSTREAM_UNAVAILABLE');
    const history = await request(app.getHttpServer())
      .get(`/api/v1/chats/${chatId}/messages`)
      .set('Authorization', `Bearer ${token(ada)}`);
    expect(history.body.items).toHaveLength(1);
    expect(history.body.items[0].role).toBe('USER');
  });

  it('gives a demo session one chat and three searches', async () => {
    const rig = buildRig();
    app = await createApp(rig);
    const first = await request(app.getHttpServer()).get('/api/v1/chats');
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(1);
    const cookie = cookieValue(first, 'demoSessionId');
    const second = await request(app.getHttpServer()).post('/api/v1/chats').set('Cookie', `demoSessionId=${cookie}`);
    expect(second.status).toBe(429);
    expect(second.body.errorCode).toBe('RATE_LIMIT_EXCEEDED');
    expect(second.headers['retry-after']).toBeUndefined();

    const chatId = first.body.items[0].id as string;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const sent = await request(app.getHttpServer())
        .post(`/api/v1/chats/${chatId}/messages`)
        .set('Cookie', `demoSessionId=${cookie}`)
        .send({ content: `query ${attempt}` });
      expect(sent.status).toBe(200);
    }
    const blocked = await request(app.getHttpServer())
      .post(`/api/v1/chats/${chatId}/messages`)
      .set('Cookie', `demoSessionId=${cookie}`)
      .send({ content: 'one more' });
    expect(blocked.status).toBe(200);
    expect(blocked.text).toContain('event: error');
    expect(blocked.text).toContain('RATE_LIMIT_EXCEEDED');
  });

  it('searches without a chat and rejects an empty message', async () => {
    const rig = buildRig();
    app = await createApp(rig);
    const ada = await register(app);
    const found = await request(app.getHttpServer())
      .post('/api/v1/search')
      .set('Authorization', `Bearer ${token(ada)}`)
      .send({ intent: heuristicIntent('python'), options: { branches: ['LEXICAL'], rerank: false } });
    expect(found.status).toBe(200);
    expect(found.body.results).toHaveLength(1);
    expect(rig.retrieval.calls.at(-1)?.options).toEqual({ branches: ['LEXICAL'], rerank: false });

    const empty = await request(app.getHttpServer())
      .post(`/api/v1/chats/${randomUUID()}/messages`)
      .set('Authorization', `Bearer ${token(ada)}`)
      .send({ content: '   ' });
    expect(empty.status).toBe(400);
    expect(empty.body.errorCode).toBe('VALIDATION_FAILED');
  });

  it('publishes the chat and search routes', async () => {
    app = await createApp(buildRig());
    const response = await request(app.getHttpServer()).get('/docs-json');
    expect(response.body.paths['/api/v1/chats']).toBeDefined();
    expect(response.body.paths['/api/v1/chats/{chatId}/messages']).toBeDefined();
    expect(response.body.paths['/api/v1/search']).toBeDefined();
  });
});

function buildRig() {
  return { chats: new MemoryChatStore(), llm: new FakeLlm(), retrieval: new FakeRetrieval() };
}

async function createApp(rig: ReturnType<typeof buildRig>): Promise<INestApplication> {
  process.env.JWT_SECRET = JWT_SECRET;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(USER_STORE)
    .useValue(new MemoryUserStore())
    .overrideProvider(REFRESH_TOKEN_STORE)
    .useValue(new StubRefresh())
    .overrideProvider(COUNTER_STORE)
    .useValue(new MemoryCounterStore())
    .overrideProvider(PASSWORD_HASHER)
    .useValue(new FakePasswords())
    .overrideProvider(CLOCK)
    .useValue(fixedClock())
    .overrideProvider(CHAT_STORE)
    .useValue(rig.chats)
    .overrideProvider(LLM_GATEWAY)
    .useValue(rig.llm)
    .overrideProvider(RETRIEVAL_GATEWAY)
    .useValue(rig.retrieval)
    .overrideProvider(MEMORY_STORE)
    .useValue(new MemoryMemoryStore())
    .overrideProvider(LIBRARY_STORE)
    .useValue(new MemoryLibraryStore())
    .overrideProvider(PROFILE_STORE)
    .useValue(new MemoryProfileStore())
    .overrideProvider(CALL_STORE)
    .useValue(new MemoryCallStore())
    .overrideProvider(TEXT_EMBEDDER)
    .useValue(async () => null)
    .compile();
  const application = moduleRef.createNestApplication({ logger: false });
  configureHttpApp(application);
  await application.init();
  return application;
}

function fixedClock(): Clock {
  return { now: () => new Date('2026-10-18T12:00:00.000Z') };
}

function register(app: INestApplication, email = 'ada@example.com') {
  return request(app.getHttpServer()).post('/api/v1/auth/register').send({ email, password: PASSWORD, displayName: 'Ada' });
}

function token(response: SupertestResponse): string {
  return response.body.accessToken as string;
}

function events(body: string): string[] {
  return body
    .split('\n')
    .filter((line) => line.startsWith('event:'))
    .map((line) => line.slice('event:'.length).trim());
}

function cookieValue(response: SupertestResponse, name: string): string {
  const header = response.headers['set-cookie'];
  const lines = header === undefined ? [] : Array.isArray(header) ? header : [header];
  const line = lines.find((item) => item.startsWith(`${name}=`));
  return line?.split(';')[0]?.slice(name.length + 1) ?? '';
}

class FakeLlm implements LlmGateway {
  /** @inheritdoc */
  understand(request: UnderstandRequest): Promise<UnderstandResponse> {
    return Promise.resolve({ intent: { ...heuristicIntent(request.query), role: 'python' }, meta: { tokenUsage: TOKEN_USAGE } });
  }

  /** @inheritdoc */
  async *generate(_request: GenerateRequest): AsyncGenerator<LlmGenerateEvent> {
    yield { kind: 'token', delta: 'Hi' };
    yield { kind: 'done', tokenUsage: TOKEN_USAGE };
  }

  /** @inheritdoc */
  summarize(): Promise<{ summary: string }> {
    return Promise.resolve({ summary: 'Цель поиска: work' });
  }

  /** @inheritdoc */
  extractMemory(): Promise<{ candidates: []; suggestions: [] }> {
    return Promise.resolve({ candidates: [], suggestions: [] });
  }

  /** @inheritdoc */
  parseResume(): Promise<{ skills: []; experience: [] }> {
    return Promise.resolve({ skills: [], experience: [] });
  }
}

class FakeRetrieval implements RetrievalGateway {
  error: Error | null = null;
  calls: RetrievalRequest[] = [];

  /** @inheritdoc */
  search(body: RetrievalRequest) {
    this.calls.push(body);
    if (this.error !== null) return Promise.reject(this.error);
    return Promise.resolve(retrievalResponse());
  }
}

class FakePasswords implements PasswordHasher {
  /** @inheritdoc */
  hash(password: string): Promise<string> {
    return Promise.resolve(`hashed:${password}`);
  }

  /** @inheritdoc */
  verify(password: string, passwordHash: string): Promise<boolean> {
    return Promise.resolve(passwordHash === `hashed:${password}`);
  }

  /** @inheritdoc */
  dummyHash(): Promise<string> {
    return Promise.resolve('hashed:dummy');
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
      plan: UserPlan.Free, crossChatMemoryEnabled: true,
    };
    this.accounts.push(account);
    return account;
  }

  /** @inheritdoc */
  async setPlan(userId: string, plan: UserPlan) {
    const account = await this.findById(userId);
    if (account === null) return false;
    account.plan = plan;
    return true;
  }

  async setCrossChatMemory(userId: string, enabled: boolean): Promise<boolean> {
    const account = await this.findById(userId);
    if (account === null) return false;
    account.crossChatMemoryEnabled = enabled;
    return true;
  }
}

class StubRefresh implements RefreshTokenStore {
  /** @inheritdoc */
  issue(): Promise<string> {
    return Promise.resolve('refresh-token');
  }

  /** @inheritdoc */
  rotate(_rawToken: string, _now: Date, _meta: ClientMeta): Promise<RotateResult> {
    return Promise.resolve({ decision: 'invalid' });
  }

  /** @inheritdoc */
  revokeIfActive(): Promise<void> {
    return Promise.resolve();
  }
}
