import { Pool, QueryResultRow } from "pg";
import { existsSync } from "node:fs";

declare global {
  // eslint-disable-next-line no-var
  var __dbPool: Pool | undefined;
}

type ConnectionMode = "local" | "supabase";

const VALID_CONNECTION_MODES: ConnectionMode[] = ["local", "supabase"];

function getPool(): Pool {
  if (global.__dbPool) {
    return global.__dbPool;
  }

  const connectionString = resolveConfiguredConnectionString();

  if (!connectionString) {
    throw new Error(
      "Nenhuma URL de banco configurada. Defina DATABASE_URL ou configure PRIMARY_DB com variaveis do provedor.",
    );
  }

  const pool = new Pool({ connectionString: resolveConnectionString(connectionString) });

  global.__dbPool = pool;

  const shutdown = () => {
    pool.end().finally(() => process.exit(0));
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return pool;
}

function resolveConfiguredConnectionString(): string | undefined {
  const mode = resolveConnectionMode();

  if (mode === "supabase") {
    const supabaseUrl = process.env.SUPABASE_DATABASE_URL_SCHEMA || process.env.SUPABASE_DATABASE_URL;
    if (!supabaseUrl) {
      throw new Error(
        "DB_CONNECTION_MODE=supabase exige SUPABASE_DATABASE_URL ou SUPABASE_DATABASE_URL_SCHEMA.",
      );
    }
    return supabaseUrl;
  }

  const localUrl = process.env.DATABASE_URL_SCHEMA || process.env.DATABASE_URL;
  if (!localUrl) {
    throw new Error("DB_CONNECTION_MODE=local exige DATABASE_URL ou DATABASE_URL_SCHEMA.");
  }
  return localUrl;
}

function resolveConnectionMode(): ConnectionMode {
  const explicitMode = (process.env.DB_CONNECTION_MODE || "").trim().toLowerCase();
  const legacyMode = (process.env.PRIMARY_DB || "").trim().toLowerCase();

  if (explicitMode && legacyMode && explicitMode !== legacyMode) {
    throw new Error(
      "Conflito de configuracao: DB_CONNECTION_MODE e PRIMARY_DB possuem valores diferentes.",
    );
  }

  const mode = (explicitMode || legacyMode || "local") as ConnectionMode;
  if (!VALID_CONNECTION_MODES.includes(mode)) {
    throw new Error(
      `Modo de conexao invalido: \"${mode}\". Use apenas ${VALID_CONNECTION_MODES.join(" | ")}.`,
    );
  }

  return mode;
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

  if (parsed.hostname !== "db" && parsed.hostname !== "postgres") {
    return connectionString;
  }

  // In Docker Compose, service names resolve normally; outside Docker use localhost.
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
