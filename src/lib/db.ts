import { Pool, QueryResultRow } from "pg";
import { existsSync } from "node:fs";

declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
}

function getPool(): Pool {
  if (global.__dbPool) {
    return global.__dbPool;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL nao configurada");
  }

  const pool = new Pool({ connectionString: resolveConnectionString(connectionString) });

  if (process.env.NODE_ENV !== "production") {
    global.__dbPool = pool;
  }

  return pool;
}

function resolveConnectionString(connectionString: string): string {
  if (process.env.NODE_ENV === "production") {
    return connectionString;
  }

  let parsed: URL;

  try {
    parsed = new URL(connectionString);
  } catch {
    return connectionString;
  }

  if (parsed.hostname !== "db") {
    return connectionString;
  }

  // In Docker Compose, service name "db" resolves normally; outside Docker use localhost.
  if (existsSync("/.dockerenv")) {
    return connectionString;
  }

  parsed.hostname = process.env.DB_HOST_FALLBACK || "localhost";
  return parsed.toString();
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query<T>(sql, params);
  return result.rows;
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
