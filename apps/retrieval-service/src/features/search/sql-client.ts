/** The slice of `pg` a branch query needs. A pooled client satisfies it. */
export interface SqlClient {
  query(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
}
