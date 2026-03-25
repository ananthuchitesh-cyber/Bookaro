type PgPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
};

declare global {
  var __travelDbPool: PgPool | undefined;
  var __userDbPool: PgPool | undefined;
}

function createPool(connectionString: string | undefined): PgPool | null {
  if (!connectionString) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg");
  return new Pool({
    connectionString,
    ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });
}

/** Pool for travel reference data (tourist_places, district_hotels, etc.) */
export function getTravelDbPool(): PgPool | null {
  if (!global.__travelDbPool) {
    const pool = createPool(process.env.TRAVEL_DB_URL || process.env.DATABASE_URL);
    if (!pool) return null;
    global.__travelDbPool = pool;
  }
  return global.__travelDbPool ?? null;
}

/** Pool for user data (users, trip_plans) */
export function getUserDbPool(): PgPool | null {
  if (!global.__userDbPool) {
    const pool = createPool(process.env.USER_DB_URL || process.env.DATABASE_URL);
    if (!pool) return null;
    global.__userDbPool = pool;
  }
  return global.__userDbPool ?? null;
}

/** @deprecated Use getTravelDbPool() or getUserDbPool() instead */
export function getPgPool(): PgPool | null {
  return getTravelDbPool();
}
