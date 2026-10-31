import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { UserRole, type UserPlan } from '@hira/contracts';
import { DataSource } from 'typeorm';
import { User } from '../user/user.entity';
import { EmailTakenError, type Account, type NewAccount, type UserStore } from './user.store';

/** TypeORM `UserStore`. Unique email violations become `EmailTakenError`. */
@Injectable()
export class TypeOrmUserStore implements UserStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** @inheritdoc */
  async findByEmail(email: string): Promise<Account | null> {
    const user = await this.dataSource.getRepository(User).findOne({ where: { email } });
    return user === null ? null : toAccount(user);
  }

  /** @inheritdoc */
  async findById(id: string): Promise<Account | null> {
    const user = await this.dataSource.getRepository(User).findOne({ where: { id } });
    return user === null ? null : toAccount(user);
  }

  /** @inheritdoc */
  async insert(input: NewAccount): Promise<Account> {
    try {
      const saved = await this.dataSource.getRepository(User).save(this.row(input));
      return toAccount(saved);
    } catch (error) {
      if (isUniqueViolation(error)) throw new EmailTakenError();
      throw error;
    }
  }

  /** @inheritdoc */
  async setCrossChatMemory(userId: string, enabled: boolean): Promise<boolean> {
    const result = await this.dataSource.getRepository(User).update({ id: userId }, { crossChatMemoryEnabled: enabled });
    return (result.affected ?? 0) > 0;
  }

  /** @inheritdoc */
  async setPlan(userId: string, plan: UserPlan): Promise<boolean> {
    const result = await this.dataSource.getRepository(User).update({ id: userId }, { plan });
    return (result.affected ?? 0) > 0;
  }

  private row(input: NewAccount): User {
    return this.dataSource.getRepository(User).create({
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      role: UserRole.User,
    });
  }
}

function toAccount(user: User): Account {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    plan: user.plan,
    passwordHash: user.passwordHash,
    crossChatMemoryEnabled: user.crossChatMemoryEnabled,
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const row = error as { code?: string; driverError?: { code?: string } };
  return row.code === '23505' || row.driverError?.code === '23505';
}
