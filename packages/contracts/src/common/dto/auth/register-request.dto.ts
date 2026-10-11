/** Body of `POST /api/v1/auth/register`. Shape follows Wiki/05-api-contracts.md. */
export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}
