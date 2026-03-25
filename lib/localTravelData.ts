import fs from "node:fs";
import path from "node:path";
import { normalizeCityInput } from "@/lib/cities";

export type LocalPlaceRecord = {
  state: string;
  district: string;
  destination: string;
  name: string;
  category: string;
  description: string;
  address: string;
  entry_fee: number | null;
  must_visit: boolean;
  map_url: string;
};

export type LocalHotelRecord = {
  state: string;
  district: string;
  hotel_name: string;
  category: string;
  star_rating: number | null;
  area: string;
  price_min: number | null;
  price_max: number | null;
  room_types: string;
  amenities: string;
  restaurant: string;
  ac_heating: string;
  parking: string;
  wifi: string;
  book_via: string;
  best_for: string;
  rating: number | null;
};

export type LocalTransportCostRecord = {
  state: string;
  source_district: string;
  destination_district: string;
  tier: "budget" | "comfort" | "luxury";
  travel_cost: number | null;
  stay_per_day: number | null;
  day1_total: number | null;
  day2_total: number | null;
  day3_total: number | null;
  day4_total: number | null;
  day5_total: number | null;
  day6_total: number | null;
  day7_total: number | null;
  day8_total: number | null;
  day9_total: number | null;
  day10_total: number | null;
};

export type LocalTransportRouteRecord = {
  state: string;
  source_district: string;
  destination_district: string;
  distance_km: number | null;
  bus_time: string;
  bus_tnstc_fare: string;
  bus_setc_ac_fare: string;
  taxi_fare_text: string;
  taxi_fare_min: number | null;
  taxi_fare_max: number | null;
  taxi_time: string;
  train_available: string;
  train_station_from: string;
  train_station_to: string;
  train_fare_text: string;
  train_time: string;
  flight_available: string;
  flight_airport_from: string;
  flight_airport_to: string;
  flight_fare_text: string;
  flight_time: string;
  best_route: string;
};

type LocalTravelDataset = {
  generated_at: string;
  source_dir: string;
  states: string[];
  places: LocalPlaceRecord[];
  hotels: LocalHotelRecord[];
  transport_costs: LocalTransportCostRecord[];
  transport_routes: LocalTransportRouteRecord[];
};

const DEFAULT_DATA_PATH = path.join(process.cwd(), "db", "compiled", "india-travel-data.json");

let cachedData: LocalTravelDataset | null | undefined;

function normalizeLoose(value: string): string {
  return normalizeCityInput(value || "");
}

function getCandidateNames(value: string): string[] {
  const key = normalizeLoose(value);
  const candidates = new Set<string>([key]);

  if (key.startsWith("thiru")) candidates.add(`t${key.slice(1)}`);
  if (key.startsWith("tiru")) candidates.add(`th${key.slice(1)}`);

  if (key === "ooty" || key.includes("nilgiri")) candidates.add("thenilgiris");
  if (key.includes("kanyakumari") || key.includes("kanniyakumari") || key.includes("kaniyakumari")) {
    candidates.add("kanniyakumari");
  }
  if (key.includes("tiruchi") || key.includes("trichy")) candidates.add("tiruchirappalli");
  if (key.includes("tanjore") || key.includes("tanjavur") || key.includes("thanjavur")) candidates.add("thanjavur");
  if (key.includes("jammu") && key.includes("kashmir")) candidates.add("jammuandkashmir");

  return Array.from(candidates);
}

function matchName(value: string, query: string): boolean {
  const valueKey = normalizeLoose(value);
  for (const candidate of getCandidateNames(query)) {
    if (!candidate) continue;
    if (valueKey === candidate) return true;
    if (candidate.length >= 5 && (valueKey.includes(candidate) || candidate.includes(valueKey))) {
      return true;
    }
  }
  return false;
}

function resolveDataPath(): string {
  const envPath = process.env.TRAVEL_DATA_JSON_PATH?.trim();
  return envPath ? path.resolve(envPath) : DEFAULT_DATA_PATH;
}

export function getLocalTravelData(): LocalTravelDataset | null {
  if (cachedData !== undefined) return cachedData;

  const filePath = resolveDataPath();
  if (!fs.existsSync(filePath)) {
    cachedData = null;
    return cachedData;
  }

  try {
    cachedData = JSON.parse(fs.readFileSync(filePath, "utf8")) as LocalTravelDataset;
    return cachedData;
  } catch (error) {
    console.error("[localTravelData] failed to load dataset:", error);
    cachedData = null;
    return cachedData;
  }
}

export function findLocalPlaces(destination: string): LocalPlaceRecord[] {
  const data = getLocalTravelData();
  if (!data) return [];
  const stateMatch = resolveLocalStateName(destination);
  if (stateMatch) {
    return data.places.filter((place) => normalizeLoose(place.state) === normalizeLoose(stateMatch));
  }
  return data.places.filter(
    (place) => matchName(place.destination, destination) || matchName(place.district, destination)
  );
}

export function findLocalHotels(destination: string): LocalHotelRecord[] {
  const data = getLocalTravelData();
  if (!data) return [];
  return data.hotels.filter((hotel) => matchName(hotel.district, destination));
}

export function findLocalTransportCosts(source: string, destination: string): LocalTransportCostRecord[] {
  const data = getLocalTravelData();
  if (!data) return [];
  return data.transport_costs.filter(
    (row) => matchName(row.source_district, source) && matchName(row.destination_district, destination)
  );
}

export function findLocalTransportRoute(source: string, destination: string): LocalTransportRouteRecord | null {
  const data = getLocalTravelData();
  if (!data) return null;
  return (
    data.transport_routes.find(
      (row) => matchName(row.source_district, source) && matchName(row.destination_district, destination)
    ) || null
  );
}

export function findLocalStateByName(value: string): string | null {
  const data = getLocalTravelData();
  if (!data) return null;

  const stateMatch = resolveLocalStateName(value);
  if (stateMatch) return stateMatch;

  for (const row of data.transport_routes) {
    if (matchName(row.source_district, value) || matchName(row.destination_district, value)) {
      return row.state;
    }
  }
  for (const row of data.hotels) {
    if (matchName(row.district, value)) return row.state;
  }
  for (const row of data.places) {
    if (matchName(row.district, value) || matchName(row.destination, value)) return row.state;
  }
  return null;
}

export function resolveLocalStateName(value: string): string | null {
  const data = getLocalTravelData();
  if (!data) return null;

  const key = normalizeLoose(value);
  return data.states.find((state) => normalizeLoose(state) === key) || null;
}
