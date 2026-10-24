import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { CollectionDto, FavoriteDto, VacancyCardSummary } from '@hira/contracts';
import { asSql } from '../chat/typeorm-chat.sql';
import type { CollectionPatch, FavoriteListQuery, FavoritePatch, FavoriteStore, NewCollection, NewFavorite } from './favorite.store';
import * as rows from './typeorm-favorite.sql';

/** PostgreSQL `FavoriteStore`. */
@Injectable()
export class TypeOrmFavoriteStore implements FavoriteStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** @inheritdoc */
  list(userId: string, query: FavoriteListQuery): Promise<FavoriteDto[]> {
    return rows.listFavorites(asSql(this.dataSource), userId, query);
  }

  /** @inheritdoc */
  findByVacancy(userId: string, vacancyId: string): Promise<FavoriteDto | null> {
    return rows.findFavoriteByVacancy(asSql(this.dataSource), userId, vacancyId);
  }

  /** @inheritdoc */
  insert(input: NewFavorite): Promise<FavoriteDto | null> {
    return rows.insertFavorite(asSql(this.dataSource), input);
  }

  /** @inheritdoc */
  update(userId: string, id: string, patch: FavoritePatch): Promise<FavoriteDto | null> {
    return rows.updateFavorite(asSql(this.dataSource), userId, id, patch);
  }

  /** @inheritdoc */
  delete(userId: string, id: string): Promise<boolean> {
    return rows.deleteFavorite(asSql(this.dataSource), userId, id);
  }

  /** @inheritdoc */
  listCollections(userId: string): Promise<CollectionDto[]> {
    return rows.listCollections(asSql(this.dataSource), userId);
  }

  /** @inheritdoc */
  findCollection(userId: string, id: string): Promise<CollectionDto | null> {
    return rows.findCollection(asSql(this.dataSource), userId, id);
  }

  /** @inheritdoc */
  findDefaultCollection(userId: string): Promise<CollectionDto | null> {
    return rows.findDefaultCollection(asSql(this.dataSource), userId);
  }

  /** @inheritdoc */
  insertCollection(input: NewCollection): Promise<CollectionDto> {
    return rows.insertCollection(asSql(this.dataSource), input);
  }

  /** @inheritdoc */
  updateCollection(userId: string, id: string, patch: CollectionPatch): Promise<CollectionDto | null> {
    return rows.updateCollection(asSql(this.dataSource), userId, id, patch);
  }

  /** @inheritdoc */
  deleteCollection(userId: string, id: string): Promise<boolean> {
    return rows.deleteCollection(asSql(this.dataSource), userId, id);
  }

  /** @inheritdoc */
  vacancySummary(vacancyId: string): Promise<VacancyCardSummary | null> {
    return rows.loadVacancySummary(asSql(this.dataSource), vacancyId);
  }
}
