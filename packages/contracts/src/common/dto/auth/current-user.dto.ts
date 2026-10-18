import type { UserRole } from '../../enums/user-role.enum';

/** Searches already counted today. Reading this does not consume a search. */
export interface SearchQuota {
  used: number;
  limit: number;
}

/** `GET /api/v1/auth/me`. The password hash is never included. */
export interface CurrentUserDto {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  crossChatMemoryEnabled: boolean;
  searchQuota: SearchQuota;
}
