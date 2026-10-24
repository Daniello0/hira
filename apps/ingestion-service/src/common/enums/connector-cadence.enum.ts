/** How often a source is collected. Wiki/03-data-sources.md §3. */
export enum ConnectorCadence {
  /** Belarusian sources 1–4: every six hours. */
  SixHourly = 'SIX_HOURLY',
  /** LinkedIn and Indeed: once a night, under a daily request cap. */
  Nightly = 'NIGHTLY',
}
