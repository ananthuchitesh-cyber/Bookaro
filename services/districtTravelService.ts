import { TripFormData } from "@/lib/gemini";
import { normalizeCityInput } from "@/lib/cities";
import {
  findLocalHotels,
  findLocalStateByName,
  findLocalTransportCosts,
  findLocalTransportRoute,
  LocalHotelRecord,
  LocalTransportCostRecord,
} from "@/lib/localTravelData";
import { getTravelDbPool } from "@/lib/postgres";

export type DistrictTransportPlan = {
  recommended: {
    mode: string;
    operator: string;
    departure: string;
    arrival: string;
    duration: string;
    price_per_person: number;
    total_price: number;
    comfort: string;
    stops: number;
    badge: string;
    notes: string;
  };
  bus: {
    mode: string;
    operator: string;
    departure: string;
    arrival: string;
    duration: string;
    price_per_person: number;
    total_price: number;
    comfort: string;
    stops: number;
    badge: string;
    notes: string;
  };
  train: {
    mode: string;
    operator: string;
    departure: string;
    arrival: string;
    duration: string;
    price_per_person: number;
    total_price: number;
    comfort: string;
    stops: number;
    badge: string;
    notes: string;
  };
  flight: {
    mode: string;
    operator: string;
    departure: string;
    arrival: string;
    duration: string;
    price_per_person: number;
    total_price: number;
    comfort: string;
    stops: number;
    badge: string;
    notes: string;
  };
};

export type DistrictHotelPlan = {
  name: string;
  category: "Budget" | "Recommended" | "Premium";
  rating: number;
  reviews: number;
  price_per_night: number;
  total_cost: number;
  location: string;
  amenities: string[];
  highlights: string;
  badge: string;
};

export type DistrictBudgetBreakdown = {
  transport: number;
  hotel: number;
  food: number;
  sightseeing: number;
  local_transport: number;
  miscellaneous: number;
  grand_total: number;
  per_person: number;
};

const DISTRICT_ALIAS: Record<string, string> = {
  chennai: "Chennai",
  chengalpattu: "Chengalpattu",
  kancheepuram: "Kancheepuram",
  ranipet: "Ranipet",
  vellore: "Vellore",
  tirupattur: "Tirupattur",
  krishnagiri: "Krishnagiri",
  dharmapuri: "Dharmapuri",
  salem: "Salem",
  namakkal: "Namakkal",
  erode: "Erode",
  tiruppur: "Tiruppur",
  coimbatore: "Coimbatore",
  nilgiris: "The Nilgiris",
  thenilgiris: "The Nilgiris",
  ooty: "The Nilgiris",
  karur: "Karur",
  tiruchirappalli: "Tiruchirappalli",
  trichy: "Tiruchirappalli",
  perambalur: "Perambalur",
  ariyalur: "Ariyalur",
  thanjavur: "Thanjavur",
  tanjavur: "Thanjavur",
  tanjore: "Thanjavur",
  tiruvarur: "Tiruvarur",
  nagapattinam: "Nagapattinam",
  mayiladuthurai: "Mayiladuthurai",
  chidambaram: "Chidambaram",
  cuddalore: "Cuddalore",
  villupuram: "Villupuram",
  tiruvannamalai: "Tiruvannamalai",
  kallakurichi: "Kallakurichi",
  pudukkottai: "Pudukkottai",
  madurai: "Madurai",
  dindigul: "Dindigul",
  kodaikanal: "Dindigul",
  kodai: "Dindigul",
  kodaikanalhills: "Dindigul",
  theni: "Theni",
  virudhunagar: "Virudhunagar",
  sivaganga: "Sivaganga",
  ramanathapuram: "Ramanathapuram",
  rameswaram: "Ramanathapuram",
  thoothukudi: "Thoothukudi",
  tuticorin: "Thoothukudi",
  tirunelveli: "Tirunelveli",
  tenkasi: "Tenkasi",
  kanniyakumari: "Kanniyakumari",
  kanyakumari: "Kanniyakumari",
  kaniyakumari: "Kanniyakumari",
  puducherry: "Puducherry",
};

function districtName(input: string): string {
  const key = normalizeCityInput(input || "");
  if (DISTRICT_ALIAS[key]) return DISTRICT_ALIAS[key];
  // Handle common user typos/partial district names gracefully.
  if (key.includes("kanya") || key.includes("kaniya")) return "Kanniyakumari";
  if (key.includes("nilgiri") || key.includes("ooty")) return "The Nilgiris";
  if (key.includes("thanja") || key.includes("tanja") || key.includes("tanjore")) return "Thanjavur";

  for (const alias of Object.keys(DISTRICT_ALIAS)) {
    if (alias.length >= 6 && (key.includes(alias) || alias.includes(key))) {
      return DISTRICT_ALIAS[alias];
    }
  }
  return input.trim();
}

function tierFromMode(mode: TripFormData["mode"]): "budget" | "comfort" | "luxury" {
  if (mode === "budget") return "budget";
  if (mode === "luxury") return "luxury";
  return "comfort";
}

function tierFromHotelType(hotelType: TripFormData["hotelType"]): "budget" | "comfort" | "luxury" {
  if (hotelType === "budget") return "budget";
  if (hotelType === "3-star") return "comfort";
  return "luxury";
}

function modeFromUserTransport(transport: TripFormData["transport"]): "train" | "bus" | "car" | "flight" {
  if (transport === "auto") return "train";
  return transport;
}

function inferModeFromBestRoute(bestRoute: string | null | undefined): "train" | "bus" | "car" | "flight" {
  const text = String(bestRoute || "").toLowerCase();
  if (text.includes("flight") || text.includes("air")) return "flight";
  if (text.includes("train")) return "train";
  if (text.includes("taxi") || text.includes("car")) return "car";
  return "bus";
}

function parseFirstFareMin(text: string | null | undefined): number | null {
  const raw = String(text || "");
  if (!raw || raw.toLowerCase().includes("n/a")) return null;
  const nums = raw.replace(/,/g, "").match(/\d+/g);
  if (!nums?.length) return null;
  const n = Number(nums[0]);
  return Number.isFinite(n) ? n : null;
}

function normalizeDuration(value: string | null | undefined): string {
  const v = String(value || "").trim();
  return v || "As per route/provider schedule";
}

function parseDurationMinutes(value: string | null | undefined): number {
  const s = String(value || "").toLowerCase().trim();
  if (!s) return Number.MAX_SAFE_INTEGER;
  const hh = s.match(/(\d+)\s*h/);
  const mm = s.match(/(\d+)\s*m/);
  const h = hh ? Number(hh[1]) : 0;
  const m = mm ? Number(mm[1]) : 0;
  if (h === 0 && m === 0) return Number.MAX_SAFE_INTEGER;
  return h * 60 + m;
}

function hasFare(text: string | null | undefined): boolean {
  const s = String(text || "").toLowerCase();
  if (!s || s.includes("n/a") || s.includes("no rail")) return false;
  return /\d/.test(s);
}

type TransportMode = "bus" | "train" | "car" | "flight";

function parseAmenities(text: string): string[] {
  return String(text || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function inferStateHint(...values: string[]): string | null {
  for (const value of values) {
    const state = findLocalStateByName(value);
    if (state) return state;
  }
  return null;
}

function estimateFallbackMinimumBudget(
  params: Pick<TripFormData, "source" | "destination" | "startDate" | "endDate" | "travelers">
): { perPerson: number; total: number } {
  const travelers = Math.max(1, Number(params.travelers || 1));
  const rawDiff = Math.round(
    (new Date(params.endDate).getTime() - new Date(params.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const nights = Math.max(1, rawDiff);
  const tripDays = Math.max(1, rawDiff + 1);
  const sourceKey = normalizeCityInput(params.source || "");
  const destinationKey = normalizeCityInput(params.destination || "");
  const samePlace = sourceKey && destinationKey && sourceKey === destinationKey;
  const sourceState = findLocalStateByName(params.source || "");
  const destinationState = findLocalStateByName(params.destination || "");
  const sameState = Boolean(sourceState && destinationState && normalizeCityInput(sourceState) === normalizeCityInput(destinationState));

  const transportPerPerson =
    samePlace ? 500 :
    sameState ? 1800 :
    3500;
  const hotelPerNightPerPerson = samePlace ? 1200 : 1600;
  const foodPerDayPerPerson = 500;
  const sightseeingPerDayPerPerson = 250;
  const localPerDayPerPerson = samePlace ? 200 : 300;

  const subtotal =
    transportPerPerson +
    hotelPerNightPerPerson * nights +
    foodPerDayPerPerson * tripDays +
    sightseeingPerDayPerPerson * Math.max(1, tripDays - 1) +
    localPerDayPerPerson * tripDays;
  const misc = Math.max(500, Math.round(subtotal * 0.08));
  const perPerson = Math.round(subtotal + misc);
  return {
    perPerson,
    total: perPerson * travelers,
  };
}

function pickTierRow<T extends { tier?: string | null }>(
  rows: T[],
  tier: "budget" | "comfort" | "luxury"
): T | undefined {
  return rows.find((row) => String(row.tier || "").toLowerCase() === tier);
}

function buildTransportPlan(
  body: Pick<TripFormData, "source" | "destination" | "mode" | "transport" | "travelers">,
  rows: {
    recommended?: { travel_cost: number | null; stay_per_day: number | null };
    cheapest?: { travel_cost: number | null; stay_per_day: number | null };
    fastest?: { travel_cost: number | null; stay_per_day: number | null };
  },
  routeRow: {
    distance_km: number | null;
    bus_time: string | null;
    taxi_time: string | null;
    train_time: string | null;
    flight_time: string | null;
    best_route: string | null;
    bus_tnstc_fare: string | null;
    bus_setc_ac_fare: string | null;
    taxi_fare_text: string | null;
    train_fare_text: string | null;
    flight_fare_text: string | null;
    train_station_from: string | null;
    train_station_to: string | null;
    flight_available: string | null;
    flight_airport_from: string | null;
    flight_airport_to: string | null;
  } | null | undefined
): DistrictTransportPlan | null {
  const recRow = rows.recommended;
  const cheapRow = rows.cheapest;
  const fastRow = rows.fastest;
  if (!recRow && !cheapRow && !fastRow) return null;

  const source = districtName(body.source);
  const destination = districtName(body.destination);
  const hasFlight = /✅|yes|direct|available/i.test(String(routeRow?.flight_available || ""));
  const hasTrain = hasFare(routeRow?.train_fare_text) && parseDurationMinutes(routeRow?.train_time) < Number.MAX_SAFE_INTEGER;
  const hasBus = hasFare(routeRow?.bus_tnstc_fare) || hasFare(routeRow?.bus_setc_ac_fare);

  const availableModes: TransportMode[] = [];
  if (hasFlight) availableModes.push("flight");
  if (hasTrain) availableModes.push("train");
  if (hasBus) availableModes.push("bus");
  availableModes.push("car");

  const fallbackMode = modeFromUserTransport(body.transport);
  const preferredMode = body.transport === "auto" ? inferModeFromBestRoute(routeRow?.best_route) : fallbackMode;
  const travelers = Math.max(1, Number(body.travelers || 1));
  const stay = Math.max(0, Number((recRow || cheapRow || fastRow)?.stay_per_day || 0));
  const airportTo = String(routeRow?.flight_airport_to || "").trim();
  const destKey = normalizeCityInput(destination);
  const airportKey = normalizeCityInput(airportTo.split("/")[0] || "");
  const needsOnwardTransfer = Boolean(airportTo) && !(destKey.includes(airportKey) || airportKey.includes(destKey));

  const baseRow = recRow || cheapRow || fastRow;

  const mkUnavailable = (mode: TransportMode, badge: string) => {
    const alternative =
      mode === "flight"
        ? airportTo
          ? `No direct flight to ${destination}. Fly to ${airportTo}, then continue by ${hasTrain ? "train" : hasBus ? "bus" : "cab"} to ${destination}.`
          : `No direct flight to ${destination}. Use ${hasTrain ? "train" : hasBus ? "bus" : "cab"} from ${source} to ${destination}.`
        : mode === "train"
          ? hasBus
            ? `No direct train route found. Use bus from ${source} to ${destination}.`
            : airportTo
              ? `No direct train route found. Alternative: fly to ${airportTo} and continue by cab/bus to ${destination}.`
              : `No direct train route found. Use road travel from ${source} to ${destination}.`
          : mode === "bus"
            ? hasTrain
              ? `No direct bus route found. Use train from ${source} to ${destination}.`
              : airportTo
                ? `No direct bus route found. Alternative: fly to ${airportTo} and continue by cab to ${destination}.`
                : `No direct bus route found. Use cab or self-drive from ${source} to ${destination}.`
            : `No reliable cab route found in stored data for ${source} to ${destination}.`;

    return {
      mode,
      operator:
        mode === "flight" ? "Flight unavailable" :
        mode === "train" ? "Train unavailable" :
        mode === "bus" ? "Bus unavailable" :
        "Cab unavailable",
      departure: source,
      arrival: destination,
      duration: "Not available for this route",
      price_per_person: 0,
      total_price: 0,
      comfort: "N/A",
      stops: 0,
      badge,
      notes: alternative,
    };
  };

  const mk = (
    row: { travel_cost: number | null; stay_per_day: number | null } | undefined,
    mode: TransportMode,
    badge: string,
    comfort: string
  ) => {
    const rowCost = Math.max(0, Number(row?.travel_cost || 0));
    const duration =
      mode === "flight"
        ? routeRow?.flight_time || "As per route/provider schedule"
        : mode === "train"
          ? routeRow?.train_time || "As per route/provider schedule"
          : mode === "car"
            ? routeRow?.taxi_time || routeRow?.bus_time || "As per route/provider schedule"
            : routeRow?.bus_time || "As per route/provider schedule";

    const fareText =
      mode === "flight"
        ? routeRow?.flight_fare_text
        : mode === "train"
          ? routeRow?.train_fare_text
          : mode === "car"
            ? routeRow?.taxi_fare_text || routeRow?.bus_setc_ac_fare || routeRow?.bus_tnstc_fare
            : routeRow?.bus_tnstc_fare || routeRow?.bus_setc_ac_fare;

    const fareMin = parseFirstFareMin(fareText);
    const pp = fareMin ?? rowCost;
    const distance = routeRow?.distance_km ? `${routeRow.distance_km} km` : "N/A";
    const operator =
      mode === "flight" ? "Regional Flight" :
      mode === "train" ? "Indian Railways" :
      mode === "car" ? "Intercity Cabs" :
      "State Transport / Private Bus";
    const departure = mode === "train" ? String(routeRow?.train_station_from || source) : source;
    const arrival = mode === "train" ? String(routeRow?.train_station_to || destination) : destination;

    const routeInstruction =
      mode === "train"
        ? `Take train from ${departure} to ${arrival}. After reaching, go by local cab/auto.`
        : mode === "bus"
          ? `Take direct bus from ${source} to ${destination}. Then use local auto/cab.`
          : mode === "flight"
            ? (needsOnwardTransfer
                ? `Fly from ${routeRow?.flight_airport_from || "source airport"} to ${airportTo}, then continue by train/bus/cab to ${destination}.`
                : hasFlight
                  ? `Take direct flight from ${source} nearest airport to ${destination} nearest airport, then take local cab.`
                  : `No direct flight to ${destination}. Fly to ${airportTo || "nearest airport"}, then continue by train/bus/cab to ${destination}.`)
            : `Take intercity cab from ${source} to ${destination}.`;

    const fallbackFlightTransfer = needsOnwardTransfer && routeRow?.flight_airport_to
      ? `\nFlight transfer option: Fly to ${routeRow.flight_airport_to}, then travel onward by train/bus/cab to ${destination}.`
      : "";

    return {
      mode,
      operator,
      departure,
      arrival,
      duration: normalizeDuration(duration),
      price_per_person: pp,
      total_price: pp * travelers,
      comfort,
      stops: 0,
      badge,
      notes: `Route: ${source} -> ${destination} | Distance: ${distance}
Fare guide: ${fareText || "N/A"} | Stay/day: INR ${stay.toLocaleString()}
${routeInstruction}${fallbackFlightTransfer}`,
    };
  };

  const fareByMode: Record<TransportMode, number> = {
    flight: parseFirstFareMin(routeRow?.flight_fare_text) ?? Number.MAX_SAFE_INTEGER,
    train: parseFirstFareMin(routeRow?.train_fare_text) ?? Number.MAX_SAFE_INTEGER,
    bus: parseFirstFareMin(routeRow?.bus_tnstc_fare || routeRow?.bus_setc_ac_fare) ?? Number.MAX_SAFE_INTEGER,
    car: parseFirstFareMin(routeRow?.taxi_fare_text || routeRow?.bus_setc_ac_fare) ?? Number.MAX_SAFE_INTEGER,
  };

  const durationByMode: Record<TransportMode, number> = {
    flight: parseDurationMinutes(routeRow?.flight_time),
    train: parseDurationMinutes(routeRow?.train_time),
    bus: parseDurationMinutes(routeRow?.bus_time),
    car: parseDurationMinutes(routeRow?.taxi_time || routeRow?.bus_time),
  };

  const uniquePick = (preferred: TransportMode[], already: Set<TransportMode>): TransportMode => {
    for (const mode of preferred) {
      if (!already.has(mode) && availableModes.includes(mode)) return mode;
    }
    for (const mode of availableModes) {
      if (!already.has(mode)) return mode;
    }
    return preferred[0];
  };

  const recommendedMode = uniquePick([preferredMode, "train", "bus", "flight", "car"], new Set());
  const used = new Set<TransportMode>([recommendedMode]);
  const cheapestMode = uniquePick(
    (["bus", "train", "flight", "car"] as TransportMode[]).sort((a, b) => fareByMode[a] - fareByMode[b]),
    used
  );
  used.add(cheapestMode);

  const fastestPriority = (["flight", "train", "bus"] as TransportMode[])
    .filter((mode) => availableModes.includes(mode))
    .sort((a, b) => durationByMode[a] - durationByMode[b]);
  if (availableModes.includes("car")) fastestPriority.push("car");
  const fastestMode = uniquePick(fastestPriority, used);

  return {
    recommended: mk(baseRow, recommendedMode, "Recommended", "Medium"),
    bus: hasBus ? mk(cheapRow || baseRow, "bus", "Bus", "Medium") : mkUnavailable("bus", "Bus"),
    train: hasTrain ? mk(recRow || baseRow, "train", "Train", "High") : mkUnavailable("train", "Train"),
    flight: hasFlight ? mk(fastRow || recRow || baseRow, "flight", "Flight", "High") : mkUnavailable("flight", "Flight"),
  };
}

export async function getDistrictTransportPlan(body: Pick<TripFormData, "source" | "destination" | "mode" | "transport" | "travelers">): Promise<DistrictTransportPlan | null> {
  const localCosts = findLocalTransportCosts(body.source, body.destination);
  const localPlan = buildTransportPlan(
    body,
    {
      recommended: pickTierRow(localCosts, tierFromMode(body.mode)),
      cheapest: pickTierRow(localCosts, "budget"),
      fastest: pickTierRow(localCosts, "luxury"),
    },
    findLocalTransportRoute(body.source, body.destination)
  );
  if (localPlan) return localPlan;

  const pool = getTravelDbPool();
  if (!pool) return null;

  const source = districtName(body.source);
  const destination = districtName(body.destination);
  const stateHint = inferStateHint(destination, source);
  if (!source || !destination) return null;

  const recommendedTier = tierFromMode(body.mode);
  const rowFor = async (tier: "budget" | "comfort" | "luxury") => {
    const sql = `
      SELECT travel_cost, stay_per_day
      FROM district_transport_costs
      WHERE lower(source_district) = lower($1)
        AND lower(destination_district) = lower($2)
        AND lower(tier) = lower($3)
        ${stateHint ? "AND lower(state) = lower($4)" : ""}
      LIMIT 1
      `;
    const res = await pool.query(
      sql,
      stateHint ? [source, destination, tier, stateHint] : [source, destination, tier]
    );
    return res.rows?.[0] as { travel_cost: number | null; stay_per_day: number | null } | undefined;
  };

  const [recRow, cheapRow, fastRow] = await Promise.all([
    rowFor(recommendedTier),
    rowFor("budget"),
    rowFor("luxury"),
  ]);

  const routeRowRes = await pool.query(
    `
    SELECT
      distance_km,
      bus_time,
      taxi_time,
      taxi_fare_text,
      train_time,
      flight_time,
      best_route,
      bus_tnstc_fare,
      bus_setc_ac_fare,
      train_fare_text,
      flight_fare_text,
      train_station_from,
      train_station_to,
      flight_available,
      flight_airport_from,
      flight_airport_to
    FROM district_transport_routes
    WHERE lower(source_district) = lower($1)
      AND lower(destination_district) = lower($2)
      ${stateHint ? "AND lower(state) = lower($3)" : ""}
    LIMIT 1
    `,
    stateHint ? [source, destination, stateHint] : [source, destination]
  );

  const routeRow = routeRowRes.rows?.[0] as {
    distance_km: number | null;
    bus_time: string | null;
    taxi_time: string | null;
    train_time: string | null;
    flight_time: string | null;
    best_route: string | null;
    bus_tnstc_fare: string | null;
    bus_setc_ac_fare: string | null;
    taxi_fare_text: string | null;
    train_fare_text: string | null;
    flight_fare_text: string | null;
    train_station_from: string | null;
    train_station_to: string | null;
    flight_available: string | null;
    flight_airport_from: string | null;
    flight_airport_to: string | null;
  } | undefined;

  if (!recRow && !cheapRow && !fastRow) return null;

  const hasFlight = /✅|yes|direct/i.test(String(routeRow?.flight_available || ""));
  const hasTrain = hasFare(routeRow?.train_fare_text) && parseDurationMinutes(routeRow?.train_time) < Number.MAX_SAFE_INTEGER;
  const hasBus = hasFare(routeRow?.bus_tnstc_fare) || hasFare(routeRow?.bus_setc_ac_fare);

  const availableModes: TransportMode[] = [];
  if (hasFlight) availableModes.push("flight");
  if (hasTrain) availableModes.push("train");
  if (hasBus) availableModes.push("bus");
  availableModes.push("car");

  const fallbackMode = modeFromUserTransport(body.transport);
  const preferredMode = body.transport === "auto" ? inferModeFromBestRoute(routeRow?.best_route) : fallbackMode;
  const travelers = Math.max(1, Number(body.travelers || 1));
  const stay = Math.max(0, Number((recRow || cheapRow || fastRow)?.stay_per_day || 0));
  const airportTo = String(routeRow?.flight_airport_to || "").trim();
  const destKey = normalizeCityInput(destination);
  const airportKey = normalizeCityInput(airportTo.split("/")[0] || "");
  const needsOnwardTransfer = Boolean(airportTo) && !(destKey.includes(airportKey) || airportKey.includes(destKey));

  const mk = (
    row: { travel_cost: number | null; stay_per_day: number | null } | undefined,
    mode: TransportMode,
    badge: string,
    comfort: string
  ) => {
    const rowCost = Math.max(0, Number(row?.travel_cost || 0));
    const duration =
      mode === "flight"
        ? routeRow?.flight_time || "As per route/provider schedule"
        : mode === "train"
          ? routeRow?.train_time || "As per route/provider schedule"
          : mode === "car"
            ? routeRow?.taxi_time || routeRow?.bus_time || "As per route/provider schedule"
            : routeRow?.bus_time || "As per route/provider schedule";

    const fareText =
      mode === "flight"
        ? routeRow?.flight_fare_text
        : mode === "train"
          ? routeRow?.train_fare_text
          : mode === "car"
            ? routeRow?.taxi_fare_text || routeRow?.bus_setc_ac_fare || routeRow?.bus_tnstc_fare
            : routeRow?.bus_tnstc_fare || routeRow?.bus_setc_ac_fare;

    const fareMin = parseFirstFareMin(fareText);
    const pp = fareMin ?? rowCost;
    const distance = routeRow?.distance_km ? `${routeRow.distance_km} km` : "N/A";

    const operator =
      mode === "flight" ? "Regional Flight" :
      mode === "train" ? "Indian Railways" :
      mode === "car" ? "Intercity Cabs" :
      "State Transport / Private Bus";

    const departure = mode === "train" ? String(routeRow?.train_station_from || source) : source;
    const arrival = mode === "train" ? String(routeRow?.train_station_to || destination) : destination;

    const routeInstruction =
      mode === "train"
        ? `Take train from ${departure} to ${arrival}. After reaching, go by local cab/auto.`
        : mode === "bus"
          ? `Take direct bus from ${source} to ${destination}. Then use local auto/cab.`
          : mode === "flight"
            ? (needsOnwardTransfer
                ? `Fly from ${routeRow?.flight_airport_from || "source airport"} to ${airportTo}, then continue by train/bus/cab to ${destination}.`
                : hasFlight
                  ? `Take direct flight from ${source} nearest airport to ${destination} nearest airport, then take local cab.`
                  : `No direct flight to ${destination}. Fly to ${airportTo || "nearest airport"}, then continue by train/bus/cab to ${destination}.`)
            : `Take intercity cab from ${source} to ${destination}.`;

    const fallbackFlightTransfer = needsOnwardTransfer && routeRow?.flight_airport_to
      ? `\nFlight transfer option: Fly to ${routeRow.flight_airport_to}, then travel onward by train/bus/cab to ${destination}.`
      : "";

    return {
      mode,
      operator,
      departure,
      arrival,
      duration: normalizeDuration(duration),
      price_per_person: pp,
      total_price: pp * travelers,
      comfort,
      stops: 0,
      badge,
      notes: `Route: ${source} -> ${destination} | Distance: ${distance}
Fare guide: ${fareText || "N/A"} | Stay/day: INR ${stay.toLocaleString()}
${routeInstruction}${fallbackFlightTransfer}`,
    };
  };

  const fareByMode: Record<TransportMode, number> = {
    flight: parseFirstFareMin(routeRow?.flight_fare_text) ?? Number.MAX_SAFE_INTEGER,
    train: parseFirstFareMin(routeRow?.train_fare_text) ?? Number.MAX_SAFE_INTEGER,
    bus: parseFirstFareMin(routeRow?.bus_tnstc_fare || routeRow?.bus_setc_ac_fare) ?? Number.MAX_SAFE_INTEGER,
    car: parseFirstFareMin(routeRow?.bus_setc_ac_fare) ?? Number.MAX_SAFE_INTEGER,
  };

  const durationByMode: Record<TransportMode, number> = {
    flight: parseDurationMinutes(routeRow?.flight_time),
    train: parseDurationMinutes(routeRow?.train_time),
    bus: parseDurationMinutes(routeRow?.bus_time),
    car: parseDurationMinutes(routeRow?.taxi_time || routeRow?.bus_time),
  };

  const uniquePick = (preferred: TransportMode[], already: Set<TransportMode>): TransportMode => {
    for (const m of preferred) {
      if (!already.has(m) && availableModes.includes(m)) return m;
    }
    for (const m of availableModes) {
      if (!already.has(m)) return m;
    }
    return preferred[0];
  };

  const baseRow = recRow || cheapRow || fastRow;
  const mkUnavailable = (mode: TransportMode, badge: string) => ({
    mode,
    operator:
      mode === "flight" ? "Flight unavailable" :
      mode === "train" ? "Train unavailable" :
      mode === "bus" ? "Bus unavailable" :
      "Cab unavailable",
    departure: source,
    arrival: destination,
    duration: "Not available for this route",
    price_per_person: 0,
    total_price: 0,
    comfort: "N/A",
    stops: 0,
    badge,
    notes: `No reliable ${mode} option found for ${source} to ${destination} in the current route data.`,
  });

  const recommendedMode = uniquePick([preferredMode, "train", "bus", "flight", "car"], new Set());

  return {
    recommended: mk(baseRow, recommendedMode, "Recommended", "Medium"),
    bus: hasBus ? mk(cheapRow || baseRow, "bus", "Bus", "Medium") : mkUnavailable("bus", "Bus"),
    train: hasTrain ? mk(recRow || baseRow, "train", "Train", "High") : mkUnavailable("train", "Train"),
    flight: hasFlight ? mk(fastRow || recRow || baseRow, "flight", "Flight", "High") : mkUnavailable("flight", "Flight"),
  };
}

export async function getDistrictHotels(
  body: Pick<TripFormData, "destination" | "hotelType" | "travelers" | "startDate" | "endDate">
): Promise<DistrictHotelPlan[]> {
  const localHotels = findLocalHotels(body.destination);
  if (localHotels.length) {
    const nights = Math.max(
      1,
      Math.round(
        (new Date(body.endDate).getTime() - new Date(body.startDate).getTime()) / (1000 * 60 * 60 * 24)
      )
    );
    const preferred = tierFromHotelType(body.hotelType);
    const rows = [...localHotels].sort((a, b) => {
      const aRank =
        String(a.category || "").toLowerCase() === preferred ? 0 :
        String(a.category || "").toLowerCase() === "comfort" ? 1 :
        String(a.category || "").toLowerCase() === "budget" ? 2 : 3;
      const bRank =
        String(b.category || "").toLowerCase() === preferred ? 0 :
        String(b.category || "").toLowerCase() === "comfort" ? 1 :
        String(b.category || "").toLowerCase() === "budget" ? 2 : 3;
      return aRank - bRank || Number(b.rating || 0) - Number(a.rating || 0);
    });

    const picks: LocalHotelRecord[] = [];
    const findCat = (cat: string) => rows.find((row) => String(row.category || "").toLowerCase() === cat);
    const budget = findCat("budget");
    const comfort = findCat("comfort");
    const luxury = findCat("luxury");
    if (budget) picks.push(budget);
    if (comfort) picks.push(comfort);
    if (luxury) picks.push(luxury);
    while (picks.length < 3 && rows[picks.length]) picks.push(rows[picks.length]);

    return picks.slice(0, 3).map((hotel, index) => {
      const rawMin = Number(hotel.price_min || 0);
      const rawMax = Number(hotel.price_max || 0);
      const fallbackMin =
        String(hotel.category || "").toLowerCase() === "luxury" ? 7000 :
        String(hotel.category || "").toLowerCase() === "comfort" ? 3000 : 1500;
      const pmin = rawMin > 0 ? rawMin : fallbackMin;
      const pmax = rawMax >= pmin ? rawMax : pmin;
      const nightly = Math.round((pmin + pmax) / 2);
      return {
        name: hotel.hotel_name,
        category: index === 0 ? "Budget" : index === 1 ? "Recommended" : "Premium",
        rating: Number((hotel.rating || 3.8).toFixed(1)),
        reviews: 500 + index * 450,
        price_per_night: nightly,
        total_cost: nightly * nights,
        location: hotel.area || `${body.destination} central area`,
        amenities: parseAmenities(hotel.amenities || "WiFi, AC, Hot Water"),
        highlights: hotel.best_for || `Popular stay option from ${hotel.state} district hotel guide.`,
        badge: index === 0 ? "Budget Pick" : index === 1 ? "Best Value" : "Premium Pick",
      };
    });
  }

  const pool = getTravelDbPool();
  if (!pool) return [];

  const district = districtName(body.destination);
  const stateHint = inferStateHint(body.destination);
  if (!district) return [];

  const nights = Math.max(
    1,
    Math.round(
      (new Date(body.endDate).getTime() - new Date(body.startDate).getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  const preferred = tierFromHotelType(body.hotelType);

  const res = await pool.query(
    `
    SELECT
      hotel_name,
      category,
      star_rating,
      area,
      price_min,
      price_max,
      amenities,
      best_for,
      rating
    FROM district_hotels
    WHERE lower(district) = lower($1)
      ${stateHint ? "AND lower(state) = lower($3)" : ""}
    ORDER BY
      CASE
        WHEN lower(category) = lower($2) THEN 0
        WHEN lower(category) = 'comfort' THEN 1
        WHEN lower(category) = 'budget' THEN 2
        ELSE 3
      END,
      COALESCE(rating, 0) DESC,
      COALESCE(star_rating, 0) DESC
    LIMIT 12
    `,
    stateHint ? [district, preferred, stateHint] : [district, preferred]
  );

  const rows = (res.rows || []) as Array<{
    hotel_name: string;
    category: string;
    star_rating: number | null;
    area: string | null;
    price_min: number | null;
    price_max: number | null;
    amenities: string | null;
    best_for: string | null;
    rating: number | null;
  }>;
  if (!rows.length) return [];

  const picks: typeof rows = [];
  const findCat = (cat: string) => rows.find((r) => String(r.category || "").toLowerCase() === cat);
  const budget = findCat("budget");
  const comfort = findCat("comfort");
  const luxury = findCat("luxury");
  if (budget) picks.push(budget);
  if (comfort) picks.push(comfort);
  if (luxury) picks.push(luxury);
  while (picks.length < 3 && rows[picks.length]) picks.push(rows[picks.length]);

  return picks.slice(0, 3).map((h, i) => {
    const rawMin = Number(h.price_min || 0);
    const rawMax = Number(h.price_max || 0);
    const fallbackMin =
      String(h.category || "").toLowerCase() === "luxury" ? 7000 :
      String(h.category || "").toLowerCase() === "comfort" ? 3000 : 1500;
    const pmin = rawMin > 0 ? rawMin : fallbackMin;
    const pmax = rawMax >= pmin ? rawMax : pmin;
    const nightly = Math.round((pmin + pmax) / 2);
    return {
      name: h.hotel_name,
      category: i === 0 ? "Budget" : i === 1 ? "Recommended" : "Premium",
      rating: Number((h.rating || 3.8).toFixed(1)),
      reviews: 500 + i * 450,
      price_per_night: nightly,
      total_cost: nightly * nights,
      location: h.area || `${district} central area`,
      amenities: parseAmenities(h.amenities || "WiFi, AC, Hot Water"),
      highlights: h.best_for || "Popular stay option from the district hotel guide.",
      badge: i === 0 ? "Budget Pick" : i === 1 ? "Best Value" : "Premium Pick",
    };
  });
}

export async function getDistrictMinimumBudget(params: Pick<TripFormData, "source" | "destination" | "startDate" | "endDate" | "travelers">): Promise<{ perPerson: number; total: number } | null> {
  const localBudgetRow = pickTierRow(findLocalTransportCosts(params.source, params.destination), "budget");
  if (localBudgetRow) {
    const travelers = Math.max(1, Number(params.travelers || 1));
    const days = Math.max(
      1,
      Math.round((new Date(params.endDate).getTime() - new Date(params.startDate).getTime()) / (1000 * 60 * 60 * 24))
    );
    const travel = Math.max(0, Number(localBudgetRow.travel_cost || 0));
    const stay = Math.max(0, Number(localBudgetRow.stay_per_day || 0));
    const base = Math.max(0, Number(localBudgetRow.day1_total || travel + stay));
    const perPerson = Math.round(base + Math.max(0, days - 1) * stay);
    const total = perPerson * travelers;
    return { perPerson, total };
  }

  const pool = getTravelDbPool();
  if (!pool) return null;

  const source = districtName(params.source);
  const destination = districtName(params.destination);
  const stateHint = inferStateHint(params.destination, params.source);
  const travelers = Math.max(1, Number(params.travelers || 1));
  const days = Math.max(
    1,
    Math.round((new Date(params.endDate).getTime() - new Date(params.startDate).getTime()) / (1000 * 60 * 60 * 24))
  );

  const result = await pool.query(
    `
    SELECT travel_cost, stay_per_day, day1_total
    FROM district_transport_costs
    WHERE lower(source_district) = lower($1)
      AND lower(destination_district) = lower($2)
      AND lower(tier) = 'budget'
      ${stateHint ? "AND lower(state) = lower($3)" : ""}
    LIMIT 1
    `,
    stateHint ? [source, destination, stateHint] : [source, destination]
  );
  const row = result.rows?.[0] as { travel_cost: number | null; stay_per_day: number | null; day1_total: number | null } | undefined;
  if (!row) return estimateFallbackMinimumBudget(params);

  const travel = Math.max(0, Number(row.travel_cost || 0));
  const stay = Math.max(0, Number(row.stay_per_day || 0));
  const base = Math.max(0, Number(row.day1_total || travel + stay));
  const perPerson = Math.round(base + Math.max(0, days - 1) * stay);
  const total = perPerson * travelers;
  return { perPerson, total };
}

function getTripDayCount(startDate: string, endDate: string): number {
  const diff = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(10, Math.max(1, diff || 1));
}

function rowToBudgetBreakdown(
  row: LocalTransportCostRecord | { travel_cost: number | null; stay_per_day: number | null; day1_total: number | null; day2_total?: number | null; day3_total?: number | null; day4_total?: number | null; day5_total?: number | null; day6_total?: number | null; day7_total?: number | null; day8_total?: number | null; day9_total?: number | null; day10_total?: number | null; },
  params: Pick<TripFormData, "startDate" | "endDate" | "travelers">
): DistrictBudgetBreakdown {
  const travelers = Math.max(1, Number(params.travelers || 1));
  const dayCount = getTripDayCount(params.startDate, params.endDate);
  const dayKey = `day${dayCount}_total` as keyof typeof row;
  const travelPerPerson = Math.max(0, Number(row.travel_cost || 0));
  const stayPerDay = Math.max(0, Number(row.stay_per_day || 0));
  const storedPerPerson = Math.max(0, Number(row[dayKey] || 0));
  const fallbackPerPerson = Math.max(0, Number(travelPerPerson + Math.max(0, dayCount - 1) * stayPerDay));
  const perPerson = Math.round(storedPerPerson || fallbackPerPerson);
  const grandTotal = perPerson * travelers;
  const transport = Math.round(travelPerPerson * travelers);
  const hotel = Math.max(0, grandTotal - transport);

  return {
    transport,
    hotel,
    food: 0,
    sightseeing: 0,
    local_transport: 0,
    miscellaneous: 0,
    grand_total: grandTotal,
    per_person: perPerson,
  };
}

export async function getDistrictBudgetBreakdown(
  params: Pick<TripFormData, "source" | "destination" | "startDate" | "endDate" | "travelers" | "mode">
): Promise<DistrictBudgetBreakdown | null> {
  const localRow = pickTierRow(findLocalTransportCosts(params.source, params.destination), tierFromMode(params.mode));
  if (localRow) {
    return rowToBudgetBreakdown(localRow, params);
  }

  const pool = getTravelDbPool();
  if (!pool) return null;

  const source = districtName(params.source);
  const destination = districtName(params.destination);
  const tier = tierFromMode(params.mode);
  const stateHint = inferStateHint(params.destination, params.source);

  const result = await pool.query(
    `
    SELECT
      travel_cost,
      stay_per_day,
      day1_total,
      day2_total,
      day3_total,
      day4_total,
      day5_total,
      day6_total,
      day7_total,
      day8_total,
      day9_total,
      day10_total
    FROM district_transport_costs
    WHERE lower(source_district) = lower($1)
      AND lower(destination_district) = lower($2)
      AND lower(tier) = lower($3)
      ${stateHint ? "AND lower(state) = lower($4)" : ""}
    LIMIT 1
    `,
    stateHint ? [source, destination, tier, stateHint] : [source, destination, tier]
  );

  const row = result.rows?.[0] as {
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
  } | undefined;

  if (!row) return null;
  return rowToBudgetBreakdown(row, params);
}
