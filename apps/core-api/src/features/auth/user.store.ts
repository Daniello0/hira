import type { CurrentUserDto } from '@hira/contracts';
import { UserRole } from '@hira/contracts';

export const USER_STORE = Symbol('USER_STORE');

export interface NewAccount {
  email: string;
  passwordHash: string;
  displayName: string | null;
}

export interface Account {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  passwordHash: string;
  crossChatMemoryEnabled: boolean;
}

export interface UserStore {
  findByEmail(email: string): Promise<Account | null>;
  findById(id: string): Promise<Account | null>;
  insert(input: NewAccount): Promise<Account>;
}

/** Raised when `users.email` is already taken. */
export class EmailTakenError extends Error {
  constructor() {
    super('Email is already registered');
    this.name = 'EmailTakenError';
  }
}

/** Drops the password hash before the account leaves the service. */
export function toCurrentUser(account: Account): CurrentUserDto {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    crossChatMemoryEnabled: account.crossChatMemoryEnabled,
  };
}
