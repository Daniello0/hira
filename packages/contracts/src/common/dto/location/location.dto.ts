/** One row of `GET /api/v1/locations` for the profile picker. */
export interface LocationDto {
  id: number;
  /** City and region, the same label as on a vacancy card. */
  label: string;
  region: string;
  city: string | null;
}
