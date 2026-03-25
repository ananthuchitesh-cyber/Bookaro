import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { loadLocalEnv } from "./load-local-env.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv(rootDir);

function readSchema(fileName) {
  return fs.readFileSync(path.join(rootDir, "db", fileName), "utf8");
}

function resetSqlFor(schemaFile) {
  if (schemaFile === "travel-schema.sql") {
    return `
      DROP TABLE IF EXISTS tourist_places CASCADE;
      DROP TABLE IF EXISTS destinations CASCADE;
      DROP TABLE IF EXISTS district_hotels CASCADE;
      DROP TABLE IF EXISTS district_transport_costs CASCADE;
      DROP TABLE IF EXISTS district_transport_routes CASCADE;
    `;
  }

  return `
    DROP TABLE IF EXISTS trip_plans CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `;
}

async function applySchema(label, connectionString, schemaFile) {
  if (!connectionString) {
    throw new Error(`${label} is missing. Set the matching environment variable first.`);
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await pool.query(resetSqlFor(schemaFile));
    await pool.query(readSchema(schemaFile));
    console.log(`Initialized ${label}`);
  } finally {
    await pool.end();
  }
}

async function main() {
  const target = (process.argv[2] || "all").toLowerCase();

  if (!["all", "travel", "user"].includes(target)) {
    throw new Error(`Unknown target "${target}". Use: all, travel, or user.`);
  }

  if (target === "all" || target === "travel") {
    await applySchema("travel database", process.env.TRAVEL_DB_URL, "travel-schema.sql");
  }

  if (target === "all" || target === "user") {
    await applySchema("user database", process.env.USER_DB_URL, "user-schema.sql");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
