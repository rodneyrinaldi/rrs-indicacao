import { Pool, QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
}

function getPool(): Pool {
  if (global.__dbPool) {
    return global.__dbPool;
  }

  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;

  if (!connectionString) {
    throw new Error("Nenhuma URL de banco configurada. Defina DATABASE_URL ou SUPABASE_DATABASE_URL.");
  }

  const pool = new Pool({ connectionString });

  global.__dbPool = pool;

  const shutdown = () => {
    pool.end().finally(() => process.exit(0));
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = getPool();
  try {
    const result = await pool.query<T>(sql, params);
    return result.rows;
  } catch (error) {
    throw normalizeDatabaseError(error, sql);
  }
}

function normalizeDatabaseError(error: unknown, sql: string): Error {
  if (error instanceof AggregateError) {
    const causes = error.errors
      .map((entry) => {
        if (entry instanceof Error) {
          return entry.message;
        }
        return String(entry);
      })
      .join(" | ");

    return new Error(`Database query failed (aggregate): ${causes}. SQL: ${compactSql(sql)}`);
  }

  if (error instanceof Error) {
    return new Error(`Database query failed: ${error.message}. SQL: ${compactSql(sql)}`);
  }

  return new Error(`Database query failed: ${String(error)}. SQL: ${compactSql(sql)}`);
}

function compactSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

export async function runAsTenant<T>(
  escritorioId: string,
  callback: (client: { query: Pool["query"] }) => Promise<T>,
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.escritorio_id', $1, true)", [escritorioId]);
    const response = await callback(client);
    await client.query("COMMIT");
    return response;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
