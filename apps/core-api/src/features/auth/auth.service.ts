import type {
  AuthSessionDto,
  CurrentUserDto,
  LoginRequest,
  RegisterRequest,
} from '@hira/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { CLOCK, type Clock } from '../../common/utils/clock';
import { LoginRateLimitService } from '../rate-limit/login-rate-limit.service';
import { AccessTokenService } from './access-token.service';
import { displayNameFrom, normalizeEmail } from './auth-input';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.constants';
import {
  InvalidCredentialsError,
  LoginLimitedError,
  RefreshInvalidError,
  RefreshReusedError,
  UnauthorizedError,
} from './auth.errors';
import { assertPasswordPolicy } from './password-policy';
import { PASSWORD_HASHER, type PasswordHasher } from './password.hasher';
import {
  REFRESH_TOKEN_STORE,
  type ClientMeta,
  type RefreshTokenStore,
} from './refresh-token.store';
import { toCurrentUser, USER_STORE, type Account, type UserStore } from './user.store';

export interface IssuedSession extends AuthSessionDto {
  refreshToken: string;
}

/** Registration, login, refresh rotation, and the current-user read. */
@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_STORE) private readonly users: UserStore,
    @Inject(REFRESH_TOKEN_STORE) private readonly refreshTokens: RefreshTokenStore,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AccessTokenService) private readonly accessTokens: AccessTokenService,
    @Inject(LoginRateLimitService) private readonly loginLimits: LoginRateLimitService,
  ) {}

  /** Creates the account and a session. The caller maps `EmailTakenError` and `WeakPasswordError`. */
  async register(input: RegisterRequest, client: ClientMeta): Promise<IssuedSession> {
    assertPasswordPolicy(input.password);
    const account = await this.createAccount(input);
    return this.issue(account, client);
  }

  /** Checks the login limiter, then the password. A success clears the limiter. */
  async login(input: LoginRequest, client: ClientMeta): Promise<IssuedSession> {
    const email = normalizeEmail(input.email);
    await this.assertLoginAllowed(client.ip, email);
    const account = await this.authenticate(email, input.password);
    await this.loginLimits.clear(rateLimitIp(client.ip), email);
    return this.issue(account, client);
  }

  /** Rotates the refresh cookie. Reuse and expiry are distinct failures. */
  async refresh(rawToken: string | undefined, client: ClientMeta): Promise<IssuedSession> {
    if (rawToken === undefined) throw new RefreshInvalidError();
    const result = await this.refreshTokens.rotate(rawToken, this.clock.now(), client);
    if (result.decision === 'reused') throw new RefreshReusedError();
    if (result.decision !== 'rotate') throw new RefreshInvalidError();
    const account = await this.requireAccount(result.userId);
    return this.issueAccess(account, result.refreshToken);
  }

  /** Revokes the presented cookie when it is still active. A second call is not reuse. */
  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken === undefined) return;
    await this.refreshTokens.revokeIfActive(rawToken, this.clock.now());
  }

  /** Loads the account for a verified access token. */
  async me(userId: string): Promise<CurrentUserDto> {
    const account = await this.users.findById(userId);
    if (account === null) throw new UnauthorizedError();
    return toCurrentUser(account);
  }

  private async createAccount(input: RegisterRequest): Promise<Account> {
    return this.users.insert({
      email: normalizeEmail(input.email),
      passwordHash: await this.passwords.hash(input.password),
      displayName: displayNameFrom(input),
    });
  }

  private async assertLoginAllowed(ip: string | null, email: string): Promise<void> {
    const retryAfterSeconds = await this.loginLimits.consume(rateLimitIp(ip), email);
    if (retryAfterSeconds !== null) throw new LoginLimitedError(retryAfterSeconds);
  }

  private async authenticate(email: string, password: string): Promise<Account> {
    const account = await this.users.findByEmail(email);
    const passwordHash = account?.passwordHash ?? (await this.passwords.dummyHash());
    const matches = await this.passwords.verify(password, passwordHash);
    if (account === null || !matches) throw new InvalidCredentialsError();
    return account;
  }

  private async requireAccount(userId: string): Promise<Account> {
    const account = await this.users.findById(userId);
    if (account === null) throw new RefreshInvalidError();
    return account;
  }

  private async issue(account: Account, client: ClientMeta): Promise<IssuedSession> {
    const refreshToken = await this.refreshTokens.issue(account.id, this.clock.now(), client);
    return this.issueAccess(account, refreshToken);
  }

  private async issueAccess(account: Account, refreshToken: string): Promise<IssuedSession> {
    return {
      accessToken: await this.accessTokens.sign(account),
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
    };
  }
}

function rateLimitIp(ip: string | null): string {
  if (ip === null || ip.length === 0) return 'unknown';
  return ip;
}
