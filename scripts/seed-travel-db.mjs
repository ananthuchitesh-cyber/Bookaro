import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { loadLocalEnv } from "./load-local-env.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadLocalEnv(rootDir);
const defaultDataPath = path.join(rootDir, "db", "compiled", "india-travel-data.json");
const schemaSql = fs.readFileSync(path.join(rootDir, "db", "travel-schema.sql"), "utf8");

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function chunk(items, size) {
  const parts = [];
  for (let index = 0; index < items.length; index += size) {
    parts.push(items.slice(index, index + size));
  }
  return parts;
}

function createValuesSql(rows, columnCount, startAt = 1) {
  const sqlRows = [];
  let parameterIndex = startAt;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const placeholders = [];
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      placeholders.push(`$${parameterIndex}`);
      parameterIndex += 1;
    }
    sqlRows.push(`(${placeholders.join(", ")})`);
  }

  return sqlRows.join(",\n");
}

async function batchInsert(client, rows, columnCount, sqlFactory, batchSize = 500) {
  for (const batch of chunk(rows, batchSize)) {
    await client.query(sqlFactory(createValuesSql(batch, columnCount)), batch.flat());
  }
}

function getDataPath() {
  const argIndex = process.argv.indexOf("--data");
  if (argIndex >= 0 && process.argv[argIndex + 1]) {
    return path.resolve(process.argv[argIndex + 1]);
  }
  return path.resolve(process.env.TRAVEL_DATA_JSON_PATH || defaultDataPath);
}

async function main() {
  if (!process.env.TRAVEL_DB_URL) {
    throw new Error("TRAVEL_DB_URL is missing.");
  }

  const dataPath = getDataPath();
  if (!fs.existsSync(dataPath)) {
    throw new Error(`Compiled travel dataset not found at ${dataPath}`);
  }

  const dataset = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const reset = process.argv.includes("--reset");

  const pool = new Pool({
    connectionString: process.env.TRAVEL_DB_URL,
    ssl: process.env.PG_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(schemaSql);

    if (reset) {
      await client.query(`
        TRUNCATE TABLE
          tourist_places,
          destinations,
          district_hotels,
          district_transport_costs,
          district_transport_routes
        RESTART IDENTITY CASCADE
      `);
    }

    const uniqueDestinations = new Map();
    for (const place of dataset.places || []) {
      const slug = `${slugify(place.state)}-${slugify(place.destination)}`;
      if (!uniqueDestinations.has(slug)) {
        uniqueDestinations.set(slug, [place.destination, place.state, slug, null, null]);
      }
    }

    const destinationRows = Array.from(uniqueDestinations.values());
    const destinationIdBySlug = new Map();

    for (const batch of chunk(destinationRows, 250)) {
      const sql = `
        INSERT INTO destinations (name, state, slug, latitude, longitude)
        VALUES ${createValuesSql(batch, 5)}
        ON CONFLICT (slug) DO UPDATE
        SET name = EXCLUDED.name,
            state = EXCLUDED.state
        RETURNING id, slug
      `;
      const result = await client.query(sql, batch.flat());
      for (const row of result.rows) {
        destinationIdBySlug.set(row.slug, row.id);
      }
    }

    const placeRows = [];
    for (const place of dataset.places || []) {
      const slug = `${slugify(place.state)}-${slugify(place.destination)}`;
      const destinationId = destinationIdBySlug.get(slug);
      if (!destinationId) continue;

      placeRows.push([
        destinationId,
        place.district || null,
        place.name,
        place.category || "tourist_attraction",
        place.description || null,
        place.address || `${place.district || place.destination}, ${place.state}`,
        null,
        null,
        place.entry_fee ?? null,
        null,
        Boolean(place.must_visit),
        null,
        place.map_url || null,
      ]);
    }

    await batchInsert(
      client,
      placeRows,
      13,
      (valuesSql) => `
        INSERT INTO tourist_places
          (destination_id, district, name, category, description, address, rating, review_count, entry_fee, best_time, must_visit, image_url, map_url)
        VALUES ${valuesSql}
        ON CONFLICT (destination_id, name, address) DO UPDATE
        SET category = EXCLUDED.category,
            description = EXCLUDED.description,
            entry_fee = EXCLUDED.entry_fee,
            must_visit = EXCLUDED.must_visit,
            map_url = EXCLUDED.map_url
      `
    );

    const hotelRows = (dataset.hotels || []).map((hotel) => [
      hotel.state,
      hotel.district,
      hotel.hotel_name,
      hotel.category || "comfort",
      hotel.star_rating ?? null,
      hotel.area || null,
      hotel.price_min ?? null,
      hotel.price_max ?? null,
      hotel.room_types || null,
      hotel.amenities || null,
      hotel.restaurant || null,
      hotel.ac_heating || null,
      hotel.parking || null,
      hotel.wifi || null,
      hotel.book_via || null,
      hotel.best_for || null,
      hotel.rating ?? null,
    ]);

    await batchInsert(
      client,
      hotelRows,
      17,
      (valuesSql) => `
        INSERT INTO district_hotels
          (state, district, hotel_name, category, star_rating, area, price_min, price_max, room_types, amenities, restaurant, ac_heating, parking, wifi, book_via, best_for, rating)
        VALUES ${valuesSql}
        ON CONFLICT (state, district, hotel_name) DO UPDATE
        SET category = EXCLUDED.category,
            star_rating = EXCLUDED.star_rating,
            area = EXCLUDED.area,
            price_min = EXCLUDED.price_min,
            price_max = EXCLUDED.price_max,
            room_types = EXCLUDED.room_types,
            amenities = EXCLUDED.amenities,
            restaurant = EXCLUDED.restaurant,
            ac_heating = EXCLUDED.ac_heating,
            parking = EXCLUDED.parking,
            wifi = EXCLUDED.wifi,
            book_via = EXCLUDED.book_via,
            best_for = EXCLUDED.best_for,
            rating = EXCLUDED.rating
      `
    );

    const costRows = (dataset.transport_costs || []).map((row) => [
      row.state,
      row.source_district,
      row.destination_district,
      row.tier,
      row.travel_cost ?? null,
      row.stay_per_day ?? null,
      row.day1_total ?? null,
      row.day2_total ?? null,
      row.day3_total ?? null,
      row.day4_total ?? null,
      row.day5_total ?? null,
      row.day6_total ?? null,
      row.day7_total ?? null,
      row.day8_total ?? null,
      row.day9_total ?? null,
      row.day10_total ?? null,
    ]);

    await batchInsert(
      client,
      costRows,
      16,
      (valuesSql) => `
        INSERT INTO district_transport_costs
          (state, source_district, destination_district, tier, travel_cost, stay_per_day, day1_total, day2_total, day3_total, day4_total, day5_total, day6_total, day7_total, day8_total, day9_total, day10_total)
        VALUES ${valuesSql}
        ON CONFLICT (state, source_district, destination_district, tier) DO UPDATE
        SET travel_cost = EXCLUDED.travel_cost,
            stay_per_day = EXCLUDED.stay_per_day,
            day1_total = EXCLUDED.day1_total,
            day2_total = EXCLUDED.day2_total,
            day3_total = EXCLUDED.day3_total,
            day4_total = EXCLUDED.day4_total,
            day5_total = EXCLUDED.day5_total,
            day6_total = EXCLUDED.day6_total,
            day7_total = EXCLUDED.day7_total,
            day8_total = EXCLUDED.day8_total,
            day9_total = EXCLUDED.day9_total,
            day10_total = EXCLUDED.day10_total
      `
    );

    const routeRows = (dataset.transport_routes || []).map((row) => [
      row.state,
      row.source_district,
      row.destination_district,
      row.distance_km ?? null,
      row.bus_time || null,
      row.bus_tnstc_fare || null,
      row.bus_setc_ac_fare || null,
      row.taxi_fare_text || null,
      row.taxi_fare_min ?? null,
      row.taxi_fare_max ?? null,
      row.taxi_time || null,
      row.train_available || null,
      row.train_station_from || null,
      row.train_station_to || null,
      row.train_fare_text || null,
      row.train_time || null,
      row.flight_available || null,
      row.flight_airport_from || null,
      row.flight_airport_to || null,
      row.flight_fare_text || null,
      row.flight_time || null,
      row.best_route || null,
    ]);

    await batchInsert(
      client,
      routeRows,
      22,
      (valuesSql) => `
        INSERT INTO district_transport_routes
          (state, source_district, destination_district, distance_km, bus_time, bus_tnstc_fare, bus_setc_ac_fare, taxi_fare_text, taxi_fare_min, taxi_fare_max, taxi_time, train_available, train_station_from, train_station_to, train_fare_text, train_time, flight_available, flight_airport_from, flight_airport_to, flight_fare_text, flight_time, best_route)
        VALUES ${valuesSql}
        ON CONFLICT (state, source_district, destination_district) DO UPDATE
        SET distance_km = EXCLUDED.distance_km,
            bus_time = EXCLUDED.bus_time,
            bus_tnstc_fare = EXCLUDED.bus_tnstc_fare,
            bus_setc_ac_fare = EXCLUDED.bus_setc_ac_fare,
            taxi_fare_text = EXCLUDED.taxi_fare_text,
            taxi_fare_min = EXCLUDED.taxi_fare_min,
            taxi_fare_max = EXCLUDED.taxi_fare_max,
            taxi_time = EXCLUDED.taxi_time,
            train_available = EXCLUDED.train_available,
            train_station_from = EXCLUDED.train_station_from,
            train_station_to = EXCLUDED.train_station_to,
            train_fare_text = EXCLUDED.train_fare_text,
            train_time = EXCLUDED.train_time,
            flight_available = EXCLUDED.flight_available,
            flight_airport_from = EXCLUDED.flight_airport_from,
            flight_airport_to = EXCLUDED.flight_airport_to,
            flight_fare_text = EXCLUDED.flight_fare_text,
            flight_time = EXCLUDED.flight_time,
            best_route = EXCLUDED.best_route
      `
    );

    await client.query("COMMIT");
    console.log(
      `Seeded travel database from ${dataPath}\n` +
      `destinations=${destinationRows.length}, places=${placeRows.length}, hotels=${hotelRows.length}, costs=${costRows.length}, routes=${routeRows.length}`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
