import { Algorithm, hash, verify, type Options } from '@node-rs/argon2';
import { Injectable } from '@nestjs/common';
import { ARGON2_MEMORY_KIB, ARGON2_PARALLELISM, ARGON2_TIME_COST } from './auth.constants';

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

const ARGON2ID_OPTIONS: Options = {
  algorithm: Algorithm.Argon2id,
  memoryCost: ARGON2_MEMORY_KIB,
  timeCost: ARGON2_TIME_COST,
  parallelism: ARGON2_PARALLELISM,
};

const DUMMY_PASSWORD = 'hira-dummy-password-not-a-user-secret';

export interface PasswordHasher {
  /** Stores a new argon2id hash. */
  hash(password: string): Promise<string>;
  /** Checks `password` against a stored hash. */
  verify(password: string, passwordHash: string): Promise<boolean>;
  /** Hash used when the email is unknown, so login timing does not reveal the account. */
  dummyHash(): Promise<string>;
}

/** argon2id with the memory, time, and parallelism from Wiki/07. */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  private cachedDummy: string | undefined;

  /** @inheritdoc */
  hash(password: string): Promise<string> {
    return hash(password, ARGON2ID_OPTIONS);
  }

  /** @inheritdoc */
  verify(password: string, passwordHash: string): Promise<boolean> {
    return verify(passwordHash, password);
  }

  /** @inheritdoc */
  async dummyHash(): Promise<string> {
    this.cachedDummy ??= await this.hash(DUMMY_PASSWORD);
    return this.cachedDummy;
  }
}
