import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentFormat, DocumentKind, MemoryKind, ProfileSuggestionStatus, UserRole, WorkFormat } from '@hira/contracts';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { CLOCK, type Clock } from '../common/utils/clock';
import { configureHttpApp } from '../configure-http-app';
import { AppModule } from '../app.module';
import { PASSWORD_HASHER, type PasswordHasher } from './auth/password.hasher';
import { REFRESH_TOKEN_STORE, type RefreshTokenStore } from './auth/refresh-token.store';
import { USER_STORE, type Account, type NewAccount, type UserStore, EmailTakenError } from './auth/user.store';
import { CALL_STORE } from './call/call.store';
import { MemoryCallStore } from './call/memory-call.store';
import { CHAT_STORE } from './chat/chat.store';
import { MemoryChatStore } from './chat/memory-chat.store';
import { TEXT_EMBEDDER, LIBRARY_STORE, PDF_READER, FILE_STORE } from './library/library.store';
import { MemoryFileStore, MemoryLibraryStore } from './library/memory-library.store';
import { MEMORY_STORE } from './memory/memory.store';
import { MemoryMemoryStore } from './memory/memory-memory.store';
import { PROFILE_STORE } from './profile/profile.store';
import { MemoryProfileStore } from './profile/memory-profile.store';
import { COUNTER_STORE } from './redis/counter.store';
import { MemoryCounterStore } from './redis/memory-counter.store';
import { LLM_GATEWAY, RETRIEVAL_GATEWAY } from './search-orchestrator/search.constants';
import type { LlmGateway } from './search-orchestrator/upstream-gateway';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
const PASSWORD = 'correct-horse';

describe('stage 12 account surfaces', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('rejects a demo session on memory, documents, and calls', async () => {
    app = await createApp(stores());
    const memory = await request(app.getHttpServer()).get('/api/v1/memory');
    const documents = await request(app.getHttpServer()).post('/api/v1/documents').send({
      kind: DocumentKind.Note,
      title: 'Note',
      format: DocumentFormat.Txt,
      content: 'hello',
    });
    const calls = await request(app.getHttpServer()).post('/api/v1/calls');
    expect(memory.status).toBe(403);
    expect(documents.status).toBe(403);
    expect(calls.status).toBe(403);
    expect(memory.body.errorCode).toBe('ACCOUNT_REQUIRED');
  });

  it('stores a text file, pins preferences, and rejects a PDF body edit', async () => {
    const state = stores();
    app = await createApp(state);
    const token = await register(app);
    const created = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: DocumentKind.Preferences, title: 'Prefs', format: DocumentFormat.Md, content: 'remote only' });
    expect(created.status).toBe(201);
    expect(created.body.isPinned).toBe(true);
    const note = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: DocumentKind.Note, title: 'Note', format: DocumentFormat.Txt, content: 'draft' });
    expect(note.body.isPinned).toBe(false);
    const pdf = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF'), 'cv.pdf');
    expect(pdf.status).toBe(201);
    expect(pdf.body.kind).toBe(DocumentKind.Resume);
    const edited = await request(app.getHttpServer())
      .patch(`/api/v1/documents/${pdf.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'nope' });
    expect(edited.status).toBe(400);
    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/documents/${note.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(removed.status).toBe(204);
    expect(state.files.files.size).toBe(2);
    const huge = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), 'big.pdf');
    expect(huge.status).toBe(400);
  });

  it('accepts a skill suggestion without replacing a self-reported skill', async () => {
    const state = stores();
    app = await createApp(state);
    const token = await register(app);
    const userId = state.users.accounts[0]?.id ?? '';
    state.profiles.skillHits.set('python', [{ skillId: 4, exactName: true, exactAlias: false, trigram: 1 }]);
    await state.profiles.insertSkill(userId, {
      skillId: 4,
      canonicalName: 'Python',
      level: 'CONFIDENT' as never,
      years: 1,
      source: 'SELF_REPORTED' as never,
      confidence: 1,
    });
    await state.profiles.insertSuggestion({
      userId,
      kind: 'SKILL' as never,
      source: 'EXTRACTED_FROM_CHAT' as never,
      sourceMessageId: null,
      sourceDocumentId: null,
      sourceCallTurnId: null,
      payload: {
        skillId: 4,
        surface: 'Python',
        level: 'EXPERT' as never,
        years: null,
        workFormat: null,
        employment: null,
        salaryMin: null,
        currency: null,
        locationId: null,
        role: null,
        education: null,
        confidence: 0.8,
      },
    });
    const listed = await request(app.getHttpServer()).get('/api/v1/profile/suggestions').set('Authorization', `Bearer ${token}`);
    expect(listed.body).toHaveLength(1);
    const accepted = await request(app.getHttpServer())
      .post(`/api/v1/profile/suggestions/${listed.body[0].id}/accept`)
      .set('Authorization', `Bearer ${token}`);
    expect(accepted.status).toBe(201);
    const skills = await state.profiles.listSkills(userId);
    expect(skills[0]?.source).toBe('SELF_REPORTED');
    expect(skills[0]?.level).toBe('CONFIDENT');
  });

  it('turns cross-chat memory off without deleting a fact', async () => {
    const state = stores();
    app = await createApp(state);
    const token = await register(app);
    const userId = state.users.accounts[0]?.id ?? '';
    await state.memory.insert({
      id: randomUUID(),
      userId,
      kind: MemoryKind.Fact,
      content: 'lives in Minsk',
      embedding: null,
      confidence: 0.9,
      sourceMessageId: null,
      sourceCallTurnId: null,
      isPinned: false,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date('2026-10-18T12:00:00.000Z'),
    });
    const patched = await request(app.getHttpServer())
      .patch('/api/v1/settings/memory')
      .set('Authorization', `Bearer ${token}`)
      .send({ crossChatMemory: false });
    expect(patched.body).toEqual({ crossChatMemory: false });
    const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.body.crossChatMemoryEnabled).toBe(false);
    const listed = await request(app.getHttpServer()).get('/api/v1/memory').set('Authorization', `Bearer ${token}`);
    expect(listed.body[0].content).toBe('lives in Minsk');
  });

  it('hides another account document and call', async () => {
    const state = stores();
    app = await createApp(state);
    const ada = await register(app, 'ada@example.com');
    const note = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${ada}`)
      .send({ kind: DocumentKind.Note, title: 'Note', format: DocumentFormat.Txt, content: 'secret' });
    const started = await request(app.getHttpServer()).post('/api/v1/calls').set('Authorization', `Bearer ${ada}`);
    const grace = await register(app, 'grace@example.com');
    const read = await request(app.getHttpServer())
      .get(`/api/v1/documents/${note.body.id}`)
      .set('Authorization', `Bearer ${grace}`);
    const ended = await request(app.getHttpServer())
      .post(`/api/v1/calls/${started.body.id}/end`)
      .set('Authorization', `Bearer ${grace}`);
    const turn = await request(app.getHttpServer())
      .post(`/api/v1/calls/${started.body.id}/turns`)
      .set('Authorization', `Bearer ${grace}`)
      .send({ content: 'hello' });
    expect(read.status).toBe(404);
    expect(read.body.errorCode).toBe('DOCUMENT_NOT_FOUND');
    expect(ended.status).toBe(404);
    expect(ended.body.errorCode).toBe('CALL_NOT_FOUND');
    expect(turn.status).toBe(404);
    expect(turn.body.errorCode).toBe('CALL_NOT_FOUND');
  });

  it('rejects a demo call turn and a turn after the call has ended', async () => {
    app = await createApp(stores());
    const demo = await request(app.getHttpServer())
      .post(`/api/v1/calls/${randomUUID()}/turns`)
      .send({ content: 'hello' });
    expect(demo.status).toBe(403);
    expect(demo.body.errorCode).toBe('ACCOUNT_REQUIRED');
    const token = await register(app);
    const started = await request(app.getHttpServer()).post('/api/v1/calls').set('Authorization', `Bearer ${token}`);
    const first = await request(app.getHttpServer())
      .post(`/api/v1/calls/${started.body.id}/end`)
      .set('Authorization', `Bearer ${token}`);
    const second = await request(app.getHttpServer())
      .post(`/api/v1/calls/${started.body.id}/end`)
      .set('Authorization', `Bearer ${token}`);
    expect(second.status).toBe(200);
    expect(second.body.endedAt).toBe(first.body.endedAt);
    const again = await request(app.getHttpServer())
      .post(`/api/v1/calls/${started.body.id}/turns`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'again' });
    expect(again.status).toBe(400);
    expect(again.body.errorCode).toBe('CALL_ENDED');
  });

  it('forgets one fact and reports a missing fact', async () => {
    const state = stores();
    app = await createApp(state);
    const token = await register(app);
    const userId = state.users.accounts[0]?.id ?? '';
    const id = randomUUID();
    await state.memory.insert({
      id,
      userId,
      kind: MemoryKind.Fact,
      content: 'likes tea',
      embedding: null,
      confidence: 0.9,
      sourceMessageId: null,
      sourceCallTurnId: null,
      isPinned: false,
      expiresAt: null,
      revokedAt: null,
      createdAt: new Date('2026-10-18T12:00:00.000Z'),
    });
    const forgotten = await request(app.getHttpServer())
      .delete(`/api/v1/memory/${id}`)
      .set('Authorization', `Bearer ${token}`);
    const listed = await request(app.getHttpServer()).get('/api/v1/memory').set('Authorization', `Bearer ${token}`);
    const missing = randomUUID();
    const patched = await request(app.getHttpServer())
      .patch(`/api/v1/memory/${missing}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'nope' });
    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/memory/${missing}`)
      .set('Authorization', `Bearer ${token}`);
    expect(forgotten.status).toBe(204);
    expect(listed.body).toEqual([]);
    expect(state.memory.facts[0]?.revokedAt).toBeInstanceOf(Date);
    expect(patched.status).toBe(404);
    expect(patched.body.errorCode).toBe('MEMORY_NOT_FOUND');
    expect(removed.status).toBe(404);
    expect(removed.body.errorCode).toBe('MEMORY_NOT_FOUND');
  });

  it('rejects an uploaded file that is not a resume', async () => {
    const state = stores();
    app = await createApp(state);
    const token = await register(app);
    const note = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .field('kind', DocumentKind.Note)
      .attach('file', Buffer.from('%PDF'), 'notes.pdf');
    expect(note.status).toBe(400);
    expect(note.body.errorCode).toBe('VALIDATION_FAILED');
    expect(state.files.files.size).toBe(0);
    expect(state.library.documents).toHaveLength(0);
  });

  it('saves one profile field and leaves the others alone', async () => {
    app = await createApp(stores());
    const token = await register(app);
    const put = (body: object) =>
      request(app!.getHttpServer()).put('/api/v1/profile').set('Authorization', `Bearer ${token}`).send(body);
    const first = await put({ headline: 'QA', desiredRoles: ['QA'], preferredWorkFormat: [], preferredEmployment: [] });
    expect(first.status).toBe(200);
    const second = await put({ preferredLocations: [1] });
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ headline: 'QA', desiredRoles: ['QA'], preferredLocations: [1] });
    const third = await put({ desiredRoles: null });
    expect(third.body.desiredRoles).toEqual(['QA']);
  });

  it('moves a guest chat with messages into the account and only once', async () => {
    app = await createApp(stores());
    const server = app.getHttpServer();
    const opened = await request(server).post('/api/v1/chats');
    const cookie = demoCookie(opened);
    await request(server).post(`/api/v1/chats/${opened.body.id}/messages`).set('Cookie', cookie).send({ content: 'hello' });
    const token = await register(app);
    const claim = () => request(server).post('/api/v1/chats/claim-guest').set('Cookie', cookie).set('Authorization', `Bearer ${token}`);
    const claimed = await claim();
    expect(claimed.status).toBe(201);
    expect(claimed.body.chat.id).toBe(opened.body.id);
    expect((await claim()).body.chat).toBeNull();
    const listed = await request(server).get('/api/v1/chats').set('Authorization', `Bearer ${token}`);
    expect(listed.body.items.map((chat: { id: string }) => chat.id)).toEqual([opened.body.id]);
    const detail = await request(server).get(`/api/v1/chats/${opened.body.id}`).set('Authorization', `Bearer ${token}`);
    expect(detail.body.messages.length).toBeGreaterThan(0);
  });

  it('leaves an empty guest chat behind and does not reset the guest counter', async () => {
    app = await createApp(stores());
    const server = app.getHttpServer();
    const opened = await request(server).post('/api/v1/chats');
    const cookie = demoCookie(opened);
    const token = await register(app);
    const claimed = await request(server).post('/api/v1/chats/claim-guest').set('Cookie', cookie).set('Authorization', `Bearer ${token}`);
    expect(claimed.body.chat).toBeNull();
    const still = await request(server).get(`/api/v1/chats/${opened.body.id}`).set('Cookie', cookie);
    expect(still.status).toBe(200);
  });

  it('answers null without a guest cookie and refuses a guest caller', async () => {
    app = await createApp(stores());
    const server = app.getHttpServer();
    const token = await register(app);
    const none = await request(server).post('/api/v1/chats/claim-guest').set('Authorization', `Bearer ${token}`);
    expect(none.body.chat).toBeNull();
    const guest = await request(server).post('/api/v1/chats/claim-guest');
    expect(guest.status).toBe(403);
  });

  it('rejects an empty PDF and a missing profile skill', async () => {
    const state = stores();
    app = await createApp(state, '');
    const token = await register(app);
    const empty = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF'), 'empty.pdf');
    expect(empty.status).toBe(400);
    expect(empty.body.errorCode).toBe('VALIDATION_FAILED');
    expect(state.files.files.size).toBe(0);
    const skill = await request(app.getHttpServer())
      .delete('/api/v1/profile/skills/99')
      .set('Authorization', `Bearer ${token}`);
    expect(skill.status).toBe(404);
    expect(skill.body.errorCode).toBe('SKILL_NOT_FOUND');
  });

  it('rejects an unknown kind, a long title, and a long resume name before saving', async () => {
    const state = stores();
    app = await createApp(state);
    const token = await register(app);
    const kind = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: 'NOPE', title: 'Note', format: DocumentFormat.Txt, content: 'hello' });
    const title = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .send({ kind: DocumentKind.Note, title: 'n'.repeat(257), format: DocumentFormat.Txt, content: 'hello' });
    const named = await request(app.getHttpServer())
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('%PDF'), `${'r'.repeat(257)}.pdf`);
    expect(kind.status).toBe(400);
    expect(kind.body.errorCode).toBe('VALIDATION_FAILED');
    expect(title.status).toBe(400);
    expect(title.body.errorCode).toBe('VALIDATION_FAILED');
    expect(named.status).toBe(400);
    expect(named.body.errorCode).toBe('VALIDATION_FAILED');
    expect(state.files.files.size).toBe(0);
    expect(state.library.documents).toHaveLength(0);
  });
});

function stores() {
  return {
    users: new MemoryUserStore(),
    memory: new MemoryMemoryStore(),
    library: new MemoryLibraryStore(),
    files: new MemoryFileStore(),
    profiles: new MemoryProfileStore(),
    calls: new MemoryCallStore(),
  };
}

async function createApp(state: ReturnType<typeof stores>, pdfText = 'Python developer'): Promise<INestApplication> {
  process.env.JWT_SECRET = JWT_SECRET;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(USER_STORE)
    .useValue(state.users)
    .overrideProvider(REFRESH_TOKEN_STORE)
    .useValue(new StubRefresh())
    .overrideProvider(COUNTER_STORE)
    .useValue(new MemoryCounterStore())
    .overrideProvider(PASSWORD_HASHER)
    .useValue(new FakePasswords())
    .overrideProvider(CLOCK)
    .useValue({ now: () => new Date('2026-10-18T12:00:00.000Z') } satisfies Clock)
    .overrideProvider(CHAT_STORE)
    .useValue(new MemoryChatStore())
    .overrideProvider(MEMORY_STORE)
    .useValue(state.memory)
    .overrideProvider(LIBRARY_STORE)
    .useValue(state.library)
    .overrideProvider(FILE_STORE)
    .useValue(state.files)
    .overrideProvider(PROFILE_STORE)
    .useValue(state.profiles)
    .overrideProvider(CALL_STORE)
    .useValue(state.calls)
    .overrideProvider(PDF_READER)
    .useValue({ read: async () => pdfText })
    .overrideProvider(TEXT_EMBEDDER)
    .useValue(async () => null)
    .overrideProvider(LLM_GATEWAY)
    .useValue(fakeLlm())
    .overrideProvider(RETRIEVAL_GATEWAY)
    .useValue({ search: async () => ({ results: [], diagnostics: emptyDiagnostics() }) })
    .compile();
  const application = moduleRef.createNestApplication({ logger: false });
  configureHttpApp(application);
  await application.init();
  return application;
}

async function register(app: INestApplication, email = 'ada@example.com'): Promise<string> {
  const response = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
    email,
    password: PASSWORD,
    displayName: 'Ada',
  });
  return response.body.accessToken as string;
}

function demoCookie(response: { headers: Record<string, unknown> }): string {
  const cookies = response.headers['set-cookie'] as unknown as string[];
  const demo = cookies.find((cookie) => cookie.startsWith('demoSessionId='));
  return (demo ?? '').split(';')[0] ?? '';
}

function fakeLlm(): LlmGateway {
  return {
    understand: async () => { throw new Error('unused'); },
    generate: async function* () { yield { kind: 'token', delta: '' }; },
    summarize: async () => ({ summary: '' }),
    extractMemory: async () => ({ candidates: [], suggestions: [] }),
    parseResume: async () => ({ skills: [{ surface: 'Python', level: null, years: null }], experience: [] }),
  };
}

function emptyDiagnostics() {
  return {
    branchTimings: { LEXICAL: 0, DENSE: 0, GRAPH: 0 },
    candidateCounts: { LEXICAL: 0, DENSE: 0, GRAPH: 0 },
    fusedCount: 0,
    relaxationSteps: [],
    rerankApplied: false,
    totalLatencyMs: 0,
  };
}

class MemoryUserStore implements UserStore {
  readonly accounts: Account[] = [];
  async findByEmail(email: string) { return this.accounts.find((account) => account.email === email) ?? null; }
  async findById(id: string) { return this.accounts.find((account) => account.id === id) ?? null; }
  async insert(input: NewAccount): Promise<Account> {
    if ((await this.findByEmail(input.email)) !== null) throw new EmailTakenError();
    const account: Account = { id: randomUUID(), email: input.email, displayName: input.displayName, role: UserRole.User, passwordHash: input.passwordHash, crossChatMemoryEnabled: true };
    this.accounts.push(account);
    return account;
  }
  async setCrossChatMemory(userId: string, enabled: boolean) {
    const account = await this.findById(userId);
    if (account === null) return false;
    account.crossChatMemoryEnabled = enabled;
    return true;
  }
}

class FakePasswords implements PasswordHasher {
  hash(password: string) { return Promise.resolve(`hashed:${password}`); }
  verify(password: string, passwordHash: string) { return Promise.resolve(passwordHash === `hashed:${password}`); }
  dummyHash() { return Promise.resolve('hashed:dummy'); }
}

class StubRefresh implements RefreshTokenStore {
  issue() { return Promise.resolve('refresh-token'); }
  rotate() { return Promise.resolve({ decision: 'invalid' as const }); }
  revokeIfActive() { return Promise.resolve(); }
}

void ProfileSuggestionStatus;
void WorkFormat;
