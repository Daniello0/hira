import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { CreateFeedbackRequest, FeedbackDto } from '@hira/contracts';
import { DataSource } from 'typeorm';
import { asSql } from '../chat/typeorm-chat.sql';
import { VacancyMissingError } from '../favorite/favorite.errors';
import { FOREIGN_KEY_VIOLATION } from './feedback.constants';
import { MessageMissingError } from './feedback.errors';
import { ownsMessage, upsertFeedback } from './typeorm-feedback.sql';

/** Relevance votes on vacancies shown in assistant messages. */
@Injectable()
export class FeedbackService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Stores one vote. A repeated vote on the same message and vacancy replaces the previous one.
   * Throws `MessageMissingError` for another account's message and `VacancyMissingError` for an unknown vacancy.
   */
  async vote(userId: string, request: CreateFeedbackRequest): Promise<FeedbackDto> {
    const sql = asSql(this.dataSource);
    if (!(await ownsMessage(sql, userId, request.messageId))) throw new MessageMissingError();
    try {
      return await upsertFeedback(sql, { userId, ...request, comment: request.comment ?? null });
    } catch (error) {
      if (isForeignKeyViolation(error)) throw new VacancyMissingError();
      throw error;
    }
  }
}

function isForeignKeyViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const row = error as { code?: string; driverError?: { code?: string } };
  return row.code === FOREIGN_KEY_VIOLATION || row.driverError?.code === FOREIGN_KEY_VIOLATION;
}
