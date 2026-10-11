import type { UserRole } from '../../enums/user-role.enum';

/** `GET /api/v1/auth/me`. The password hash is never included. */
export interface CurrentUserDto {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  crossChatMemoryEnabled: boolean;
}
