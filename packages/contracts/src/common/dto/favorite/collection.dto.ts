/** Named group of saved vacancies. */
export interface CollectionDto {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
}

/** Body of `POST /api/v1/collections`. */
export interface CreateCollectionRequest {
  name: string;
  description?: string | null;
}

/** Body of `PATCH /api/v1/collections/{id}`. */
export interface UpdateCollectionRequest {
  name?: string;
  description?: string | null;
}
