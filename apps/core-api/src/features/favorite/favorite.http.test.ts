import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthorKind, UserRole, VacancyStatus, WorkFormat, type VacancyCardSummary } from '@hira/contracts';
import { UserPlan } from '@hira/contracts';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { CLOCK, type Clock } from '../../common/utils/clock';
import { configureHttpApp } from '../../configure-http-app';
import { AppModule } from '../../app.module';
import { PASSWORD_HASHER, type PasswordHasher } from '../auth/password.hasher';
import { REFRESH_TOKEN_STORE, type RefreshTokenStore } from '../auth/refresh-token.store';
import { USER_STORE, type Account, type NewAccount, type UserStore, EmailTakenError } from '../auth/user.store';
import { CALL_STORE } from '../call/call.store';
import { MemoryCallStore } from '../call/memory-call.store';
import { CHAT_STORE } from '../chat/chat.store';
import { MemoryChatStore } from '../chat/memory-chat.store';
import { TEXT_EMBEDDER, LIBRARY_STORE, PDF_READER, FILE_STORE } from '../library/library.store';
import { MemoryFileStore, MemoryLibraryStore } from '../library/memory-library.store';
import { MEMORY_STORE } from '../memory/memory.store';
import { MemoryMemoryStore } from '../memory/memory-memory.store';
import { PROFILE_STORE } from '../profile/profile.store';
import { MemoryProfileStore } from '../profile/memory-profile.store';
import { COUNTER_STORE } from '../redis/counter.store';
import { MemoryCounterStore } from '../redis/memory-counter.store';
import { LLM_GATEWAY, RETRIEVAL_GATEWAY } from '../search-orchestrator/search.constants';
import type { LlmGateway } from '../search-orchestrator/upstream-gateway';
import { FAVORITE_STORE } from './favorite.store';
import { MemoryFavoriteStore } from './memory-favorite.store';
import { SKILL_CATALOG } from '../skill/skill.store';
import { MemorySkillCatalog } from '../skill/memory-skill.store';

const JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
const PASSWORD = 'correct-horse';

describe('stage 14 favorites and skills', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('rejects a demo session on favorites and skill search', async () => {
    app = await createApp(stores());
    const favorites = await request(app.getHttpServer()).get('/api/v1/favorites');
    const skills = await request(app.getHttpServer()).get('/api/v1/skills').query({ q: 'python' });
    expect(favorites.status).toBe(403);
    expect(favorites.body.errorCode).toBe('ACCOUNT_REQUIRED');
    expect(skills.status).toBe(403);
    expect(skills.body.errorCode).toBe('ACCOUNT_REQUIRED');
  });

  it('holds the free plan to 20 saved vacancies and no collections, and keeps them after a downgrade', async () => {
    const state = stores();
    const ids = Array.from({ length: 21 }, () => randomUUID());
    for (const id of ids) state.favorites.vacancies.set(id, summary(id));
    app = await createApp(state);
    const server = app.getHttpServer();
    const register = await request(server).post('/api/v1/auth/register').send({ email: 'free@example.com', password: PASSWORD, displayName: 'Free' });
    const bearer = `Bearer ${register.body.accessToken as string}`;
    await request(server).put('/api/v1/billing/plan').set('Authorization', bearer).send({ plan: 'FREE' });
    for (const vacancyId of ids.slice(0, 20)) {
      expect((await request(server).post('/api/v1/favorites').set('Authorization', bearer).send({ vacancyId })).status).toBeLessThan(300);
    }
    const over = await request(server).post('/api/v1/favorites').set('Authorization', bearer).send({ vacancyId: ids[20] });
    expect(over.status).toBe(403);
    expect(over.body).toMatchObject({ errorCode: 'PLAN_LIMIT_REACHED', details: { feature: 'favorites', requiredPlan: 'PRO' } });
    const again = await request(server).post('/api/v1/favorites').set('Authorization', bearer).send({ vacancyId: ids[0] });
    expect(again.status).toBeLessThan(300);
    const collection = await request(server).post('/api/v1/collections').set('Authorization', bearer).send({ name: 'Shortlist' });
    expect(collection.body.details).toMatchObject({ feature: 'collections' });
    await request(server).put('/api/v1/billing/plan').set('Authorization', bearer).send({ plan: 'PRO' });
    expect((await request(server).post('/api/v1/favorites').set('Authorization', bearer).send({ vacancyId: ids[20] })).status).toBeLessThan(300);
    await request(server).put('/api/v1/billing/plan').set('Authorization', bearer).send({ plan: 'FREE' });
    const listed = await request(server).get('/api/v1/favorites').set('Authorization', bearer);
    expect(listed.body).toHaveLength(21);
  });

  it('keeps one row when the same vacancy is saved twice', async () => {
    const state = stores();
    const vacancyId = randomUUID();
    state.favorites.vacancies.set(vacancyId, summary(vacancyId));
    app = await createApp(state);
    const token = await register(app);
    const first = await request(app.getHttpServer()).post('/api/v1/favorites').set('Authorization', `Bearer ${token}`).send({ vacancyId });
    const second = await request(app.getHttpServer()).post('/api/v1/favorites').set('Authorization', `Bearer ${token}`).send({ vacancyId, note: 'again' });
    const listed = await request(app.getHttpServer()).get('/api/v1/favorites').set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);
    expect(first.body.addedBy).toBe(AuthorKind.User);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.note).toBeNull();
    expect(listed.body).toHaveLength(1);
    const collections = await request(app.getHttpServer()).get('/api/v1/collections').set('Authorization', `Bearer ${token}`);
    expect(collections.body).toEqual([expect.objectContaining({ name: 'Saved', isDefault: true })]);
  });

  it('rejects a collection that belongs to someone else', async () => {
    const state = stores();
    const vacancyId = randomUUID();
    state.favorites.vacancies.set(vacancyId, summary(vacancyId));
    app = await createApp(state);
    const ada = await register(app, 'ada@example.com');
    const collection = await request(app.getHttpServer()).post('/api/v1/collections').set('Authorization', `Bearer ${ada}`).send({ name: 'Ada' });
    const grace = await register(app, 'grace@example.com');
    const saved = await request(app.getHttpServer())
      .post('/api/v1/favorites')
      .set('Authorization', `Bearer ${grace}`)
      .send({ vacancyId, collectionId: collection.body.id });
    const missing = await request(app.getHttpServer())
      .post('/api/v1/favorites')
      .set('Authorization', `Bearer ${grace}`)
      .send({ vacancyId: randomUUID() });
    expect(saved.status).toBe(404);
    expect(saved.body.errorCode).toBe('COLLECTION_NOT_FOUND');
    expect(missing.status).toBe(404);
    expect(missing.body.errorCode).toBe('VACANCY_NOT_FOUND');
  });

  it('keeps the favorite when its collection is deleted', async () => {
    const state = stores();
    const vacancyId = randomUUID();
    state.favorites.vacancies.set(vacancyId, summary(vacancyId));
    app = await createApp(state);
    const token = await register(app);
    const saved = await request(app.getHttpServer()).post('/api/v1/favorites').set('Authorization', `Bearer ${token}`).send({ vacancyId });
    const later = await request(app.getHttpServer()).post('/api/v1/collections').set('Authorization', `Bearer ${token}`).send({ name: 'Later' });
    const moved = await request(app.getHttpServer())
      .patch(`/api/v1/favorites/${saved.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ collectionId: later.body.id });
    const removed = await request(app.getHttpServer()).delete(`/api/v1/collections/${later.body.id}`).set('Authorization', `Bearer ${token}`);
    const listed = await request(app.getHttpServer()).get('/api/v1/favorites').set('Authorization', `Bearer ${token}`);
    expect(moved.body.collectionId).toBe(later.body.id);
    expect(removed.status).toBe(204);
    expect(listed.body[0].id).toBe(saved.body.id);
    expect(listed.body[0].collectionId).toBeNull();
  });

  it('filters notes without caring about case', async () => {
    const state = stores();
    const remoteId = randomUUID();
    const officeId = randomUUID();
    state.favorites.vacancies.set(remoteId, summary(remoteId, 'Remote role'));
    state.favorites.vacancies.set(officeId, summary(officeId, 'Office role'));
    app = await createApp(state);
    const token = await register(app);
    await request(app.getHttpServer()).post('/api/v1/favorites').set('Authorization', `Bearer ${token}`).send({ vacancyId: remoteId, note: 'Remote only' });
    await request(app.getHttpServer()).post('/api/v1/favorites').set('Authorization', `Bearer ${token}`).send({ vacancyId: officeId, note: 'Office' });
    const lower = await request(app.getHttpServer()).get('/api/v1/favorites').query({ q: 'remote' }).set('Authorization', `Bearer ${token}`);
    const upper = await request(app.getHttpServer()).get('/api/v1/favorites').query({ q: 'REMOTE' }).set('Authorization', `Bearer ${token}`);
    expect(lower.body).toHaveLength(1);
    expect(lower.body[0].vacancyId).toBe(remoteId);
    expect(upper.body[0].vacancyId).toBe(remoteId);
  });

  it('rejects deleting the default collection and lists a removed vacancy placeholder', async () => {
    const state = stores();
    const vacancyId = randomUUID();
    state.favorites.vacancies.set(vacancyId, summary(vacancyId));
    app = await createApp(state);
    const token = await register(app);
    const saved = await request(app.getHttpServer()).post('/api/v1/favorites').set('Authorization', `Bearer ${token}`).send({ vacancyId });
    const collections = await request(app.getHttpServer()).get('/api/v1/collections').set('Authorization', `Bearer ${token}`);
    const blocked = await request(app.getHttpServer())
      .delete(`/api/v1/collections/${collections.body[0].id}`)
      .set('Authorization', `Bearer ${token}`);
    state.favorites.vacancies.delete(vacancyId);
    const listed = await request(app.getHttpServer()).get('/api/v1/favorites').set('Authorization', `Bearer ${token}`);
    expect(saved.status).toBe(200);
    expect(blocked.status).toBe(400);
    expect(blocked.body.errorCode).toBe('DEFAULT_COLLECTION_PROTECTED');
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].id).toBe(saved.body.id);
    expect(listed.body[0].vacancy.title).toBe('Vacancy removed');
  });

  it('hides another account favorite and a short skill query', async () => {
    const state = stores();
    const vacancyId = randomUUID();
    state.favorites.vacancies.set(vacancyId, summary(vacancyId));
    state.skills.skills.push({ skillId: 4, canonicalName: 'Python', aliases: ['py'] });
    app = await createApp(state);
    const ada = await register(app, 'ada@example.com');
    const saved = await request(app.getHttpServer()).post('/api/v1/favorites').set('Authorization', `Bearer ${ada}`).send({ vacancyId });
    const grace = await register(app, 'grace@example.com');
    const removed = await request(app.getHttpServer()).delete(`/api/v1/favorites/${saved.body.id}`).set('Authorization', `Bearer ${grace}`);
    const short = await request(app.getHttpServer()).get('/api/v1/skills').query({ q: 'p' }).set('Authorization', `Bearer ${ada}`);
    const hit = await request(app.getHttpServer()).get('/api/v1/skills').query({ q: 'py' }).set('Authorization', `Bearer ${ada}`);
    state.skills.skills.length = 0;
    const empty = await request(app.getHttpServer()).get('/api/v1/skills').query({ q: 'python' }).set('Authorization', `Bearer ${ada}`);
    expect(removed.status).toBe(404);
    expect(removed.body.errorCode).toBe('FAVORITE_NOT_FOUND');
    expect(short.body).toEqual([]);
    expect(hit.body).toEqual([{ skillId: 4, canonicalName: 'Python' }]);
    expect(empty.body).toEqual([]);
  });
});

function stores() {
  return { favorites: new MemoryFavoriteStore(), skills: new MemorySkillCatalog() };
}

function summary(id: string, title = 'Engineer'): VacancyCardSummary {
  return {
    id,
    title,
    companyName: 'Acme',
    locationLabel: 'Minsk',
    status: VacancyStatus.Active,
    url: 'https://example.test/job',
    salaryMin: 1000,
    salaryMax: 2000,
    salaryCurrency: 'BYN',
    workFormat: WorkFormat.Remote,
  };
}

async function createApp(state: ReturnType<typeof stores>): Promise<INestApplication> {
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
    .useValue({ now: () => new Date('2026-10-24T12:00:00.000Z') } satisfies Clock)
    .overrideProvider(CHAT_STORE)
    .useValue(new MemoryChatStore())
    .overrideProvider(MEMORY_STORE)
    .useValue(new MemoryMemoryStore())
    .overrideProvider(LIBRARY_STORE)
    .useValue(new MemoryLibraryStore())
    .overrideProvider(FILE_STORE)
    .useValue(new MemoryFileStore())
    .overrideProvider(PROFILE_STORE)
    .useValue(new MemoryProfileStore())
    .overrideProvider(CALL_STORE)
    .useValue(new MemoryCallStore())
    .overrideProvider(PDF_READER)
    .useValue({ read: async () => '' })
    .overrideProvider(TEXT_EMBEDDER)
    .useValue(async () => null)
    .overrideProvider(LLM_GATEWAY)
    .useValue(fakeLlm())
    .overrideProvider(RETRIEVAL_GATEWAY)
    .useValue({ search: async () => ({ results: [], diagnostics: emptyDiagnostics() }) })
    .overrideProvider(FAVORITE_STORE)
    .useValue(state.favorites)
    .overrideProvider(SKILL_CATALOG)
    .useValue(state.skills)
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

function fakeLlm(): LlmGateway {
  return {
    understand: async () => { throw new Error('unused'); },
    generate: async function* () { yield { kind: 'token', delta: '' }; },
    summarize: async () => ({ summary: '' }),
    extractMemory: async () => ({ candidates: [], suggestions: [] }),
    parseResume: async () => ({ skills: [], experience: [] }),
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
    const account: Account = { id: randomUUID(), email: input.email, displayName: input.displayName, role: UserRole.User, passwordHash: input.passwordHash, plan: UserPlan.Pro, crossChatMemoryEnabled: true };
    this.accounts.push(account);
    return account;
  }
  async setPlan(userId: string, plan: UserPlan) {
    const account = await this.findById(userId);
    if (account === null) return false;
    account.plan = plan;
    return true;
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
