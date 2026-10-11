import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { RefreshToken } from '../user/refresh-token.entity';
import { CLIENT_IP_MAX_LENGTH, CLIENT_USER_AGENT_MAX_LENGTH } from './auth.constants';
import { decideRefresh } from './refresh-decision';
import { type ClientMeta, type RefreshTokenStore, type RotateResult } from './refresh-token.store';
import { hashToken, newRefreshToken, refreshExpiry } from './token-hash';

/** TypeORM refresh tokens. Rotation locks the presented row so two refreshes cannot both succeed. */
@Injectable()
export class TypeOrmRefreshTokenStore implements RefreshTokenStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** @inheritdoc */
  issue(userId: string, now: Date, meta: ClientMeta): Promise<string> {
    return this.insert(this.dataSource.manager, userId, now, meta);
  }

  /** @inheritdoc */
  rotate(rawToken: string, now: Date, meta: ClientMeta): Promise<RotateResult> {
    const tokenHash = hashToken(rawToken);
    return this.dataSource.transaction((manager) =>
      this.rotateLocked(manager, tokenHash, now, meta),
    );
  }

  /** @inheritdoc */
  async revokeIfActive(rawToken: string, now: Date): Promise<void> {
    await this.dataSource.manager.update(
      RefreshToken,
      { tokenHash: hashToken(rawToken), revokedAt: IsNull() },
      { revokedAt: now },
    );
  }

  private async rotateLocked(
    manager: EntityManager,
    tokenHash: string,
    now: Date,
    meta: ClientMeta,
  ): Promise<RotateResult> {
    const row = await this.findLocked(manager, tokenHash);
    const decision = decideRefresh(row, now);
    if (decision === 'rotate' && row !== null) return this.replace(manager, row, now, meta);
    if (decision === 'reused' && row !== null) return this.reuse(manager, row, now);
    return { decision: 'invalid' };
  }

  private async replace(
    manager: EntityManager,
    row: RefreshToken,
    now: Date,
    meta: ClientMeta,
  ): Promise<RotateResult> {
    await manager.update(RefreshToken, { id: row.id }, { revokedAt: now });
    const refreshToken = await this.insert(manager, row.userId, now, meta);
    return { decision: 'rotate', userId: row.userId, refreshToken };
  }

  private async reuse(manager: EntityManager, row: RefreshToken, now: Date): Promise<RotateResult> {
    await manager.update(
      RefreshToken,
      { userId: row.userId, revokedAt: IsNull() },
      { revokedAt: now },
    );
    return { decision: 'reused', userId: row.userId };
  }

  private findLocked(manager: EntityManager, tokenHash: string): Promise<RefreshToken | null> {
    return manager.findOne(RefreshToken, {
      where: { tokenHash },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private async insert(
    manager: EntityManager,
    userId: string,
    now: Date,
    meta: ClientMeta,
  ): Promise<string> {
    const refreshToken = newRefreshToken();
    await manager.save(manager.create(RefreshToken, this.columns(userId, refreshToken, now, meta)));
    return refreshToken;
  }

  private columns(userId: string, refreshToken: string, now: Date, meta: ClientMeta) {
    return {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: refreshExpiry(now),
      revokedAt: null,
      userAgent: clip(meta.userAgent, CLIENT_USER_AGENT_MAX_LENGTH),
      ip: clip(meta.ip, CLIENT_IP_MAX_LENGTH),
    };
  }
}

function clip(value: string | null, max: number): string | null {
  if (value === null || value.length === 0) return null;
  return value.slice(0, max);
}
