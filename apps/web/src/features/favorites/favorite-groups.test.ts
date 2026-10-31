import { describe, expect, it } from 'vitest';
import type { CollectionDto, FavoriteDto } from '@hira/contracts';
import { groupFavorites } from './favorite-groups';

describe('groupFavorites', () => {
  it('keeps empty collections and groups detached rows as Uncategorized', () => {
    const collections: CollectionDto[] = [
      { id: 'c1', name: 'Saved', description: null, isDefault: true },
      { id: 'c2', name: 'Later', description: null, isDefault: false },
    ];
    const favorites: FavoriteDto[] = [
      favorite('f1', 'v1', 'c1'),
      favorite('f2', 'v2', null),
    ];
    const groups = groupFavorites(favorites, collections);
    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ name: 'Saved', isDefault: true, items: [favorites[0]] });
    expect(groups[1]).toMatchObject({ name: 'Later', isDefault: false, items: [] });
    expect(groups[2]).toMatchObject({ name: 'Uncategorized', isDefault: false, items: [favorites[1]] });
  });
});

function favorite(id: string, vacancyId: string, collectionId: string | null): FavoriteDto {
  return {
    id,
    vacancyId,
    collectionId,
    note: null,
    addedBy: 'USER' as FavoriteDto['addedBy'],
    createdAt: '2026-10-24T12:00:00.000Z',
    vacancy: {
      id: vacancyId,
      source: null,
    title: 'Role',
      companyName: 'Acme',
      locationLabel: null,
      status: 'ACTIVE' as FavoriteDto['vacancy']['status'],
      url: 'https://example.test',
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      workFormat: null,
      isForeignRemote: false,
    },
  };
}
