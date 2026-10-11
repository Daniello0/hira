/** Access token returned in the JSON body. The refresh token travels in a cookie. */
export interface AuthSessionDto {
  accessToken: string;
  expiresIn: number;
}
