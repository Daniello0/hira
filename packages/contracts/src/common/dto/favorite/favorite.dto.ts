import type { AuthorKind } from '../../enums/author-kind.enum';
import type { VacancyCardSummary } from './vacancy-card-summary.dto';

/** One saved vacancy. `addedBy` is `USER` for the button; `ASSISTANT` is reserved. */
export interface FavoriteDto {
  id: string;
  vacancyId: string;
  collectionId: string | null;
  note: string | null;
  addedBy: AuthorKind;
  createdAt: string;
  vacancy: VacancyCardSummary;
}

/** Body of `POST /api/v1/favorites`. The server sets `addedBy` to `USER`. */
export interface CreateFavoriteRequest {
  vacancyId: string;
  collectionId?: string | null;
  note?: string | null;
}

/** Body of `PATCH /api/v1/favorites/{id}`. */
export interface UpdateFavoriteRequest {
  collectionId?: string | null;
  note?: string | null;
}
