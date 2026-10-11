/** The slice of `pg` used by the stores. A `Pool` and a `Client` both satisfy it. */
export interface SqlClient {
  query(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
}
