import { NextRequest, NextResponse } from "next/server";
import { generateTripPlan, extractJSON, TripFormData } from "@/lib/gemini";
import { buildFallbackPlan } from "@/lib/fallback-plan";
import { getAmadeusFlightQuotes, getAmadeusHotelQuotes } from "@/lib/amadeus";
import { GeoapifyContext, getCityCoordinates, getGeoapifyContext } from "@/lib/geoapify";
import { OpenWeatherContext, getOpenWeatherContext } from "@/lib/openweather";
import { lookupIata, normalizeCityInput } from "@/lib/cities";
import { resolveIndianLocationName } from "@/lib/locationResolver";
import { getGoogleRouteSummary, GoogleRouteSummary, TripMode } from "@/lib/google-routes";
import { findLocalStateByName } from "@/lib/localTravelData";
import { getPreferredDestinationPlaces, RealPlace } from "@/services/placesService";
import { DistrictBudgetBreakdown, DistrictHotelPlan, DistrictTransportPlan, getDistrictBudgetBreakdown, getDistrictHotels, getDistrictMinimumBudget, getDistrictTransportPlan } from "@/services/districtTravelService";

export const maxDuration = 300;
const STRICT_REAL_DATA = false;

async function tryParse(rawText: string): Promise<object | null> {
  try {
    const jsonStr = extractJSON(rawText);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function deepMerge<T>(base: T, override: unknown): T {
  if (Array.isArray(base)) {
    return (Array.isArray(override) && override.length > 0 ? override : base) as T;
  }

  if (
    base &&
    typeof base === "object" &&
    override &&
    typeof override === "object" &&
    !Array.isArray(override)
  ) {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const key of Object.keys(base as Record<string, unknown>)) {
      out[key] = deepMerge(
        (base as Record<string, unknown>)[key],
        (override as Record<string, unknown>)[key]
      );
    }
    return out as T;
  }

  if (override === undefined || override === null || override === "") return base;
  return override as T;
}

function configuredKeys(): string[] {
  return [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
  ].filter((k): k is string => Boolean(k && k.trim() && k !== "your_gemini_api_key_here"));
}

function getInclusiveTripDays(startDate?: string, endDate?: string, fallback = 1): number {
  if (!startDate || !endDate) return Math.max(1, fallback);
  const diff = Math.round(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.min(10, Math.max(1, diff + 1));
}

type TransportNode = {
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
  notes?: string;
};

type GoogleRoutesByMode = Partial<Record<TripMode, GoogleRouteSummary>>;

type MultiLegHint = {
  byAir: string;
  byTrain: string;
  byBus: string;
  localMove: string;
};

type TransportModeNode = "flight" | "train" | "bus" | "car";

const STATE_TRANSPORT_HUBS: Record<string, string> = {
  andhrapradesh: "Vijayawada",
  arunachalpradesh: "Itanagar",
  assam: "Guwahati",
  bihar: "Patna",
  chandigarh: "Chandigarh",
  chhattisgarh: "Raipur",
  delhi: "Delhi",
  goa: "Panaji",
  gujarat: "Ahmedabad",
  haryana: "Gurugram",
  himachalpradesh: "Shimla",
  jammuandkashmir: "Srinagar",
  jharkhand: "Ranchi",
  karnataka: "Bengaluru",
  kerala: "Kochi",
  ladakh: "Leh",
  madhyapradesh: "Bhopal",
  maharashtra: "Mumbai",
  manipur: "Imphal",
  meghalaya: "Shillong",
  mizoram: "Aizawl",
  nagaland: "Kohima",
  odisha: "Bhubaneswar",
  punjab: "Amritsar",
  rajasthan: "Jaipur",
  sikkim: "Gangtok",
  tamilnadu: "Chennai",
  telangana: "Hyderabad",
  tripura: "Agartala",
  uttarpradesh: "Lucknow",
  uttarakhand: "Dehradun",
  westbengal: "Kolkata",
  thiruvallur: "Chennai",
  tiruvallur: "Chennai",
};

function resolveTransportQuery(value: string): { display: string; query: string; usedHub: boolean } {
  const display = String(value || "").trim();
  const key = normalizeCityInput(display);
  const hub = STATE_TRANSPORT_HUBS[key];
  if (!hub) return { display, query: display, usedHub: false };
  return { display, query: hub, usedHub: true };
}

function resolveTransportQueryWithLocalState(value: string): { display: string; query: string; usedHub: boolean } {
  const direct = resolveTransportQuery(value);
  if (direct.usedHub) return direct;

  const localState = findLocalStateByName(value);
  if (!localState) return direct;

  const stateHub = STATE_TRANSPORT_HUBS[normalizeCityInput(localState)];
  if (!stateHub) return direct;
  return { display: String(value || "").trim(), query: stateHub, usedHub: true };
}

function estimateTransportFare(
  mode: "flight" | "train" | "bus" | "car",
  distanceKm: number | null,
  travelers: number
): { pricePerPerson: number; totalPrice: number } {
  const pax = Math.max(1, travelers || 1);
  const km = Math.max(0, Math.round(distanceKm || 0));

  if (mode === "flight") {
    const pricePerPerson = km > 0 ? Math.max(2500, Math.round(km * 5.5)) : 3000;
    return { pricePerPerson, totalPrice: pricePerPerson * pax };
  }
  if (mode === "train") {
    const pricePerPerson = km > 0 ? Math.max(120, Math.round(km * 0.9)) : 250;
    return { pricePerPerson, totalPrice: pricePerPerson * pax };
  }
  if (mode === "bus") {
    const pricePerPerson = km > 0 ? Math.max(180, Math.round(km * 1.25)) : 300;
    return { pricePerPerson, totalPrice: pricePerPerson * pax };
  }

  const totalPrice = km > 0 ? Math.max(1800, Math.round(km * 14)) : 2200;
  return { pricePerPerson: Math.round(totalPrice / pax), totalPrice };
}

const NON_AIRPORT_DESTINATIONS: Record<string, MultiLegHint> = {
  ooty: {
    byAir: "Fly to Coimbatore (CJB), then cab or bus to Ooty (about 3-4 hours).",
    byTrain: "Take train to Mettupalayam or Coimbatore, then Nilgiri mountain train/bus to Ooty.",
    byBus: "Use direct TNSTC/KSRTC bus to Ooty from nearby major cities.",
    localMove: "Use local taxi or auto for Botanical Garden, Doddabetta, and Ooty Lake.",
  },
  kodaikanal: {
    byAir: "Fly to Madurai (IXM) or Coimbatore (CJB), then taxi/bus to Kodaikanal.",
    byTrain: "Train to Kodai Road, then cab or bus to Kodaikanal hill town.",
    byBus: "Use direct or one-stop buses from Madurai, Dindigul, or Coimbatore.",
    localMove: "Use local taxi/auto for Coakers Walk, lake area, and viewpoint circuits.",
  },
  coorg: {
    byAir: "Fly to Mangalore (IXE), Kannur (CNN), or Bengaluru (BLR), then road transfer.",
    byTrain: "Train to Mysuru or Mangalore, then bus/cab to Madikeri.",
    byBus: "KSRTC buses connect Bengaluru and Mysuru to Coorg.",
    localMove: "Use cab for Abbey Falls, Raja Seat, and plantation routes.",
  },
  munnar: {
    byAir: "Fly to Kochi (COK), then road transfer to Munnar (about 4-5 hours).",
    byTrain: "Train to Aluva/Ernakulam, then bus or cab to Munnar.",
    byBus: "KSRTC buses run from Kochi to Munnar.",
    localMove: "Use jeep/cab for Top Station, tea estates, and waterfalls.",
  },
  rishikesh: {
    byAir: "Fly to Dehradun (DED), then taxi or bus to Rishikesh (about 45-60 minutes).",
    byTrain: "Train to Haridwar/Dehradun, then local transport to Rishikesh.",
    byBus: "Regular buses from Delhi/Haridwar to Rishikesh.",
    localMove: "Use auto/e-rickshaw for ghat and ashram zones.",
  },
  ladakh: {
    byAir: "Fly to Leh (IXL) directly where available.",
    byTrain: "No direct train to Leh; use train to Jammu/Chandigarh then road/flight onward.",
    byBus: "Seasonal bus/shared cab routes from Manali or Srinagar to Leh.",
    localMove: "Use local cab/shared taxi for Nubra, Pangong, and monastery circuits.",
  },
  yercaud: {
    byAir: "Fly to Salem (SXV) or Coimbatore (CJB) where available, then road transfer.",
    byTrain: "Train to Salem Junction, then bus/cab up the ghat road to Yercaud.",
    byBus: "Bus to Salem, then local bus or taxi to Yercaud.",
    localMove: "Use local taxi/auto for viewpoints and lake areas.",
  },
  mahabalipuram: {
    byAir: "Fly to Chennai (MAA), then road transfer to Mahabalipuram.",
    byTrain: "Train to Chennai Chengalpattu region, then road transfer.",
    byBus: "Frequent ECR buses from Chennai/Puducherry to Mahabalipuram.",
    localMove: "Use auto/cab for Shore Temple and monument circuit.",
  },
  kanyakumari: {
    byAir: "Fly to Trivandrum (TRV), then train/bus/cab to Kanyakumari.",
    byTrain: "Direct long-distance trains available to Kanyakumari in many corridors.",
    byBus: "Intercity buses run from Tirunelveli, Nagercoil, and Trivandrum.",
    localMove: "Use auto/cab for sunrise point, ferry jetty, and memorials.",
  },
};

const FALLBACK_RAIL_HUBS: Record<string, string> = {
  munnar: "Aluva / Ernakulam Junction",
  ooty: "Mettupalayam / Coimbatore Junction",
  thenilgiris: "Mettupalayam / Coimbatore Junction",
  kodaikanal: "Kodai Road",
  coorg: "Mysuru Junction",
  kodagu: "Mysuru Junction",
  goa: "Madgaon / Thivim",
  mahabalipuram: "Chengalpattu / Chennai Egmore",
  yercaud: "Salem Junction",
  rishikesh: "Haridwar / Dehradun",
  kanyakumari: "Kanyakumari Junction",
};

const FALLBACK_AIR_HUBS: Record<string, string> = {
  munnar: "Kochi (COK)",
  ooty: "Coimbatore (CJB)",
  thenilgiris: "Coimbatore (CJB)",
  kodaikanal: "Madurai (IXM)",
  coorg: "Mangalore (IXE) or Bengaluru (BLR)",
  kodagu: "Mangalore (IXE) or Bengaluru (BLR)",
  goa: "Goa (GOI)",
  mahabalipuram: "Chennai (MAA)",
  yercaud: "Salem (SXV) or Coimbatore (CJB)",
  rishikesh: "Dehradun (DED)",
  kanyakumari: "Trivandrum (TRV)",
};

function fallbackRailHub(city: string): string {
  const key = normalizeCityInput(city);
  return FALLBACK_RAIL_HUBS[key] || `${city} nearest major railway station`;
}

function fallbackAirHub(city: string): string {
  const key = normalizeCityInput(city);
  const known = FALLBACK_AIR_HUBS[key];
  if (known) return known;
  const iata = lookupIata(city);
  return iata ? `${city} (${iata})` : `${city} nearest major airport`;
}

function clearTransportDescription(
  source: string,
  destination: string,
  mode: TransportModeNode,
  distanceKm: number | null,
  totalPrice: number,
  hint?: MultiLegHint
): string {
  const distanceText = distanceKm ? `${Math.round(distanceKm)} km` : "distance varies by route";
  const destRailHub = fallbackRailHub(destination);
  const srcRailHub = fallbackRailHub(source);
  const destAirHub = fallbackAirHub(destination);
  const srcAirHub = fallbackAirHub(source);
  const route = `Route: ${source} -> ${destination}`;
  const estimate = `Estimated: ${distanceText} | ${estimateDurationHours(mode, distanceKm)}`;

  if (hint) {
    const modePath =
      mode === "flight"
        ? hint.byAir
        : mode === "train"
          ? hint.byTrain
          : mode === "bus"
            ? hint.byBus
            : `Travel by road from ${source} to ${destination}, then use local cab/auto for hotel and sightseeing transfers.`;
    return `${route}
${estimate}
Suggested path: ${modePath}
Local: ${hint.localMove}
Estimated fare: INR ${totalPrice.toLocaleString()} total.`;
  }

  const suggestedPath =
    mode === "train"
      ? `Go to ${srcRailHub}, take a train toward ${destRailHub}, then use cab/auto/local transport from the station to your stay in ${destination}.`
      : mode === "bus"
        ? `Board a direct or nearest available bus from ${source} main bus stand to ${destination}. After arrival, use cab/auto/local transport to your hotel and sightseeing spots.`
        : mode === "flight"
          ? `Fly from ${srcAirHub} to ${destAirHub}. After landing, use cab/airport taxi/local transport to reach your hotel in ${destination}.`
          : `Travel by road from ${source} to ${destination}. Use local cab/auto for hotel transfer and nearby sightseeing after arrival.`;

  return `${route}
${estimate}
Suggested path: ${suggestedPath}
Estimated fare: INR ${totalPrice.toLocaleString()} total.`;
}

function withRealFlights(plan: unknown, quotes: Awaited<ReturnType<typeof getAmadeusFlightQuotes>>) {
  if (!quotes.length || !plan || typeof plan !== "object") return plan;

  const sortedByPrice = [...quotes].sort((a, b) => a.totalPrice - b.totalPrice);
  const sortedByStopsDuration = [...quotes].sort((a, b) => {
    if (a.stops !== b.stops) return a.stops - b.stops;
    return a.duration.localeCompare(b.duration);
  });

  const cheapest = sortedByPrice[0];
  const fastest = sortedByStopsDuration[0];
  const recommended = sortedByPrice[Math.min(1, sortedByPrice.length - 1)] || cheapest;

  const mapQuote = (q: typeof cheapest, badge: string): TransportNode => ({
    mode: "flight",
    operator: q.operator,
    departure: q.departure,
    arrival: q.arrival,
    duration: q.duration,
    price_per_person: q.perPersonPrice,
    total_price: q.totalPrice,
    comfort: q.stops === 0 ? "High" : "Medium",
    stops: q.stops,
    badge,
  });

  const clone = structuredClone(plan) as Record<string, unknown>;
  const existingTransport =
    clone.transport && typeof clone.transport === "object"
      ? (clone.transport as Record<string, unknown>)
      : {};
  const nextRecommended =
    String((existingTransport.recommended as Record<string, unknown> | undefined)?.mode || "").toLowerCase() === "flight"
      ? mapQuote(recommended, "Recommended")
      : (existingTransport.recommended as Record<string, unknown> | undefined) || mapQuote(recommended, "Recommended");
  clone.transport = {
    ...existingTransport,
    recommended: nextRecommended,
    flight: mapQuote(cheapest, "Flight"),
  };
  return clone;
}

function withRealHotels(plan: unknown, quotes: Awaited<ReturnType<typeof getAmadeusHotelQuotes>>) {
  if (!quotes.length || !plan || typeof plan !== "object") return plan;

  const clone = structuredClone(plan) as Record<string, unknown>;
  clone.hotels = quotes.slice(0, 3).map((h, i) => ({
    name: h.name,
    category: i === 0 ? "Budget" : i === 1 ? "Recommended" : "Premium",
    rating: Number(h.rating.toFixed(1)),
    reviews: 1200 + i * 850,
    price_per_night: h.pricePerNight,
    total_cost: h.totalCost,
    location: h.location,
    amenities: h.amenities.length ? h.amenities : ["WiFi", "AC", "Breakfast"],
    highlights:
      i === 0
        ? "Best value live rate from Amadeus inventory."
        : i === 1
          ? "Balanced location and amenities with strong value."
          : "Premium option with higher comfort and better facilities.",
    badge: i === 0 ? "Budget Pick" : i === 1 ? "Best Value" : "Luxury",
  }));
  return clone;
}

function withGeoHotels(
  plan: unknown,
  geo: GeoapifyContext,
  body: Pick<TripFormData, "destination" | "startDate" | "endDate" | "budget" | "mode">
) {
  if (!plan || typeof plan !== "object") return plan;
  const clone = structuredClone(plan) as Record<string, unknown>;
  const existing = Array.isArray(clone.hotels) ? (clone.hotels as Array<Record<string, unknown>>) : [];
  const hasGeneric =
    existing.length > 0 &&
    existing.every((h) => String(h.name || "").toLowerCase().includes(String(body.destination).toLowerCase()));
  if (existing.length > 0 && !hasGeneric) return clone;

  const pool = uniqueByName(geo.hotels || []).slice(0, 3);
  if (!pool.length) return clone;

  const nights = Math.max(
    1,
    Math.round(
      (new Date(body.endDate).getTime() - new Date(body.startDate).getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  const modeMul = body.mode === "budget" ? 0.8 : body.mode === "luxury" ? 1.6 : 1;
  const baseNight = Math.max(1000, Math.round((body.budget * 0.34) / nights / 2));

  clone.hotels = pool.map((h, i) => {
    const night = Math.round(baseNight * (i === 0 ? 1 : i === 1 ? 1.35 : 1.8) * modeMul);
    return {
      name: h.name,
      category: i === 0 ? "Budget" : i === 1 ? "Recommended" : "Premium",
      rating: Number((4 + i * 0.2).toFixed(1)),
      reviews: 700 + i * 650,
      price_per_night: night,
      total_cost: night * nights,
      location: h.address || `${body.destination} central area`,
      amenities: i === 0 ? ["WiFi", "Hot Water"] : i === 1 ? ["WiFi", "Breakfast", "AC"] : ["WiFi", "Breakfast", "AC", "Pool"],
      highlights: "Popular listing near major city points.",
      badge: i === 0 ? "Budget Pick" : i === 1 ? "Best Value" : "Optional Upgrade",
    };
  });
  return clone;
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return r * c;
}

function suggestTransportMode(distanceKm: number | null, hasFlightQuotes: boolean): "flight" | "train" | "bus" | "car" {
  if (hasFlightQuotes && (distanceKm === null || distanceKm > 650)) return "flight";
  if (distanceKm === null) return hasFlightQuotes ? "flight" : "train";
  if (distanceKm > 1200) return hasFlightQuotes ? "flight" : "train";
  if (distanceKm > 350) return "train";
  if (distanceKm > 120) return "bus";
  return "car";
}

function canTreatAsDirectFlight(source: string, destination: string): boolean {
  return Boolean(lookupIata(source) && lookupIata(destination));
}

function estimateDurationHours(mode: "flight" | "train" | "bus" | "car", distanceKm: number | null): string {
  if (distanceKm === null) return "Duration depends on provider schedule";
  if (mode === "flight") return `${Math.max(1.5, distanceKm / 550).toFixed(1)}h approx`;
  if (mode === "train") return `${Math.max(2, distanceKm / 55).toFixed(1)}h approx`;
  if (mode === "bus") return `${Math.max(2, distanceKm / 40).toFixed(1)}h approx`;
  return `${Math.max(1.5, distanceKm / 45).toFixed(1)}h approx`;
}

function routeNarrative(
  source: string,
  destination: string,
  mode: "flight" | "train" | "bus" | "car",
  distanceKm: number | null,
  hint?: MultiLegHint
): string {
  const distanceText = distanceKm ? `${Math.round(distanceKm)} km` : "distance varies by route";
  const durationText = estimateDurationHours(mode, distanceKm);
  const base = `Route: ${source} -> ${destination}\nEstimated: ${distanceText} | ${durationText}`;
  if (!hint) return `${base}\nMode: ${mode.toUpperCase()} (direct/best available).`;
  return `${base}\nSuggested path: ${hint.byAir} ${hint.byTrain} ${hint.byBus} Local: ${hint.localMove}`;
}

function withGuaranteedTransportNotes(
  plan: unknown,
  body: Pick<TripFormData, "source" | "destination" | "travelers">,
  distanceKm: number | null
) {
  if (!plan || typeof plan !== "object") return plan;
  const clone = structuredClone(plan) as Record<string, unknown>;
  const transport =
    clone.transport && typeof clone.transport === "object"
      ? (clone.transport as Record<string, unknown>)
      : null;
  if (!transport) return clone;

  const destinationKey = normalizeCityInput(body.destination);
  const sourceKey = normalizeCityInput(body.source);
  const hint = NON_AIRPORT_DESTINATIONS[destinationKey] || NON_AIRPORT_DESTINATIONS[sourceKey];

  for (const key of ["recommended", "bus", "train", "flight"] as const) {
    const node = transport[key];
    if (!node || typeof node !== "object") continue;
    const option = node as Record<string, unknown>;
    if (String(option.notes || "").trim()) continue;

    const mode = String(option.mode || key).toLowerCase() as "flight" | "train" | "bus" | "car";
    const totalPrice = Math.max(0, Number(option.total_price || 0));
    option.notes = clearTransportDescription(
      body.source,
      body.destination,
      mode,
      distanceKm,
      totalPrice,
      hint
    );
  }

  clone.transport = transport;
  return clone;
}

async function getGoogleRoutesByMode(params: {
  source: string;
  destination: string;
  sourceCoord: { lat: number; lon: number } | null;
  destinationCoord: { lat: number; lon: number } | null;
}): Promise<GoogleRoutesByMode> {
  const modes: TripMode[] = ["car", "train", "bus", "flight"];
  const items = await Promise.all(
    modes.map((mode) =>
      withTimeout(
        getGoogleRouteSummary({
          source: params.source,
          destination: params.destination,
          mode,
          sourceCoord: params.sourceCoord,
          destinationCoord: params.destinationCoord,
        }),
        5000,
        `Google route ${mode}`
      ).catch(() => null)
    )
  );
  const out: GoogleRoutesByMode = {};
  items.forEach((item) => {
    if (item) out[item.mode] = item;
  });
  return out;
}

function withGoogleRouteData(
  plan: unknown,
  routes: GoogleRoutesByMode,
  source: string,
  destination: string,
  travelers: number
) {
  if (!plan || typeof plan !== "object") return plan;
  const clone = structuredClone(plan) as Record<string, unknown>;
  const transport = clone.transport as Record<string, unknown> | undefined;
  if (!transport) return plan;

  const apply = (k: string) => {
    const node = transport[k] as Record<string, unknown> | undefined;
    if (!node) return;
    const existingNotes = String(node.notes || "");
    if (existingNotes.trim().startsWith("Route:")) {
      // Keep district/master transport notes when we already have real route data.
      return;
    }
    const mode = String(node.mode || "").toLowerCase() as TripMode;
    const r = routes[mode];
    if (!r) return;
    const normalizedSource = normalizeCityInput(source);
    const normalizedDestination = normalizeCityInput(destination);
    if (normalizedSource !== normalizedDestination && r.distanceKm < 10) {
      // Ignore clearly bad intercity estimates from the geocoder/routing fallback.
      return;
    }
    const shouldShowSteps = mode === "car" || mode === "bus";
    const routeSummary = shouldShowSteps
      ? `Route API:
Mapped road route: ${source} -> ${destination}
Distance: ${r.distanceKm} km
Duration: ${r.durationText}
${r.steps.length ? `Route highlights: ${r.steps.join(" | ")}` : ""}`
      : `Route API:
${mode === "train" ? "Rail corridor estimate" : "Air corridor estimate"}: ${source} -> ${destination}
Distance: ${r.distanceKm} km
Duration: ${r.durationText}
${mode === "train" ? "Confirm exact train timings and seat availability on IRCTC/redRail." : "Confirm exact flight timings and fares on airline/flight provider pages."}`;
    node.duration = r.durationText || node.duration;
    node.notes = routeSummary;
    const currentTotal = Math.max(0, Number(node.total_price || 0));
    const currentPerPerson = Math.max(0, Number(node.price_per_person || 0));
    if (r.distanceKm > 0 && (currentTotal === 0 || currentPerPerson === 0)) {
      const estimate = estimateTransportFare(mode, r.distanceKm, travelers);
      node.price_per_person = estimate.pricePerPerson;
      node.total_price = estimate.totalPrice;
      node.notes += `\nEstimated fare from route distance: INR ${estimate.totalPrice.toLocaleString()} total.`;
    }
  };

  apply("recommended");
  apply("bus");
  apply("train");
  apply("flight");
  clone.transport = transport;
  return clone;
}

function uniqueByName<T extends { name: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function selectBudgetTransportNode(
  transportNode: Record<string, unknown> | null,
  mode: TripFormData["mode"]
): Record<string, unknown> | null {
  if (!transportNode) return null;
  if (mode === "budget") {
    if (transportNode.bus && typeof transportNode.bus === "object" && Number((transportNode.bus as Record<string, unknown>).total_price || 0) > 0) {
      return transportNode.bus as Record<string, unknown>;
    }
    if (transportNode.train && typeof transportNode.train === "object" && Number((transportNode.train as Record<string, unknown>).total_price || 0) > 0) {
      return transportNode.train as Record<string, unknown>;
    }
  }
  if (mode === "luxury") {
    if (transportNode.flight && typeof transportNode.flight === "object" && Number((transportNode.flight as Record<string, unknown>).total_price || 0) > 0) {
      return transportNode.flight as Record<string, unknown>;
    }
    if (transportNode.train && typeof transportNode.train === "object" && Number((transportNode.train as Record<string, unknown>).total_price || 0) > 0) {
      return transportNode.train as Record<string, unknown>;
    }
  }
  if (transportNode.recommended && typeof transportNode.recommended === "object") {
    return transportNode.recommended as Record<string, unknown>;
  }
  if (transportNode.train && typeof transportNode.train === "object") {
    return transportNode.train as Record<string, unknown>;
  }
  if (transportNode.bus && typeof transportNode.bus === "object") {
    return transportNode.bus as Record<string, unknown>;
  }
  if (transportNode.flight && typeof transportNode.flight === "object") {
    return transportNode.flight as Record<string, unknown>;
  }
  return null;
}

function selectBudgetHotelNode(
  hotels: Array<Record<string, unknown>>,
  mode: TripFormData["mode"]
): Record<string, unknown> | undefined {
  if (mode === "budget") {
    return hotels.find((h) => String(h.category || "").toLowerCase() === "budget") || hotels[0];
  }
  if (mode === "luxury") {
    return hotels.find((h) => String(h.category || "").toLowerCase() === "premium") || hotels[2] || hotels[0];
  }
  return (
    hotels.find((h) => String(h.category || "").toLowerCase() === "recommended") ||
    hotels[1] ||
    hotels[0]
  );
}

function withModeAwareBudget(plan: unknown, body: TripFormData) {
  if (!plan || typeof plan !== "object") return plan;
  const clone = structuredClone(plan) as Record<string, unknown>;
  const nights = Math.max(
    1,
    Math.round(
      (new Date(body.endDate).getTime() - new Date(body.startDate).getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  const travelers = Math.max(1, body.travelers || 1);
  const modeCosts =
    body.mode === "budget"
      ? { hotelNight: 1800, foodDay: 550, sightDay: 250, localDay: 300 }
      : body.mode === "luxury"
        ? { hotelNight: 6500, foodDay: 1400, sightDay: 800, localDay: 1400 }
        : body.mode === "family"
          ? { hotelNight: 3200, foodDay: 800, sightDay: 350, localDay: 700 }
          : body.mode === "adventure"
          ? { hotelNight: 2400, foodDay: 700, sightDay: 500, localDay: 550 }
          : { hotelNight: 2800, foodDay: 750, sightDay: 350, localDay: 600 };

  const transportNode =
    clone.transport && typeof clone.transport === "object"
      ? (clone.transport as Record<string, unknown>)
      : null;
  const selectedTransport = selectBudgetTransportNode(transportNode, body.mode);
  const transport = Math.max(0, Number(selectedTransport?.total_price || 0));
  const hotels = Array.isArray(clone.hotels) ? (clone.hotels as Array<Record<string, unknown>>) : [];
  const recommendedHotel = selectBudgetHotelNode(hotels, body.mode);
  const hotel = Math.max(
    0,
    Number(recommendedHotel?.total_cost || 0) || (modeCosts.hotelNight * nights)
  );

  const itinerary = Array.isArray(clone.itinerary) ? (clone.itinerary as Array<Record<string, unknown>>) : [];
  const sightseeingFromItinerary = itinerary.reduce((sum, day) => {
    const slots = ["morning", "afternoon", "evening"].map((key) =>
      day[key] && typeof day[key] === "object" ? (day[key] as Record<string, unknown>) : null
    );
    return sum + slots.reduce((slotSum, slot) => slotSum + Math.max(0, Number(slot?.entry_fee || 0)), 0);
  }, 0);
  const localFromItinerary = itinerary.reduce(
    (sum, day) => sum + Math.max(0, Number(day.local_transport_cost || 0)),
    0
  );

  const food = Math.round(modeCosts.foodDay * nights * travelers);
  const sightseeing = Math.max(
    sightseeingFromItinerary,
    Math.round(modeCosts.sightDay * Math.max(1, nights - 1) * travelers)
  );
  const localTransport = Math.max(
    localFromItinerary,
    Math.round(modeCosts.localDay * nights * Math.max(1, Math.ceil(travelers / 2)))
  );
  const miscellaneous = Math.max(500, Math.round((transport + hotel + food + sightseeing + localTransport) * 0.08));
  const grandTotal = transport + hotel + food + sightseeing + localTransport + miscellaneous;

  clone.budget = {
    transport,
    hotel,
    food,
    sightseeing,
    local_transport: localTransport,
    miscellaneous,
    grand_total: grandTotal,
    per_person: Math.round(grandTotal / travelers),
    savings_tips: [
      "Book transport 2-4 weeks early for better fares.",
      "Keep weekdays for premium attractions and weekends for free attractions.",
      "Use local buses/metro for intra-city movement to reduce daily cost.",
    ],
  };

  return clone;
}

function withBudgetAlignedToData(plan: unknown, body: TripFormData) {
  if (!plan || typeof plan !== "object") return plan;
  const clone = structuredClone(plan) as Record<string, unknown>;
  const budget = (clone.budget && typeof clone.budget === "object")
    ? (clone.budget as Record<string, unknown>)
    : null;
  if (!budget) return clone;

  const transport = (clone.transport && typeof clone.transport === "object")
    ? (clone.transport as Record<string, unknown>)
    : null;
  const selectedTransport = selectBudgetTransportNode(transport, body.mode);
  const transportTotal = Math.max(0, Number(selectedTransport?.total_price || 0));

  const hotels = Array.isArray(clone.hotels) ? (clone.hotels as Array<Record<string, unknown>>) : [];
  const recommendedHotel = selectBudgetHotelNode(hotels, body.mode);
  const hotelTotal = Math.max(0, Number(recommendedHotel?.total_cost || 0));

  const itinerary = Array.isArray(clone.itinerary) ? (clone.itinerary as Array<Record<string, unknown>>) : [];
  const sightseeingFromItinerary = itinerary.reduce((sum, day) => {
    const slots = ["morning", "afternoon", "evening"].map((key) =>
      day[key] && typeof day[key] === "object" ? (day[key] as Record<string, unknown>) : null
    );
    return sum + slots.reduce((slotSum, slot) => slotSum + Math.max(0, Number(slot?.entry_fee || 0)), 0);
  }, 0);
  const localFromItinerary = itinerary.reduce(
    (sum, day) => sum + Math.max(0, Number(day.local_transport_cost || 0)),
    0
  );

  const nextTransport = transportTotal > 0 ? transportTotal : Math.max(0, Number(budget.transport || 0));
  const nextHotel = hotelTotal > 0 ? hotelTotal : Math.max(0, Number(budget.hotel || 0));
  const nextFood = Math.max(0, Number(budget.food || 0));
  const nextSightseeing = Math.max(sightseeingFromItinerary, Number(budget.sightseeing || 0));
  const nextLocal = Math.max(localFromItinerary, Number(budget.local_transport || 0));
  const nextMisc = Math.max(300, Number(budget.miscellaneous || 0));
  const grandTotal = Math.round(nextTransport + nextHotel + nextFood + nextSightseeing + nextLocal + nextMisc);

  clone.budget = {
    ...budget,
    transport: Math.round(nextTransport),
    hotel: Math.round(nextHotel),
    food: Math.round(nextFood),
    sightseeing: Math.round(nextSightseeing),
    local_transport: Math.round(nextLocal),
    miscellaneous: Math.round(nextMisc),
    grand_total: grandTotal,
    per_person: Math.round(grandTotal / Math.max(1, body.travelers)),
  };

  return clone;
}

function withBudgetFriendlyMode(plan: unknown, body: TripFormData) {
  if (!plan || typeof plan !== "object" || body.mode !== "budget") return plan;
  const clone = structuredClone(plan) as Record<string, unknown>;

  const transport =
    clone.transport && typeof clone.transport === "object"
      ? (clone.transport as Record<string, unknown>)
      : null;
  if (transport) {
    const recommended = selectBudgetTransportNode(transport, body.mode);
    if (recommended) {
      transport.recommended = {
        ...(recommended as Record<string, unknown>),
        badge: "Recommended",
      };
      clone.transport = transport;
    }
  }

  const itinerary = Array.isArray(clone.itinerary) ? (clone.itinerary as Array<Record<string, unknown>>) : [];
  if (itinerary.length > 0) {
    clone.itinerary = itinerary.map((day) => {
      const nextDay = { ...day };
      for (const key of ["morning", "afternoon", "evening"] as const) {
        const slot =
          nextDay[key] && typeof nextDay[key] === "object"
            ? { ...(nextDay[key] as Record<string, unknown>) }
            : null;
        if (!slot) continue;
        const currentFee = Math.max(0, Number(slot.entry_fee || 0));
        slot.entry_fee = Math.min(currentFee, key === "afternoon" ? 180 : 120);
        nextDay[key] = slot;
      }
      nextDay.local_transport_cost = Math.min(
        Math.max(0, Number(nextDay.local_transport_cost || 0)),
        250
      );
      return nextDay;
    });
  }

  return clone;
}

function preferenceTokens(trip?: TripFormData): string[] {
  if (!trip) return [];
  return Array.from(
    new Set(
      [...(trip.interests || []), trip.tripType, trip.mode]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function scoreItineraryPlace(
  place: { name?: string; address?: string; category?: string },
  trip?: TripFormData
): number {
  const tokens = preferenceTokens(trip);
  const text = `${String(place.name || "")} ${String(place.address || "")} ${String(place.category || "")}`.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (text.includes(token)) score += 6;
    if (token === "beaches" || token === "beach") {
      if (text.includes("beach") || text.includes("coast") || text.includes("island")) score += 8;
    }
    if (token === "nature") {
      if (text.includes("park") || text.includes("waterfall") || text.includes("lake") || text.includes("hill")) score += 7;
    }
    if (token === "history" || token === "art & culture" || token === "culture") {
      if (text.includes("museum") || text.includes("fort") || text.includes("heritage") || text.includes("palace")) score += 7;
    }
    if (token === "temples") {
      if (text.includes("temple") || text.includes("spiritual") || text.includes("church")) score += 7;
    }
    if (token === "adventure") {
      if (text.includes("trek") || text.includes("trail") || text.includes("viewpoint") || text.includes("wildlife")) score += 7;
    }
    if (token === "shopping") {
      if (text.includes("market") || text.includes("bazaar")) score += 7;
    }
    if (token === "food & cuisine") {
      if (text.includes("market") || text.includes("food")) score += 5;
    }
  }

  return score;
}

function withSuggestedTransport(
  plan: unknown,
  mode: "flight" | "train" | "bus" | "car",
  hasFlights: boolean,
  body: TripFormData,
  distanceKm: number | null
) {
  if (!plan || typeof plan !== "object") return plan;
  const destinationKey = normalizeCityInput(body.destination);
  const sourceKey = normalizeCityInput(body.source);
  const nonAirportHint = NON_AIRPORT_DESTINATIONS[destinationKey] || NON_AIRPORT_DESTINATIONS[sourceKey];
  const forceNoDirectFlight = Boolean(nonAirportHint);
  const allowFlightMode = hasFlights && !forceNoDirectFlight;

  if (allowFlightMode) return plan;

  const clone = structuredClone(plan) as Record<string, unknown>;
  const primaryMode = mode === "flight" ? "train" : mode;
  const kmText = distanceKm ? `${Math.round(distanceKm)} km` : "this route";
  const modeOperator = (cardMode: "flight" | "train" | "bus" | "car") =>
    cardMode === primaryMode
      ? `Route-aware ${cardMode} plan`
      : cardMode === "flight"
        ? "Flight option"
        : cardMode === "train"
          ? "Train option"
          : cardMode === "bus"
            ? "Bus option"
            : "Cab option";

  const modeComfort = (cardMode: "flight" | "train" | "bus" | "car") =>
    cardMode === "flight" || cardMode === "train" ? "High" : "Medium";

  const modeNotes = (cardMode: "flight" | "train" | "bus" | "car") => {
    const estimatedFare = estimateTransportFare(cardMode, distanceKm, body.travelers);
    const primaryText =
      clearTransportDescription(
        body.source,
        body.destination,
        cardMode,
        distanceKm,
        estimatedFare.totalPrice,
        nonAirportHint || undefined
      );
    if (!nonAirportHint && cardMode === "flight") {
      return `${primaryText}\nNote: No reliable direct flight inventory found for ${body.source} to ${body.destination}. Prefer ${primaryMode} for ${kmText}.`;
    }
    if (nonAirportHint && cardMode === primaryMode) {
      return `${primaryText}\nAlternatives: ${nonAirportHint.byAir} ${nonAirportHint.byTrain} ${nonAirportHint.byBus}`;
    }
    return primaryText;
  };

  const makeTransportNode = (cardMode: "flight" | "train" | "bus" | "car", badge: string) => {
    const estimatedFare = estimateTransportFare(cardMode, distanceKm, body.travelers);
    return {
      mode: cardMode,
      operator: modeOperator(cardMode),
      departure: "--:--",
      arrival: "--:--",
      duration: "As per live provider search",
      price_per_person: estimatedFare.pricePerPerson,
      total_price: estimatedFare.totalPrice,
      comfort: modeComfort(cardMode),
      stops: 0,
      badge,
      notes: modeNotes(cardMode),
    };
  };

  clone.transport = {
    recommended: makeTransportNode(primaryMode, "Recommended"),
    bus: makeTransportNode("bus", "Bus"),
    train: makeTransportNode("train", "Train"),
    flight: makeTransportNode("flight", "Flight"),
  };
  return clone;
}

function enrichWithGeoAndWeather(
  plan: unknown,
  ctx: { geo: GeoapifyContext; weather: OpenWeatherContext | null; destination: string; dbPlaces?: RealPlace[] },
  trip?: TripFormData
) {
  if (!plan || typeof plan !== "object") return plan;

  const clone = structuredClone(plan) as Record<string, unknown>;
  const existingItinerary = Array.isArray(clone.itinerary) ? (clone.itinerary as Array<Record<string, unknown>>) : [];
  const dbAttractions = (ctx.dbPlaces || []).map((p) => ({
    name: p.name,
    address: p.address || `${ctx.destination} city area`,
    category: p.category || "tourist_attraction",
    map_url: p.map_url || "",
  }));
  const attractions = uniqueByName(dbAttractions.length > 0 ? dbAttractions : ctx.geo.attractions);
  const restaurants = uniqueByName(ctx.geo.restaurants);
  const nearbyAsPlaces = ctx.geo.nearby.map((n) => ({
    name: `${n.name} excursion`,
    address: `${n.name} (${n.distance})`,
    category: "nearby",
    map_url: "",
  }));
  const filteredAttractions = attractions.filter((place) => {
    const text = `${place.name} ${place.address} ${place.category}`.toLowerCase();
    const destinationText = String(ctx.destination || "").toLowerCase();
    return !destinationText || text.includes(destinationText) || dbAttractions.length > 0;
  });
  const masterPool = uniqueByName(dbAttractions.length > 0 ? filteredAttractions : [...filteredAttractions, ...nearbyAsPlaces])
    .map((place) => ({ ...place, __score: scoreItineraryPlace(place, trip) }))
    .sort((a, b) => b.__score - a.__score || a.name.localeCompare(b.name))
    .map((item) => {
      const place = { ...item };
      delete (place as { __score?: number }).__score;
      return place;
    });

  if (ctx.weather) {
    clone.weather = ctx.weather.summary;
  }

  const tripDays =
    trip?.startDate && trip?.endDate
      ? getInclusiveTripDays(trip.startDate, trip.endDate, existingItinerary.length || 3)
      : Math.max(1, existingItinerary.length || 3);
  // Use 4 unique places/day (Morning 1 + Afternoon 2 + Evening 1).
  const effectiveDays = Math.max(1, tripDays);

  if (masterPool.length > 0) {
    let cursor = 0;
    const poolSize = Math.max(1, masterPool.length);
    const nextPlace = () => {
      const place = masterPool[cursor % poolSize] as { name: string; address: string; category?: string; map_url?: string };
      cursor += 1;
      return place;
    };
    const pickSlot = (preferredCount: number) => {
      const count = poolSize >= effectiveDays * preferredCount ? preferredCount : 1;
      const picked: Array<{ name: string; address: string; category?: string; map_url?: string }> = [];
      for (let i = 0; i < count; i++) picked.push(nextPlace());
      return picked;
    };
    const joinPlaceNames = (places: Array<{ name: string }>) => places.map((p) => p.name).join(" and ");
    const joinPlaceLocations = (places: Array<{ name: string; address: string }>) =>
      places.map((p) => `${p.name}, ${p.address}`).join(" and ");
    const rebuilt: Array<Record<string, unknown>> = [];
    for (let i = 0; i < effectiveDays; i++) {
      const morningPick = pickSlot(1);
      const afternoonPick = pickSlot(2);
      const eveningPick = pickSlot(1);
      const morningA = morningPick[0];
      const afternoonA = afternoonPick[0];
      const afternoonB = afternoonPick[1] || null;
      const eveningA = eveningPick[0];
      const afternoonPlaces = afternoonB ? [afternoonA, afternoonB] : [afternoonA];
      const dinner = restaurants[i % Math.max(1, restaurants.length)];
      const dayCount = Math.max(1, effectiveDays);
      const localCost = trip ? Math.max(100, Math.round((trip.budget * 0.05) / dayCount)) : 200;
      const feeBase =
        trip?.mode === "budget" ? 50 : trip?.mode === "luxury" ? 220 : 110;

      const dayDate = trip?.startDate ? new Date(trip.startDate) : new Date();
      dayDate.setDate(dayDate.getDate() + i);

      rebuilt.push({
        day: i + 1,
        date: dayDate.toISOString().slice(0, 10),
        theme: `${morningA.name} + ${afternoonA.name} + ${eveningA.name}`,
        morning: {
        activity: `${morningA.name}`,
        description: `Visit ${morningA.name} in ${ctx.destination}.`,
        location: `${morningA.name}, ${morningA.address || `${ctx.destination} city center`}`,
        map_url: `${morningA.map_url || ""}`,
        duration: "3-4 hours",
        entry_fee: feeBase + Math.round(feeBase * 0.3),
        tips: "Start early for lighter crowds and better weather.",
        },
        afternoon: {
        activity: joinPlaceNames(afternoonPlaces),
        description: afternoonB
          ? `Continue with ${afternoonA.name} and ${afternoonB.name} in ${ctx.destination}.`
          : `Continue with ${afternoonA.name} in ${ctx.destination}.`,
        location: joinPlaceLocations(afternoonPlaces),
        map_url: `${afternoonA.map_url || ""}`,
        duration: "3-4 hours",
        entry_fee: afternoonB ? Math.round(feeBase * 1.35) : Math.round(feeBase * 0.8),
        tips: "Carry water and use app cabs/local transit for quick movement.",
        },
        evening: {
        activity: `${eveningA.name}`,
        description: `Relax at ${eveningA.name} in ${ctx.destination}.`,
        location: `${eveningA.name}, ${eveningA.address || `${ctx.destination} downtown`}`,
        map_url: `${eveningA.map_url || ""}`,
        duration: "2-3 hours",
        entry_fee: 0,
        tips: "Check closing hours before departure.",
        },
        food_suggestion: dinner
        ? `${dinner.name} (${dinner.address})`
        : `Try a top-rated local restaurant in ${ctx.destination}`,
        local_transport_cost: localCost,
      });
    }
    clone.itinerary = rebuilt;
  }

  if (restaurants.length > 0 && clone.food && typeof clone.food === "object") {
    const food = clone.food as Record<string, unknown>;
    food.top_restaurants = restaurants.slice(0, 3).map((r, i) => ({
      name: r.name,
      cuisine: "Local & Multi-cuisine",
      rating: 4.1 + (i % 3) * 0.1,
      price_range: "Rs.300-900 per person",
      specialty: "Popular local dishes",
      address: r.address,
    }));
    food.street_food_spots = restaurants.slice(3, 5).map((r) => ({
      name: r.name,
      specialty: "Local quick bites",
      price_range: "Rs.80-300",
      location: r.address,
    }));
  }

  if (ctx.geo.nearby.length > 0) {
    clone.nearby_destinations = ctx.geo.nearby.filter((item) => {
      const text = `${item.name} ${item.why_visit}`.toLowerCase();
      return !ctx.destination || text.includes(String(ctx.destination).toLowerCase());
    });
  }

  return clone;
}

function enforceRealDataOnly(
  plan: unknown,
  body: TripFormData,
  sources: {
    geo: GeoapifyContext;
    weather: OpenWeatherContext | null;
    flights: Awaited<ReturnType<typeof getAmadeusFlightQuotes>>;
    hotels: Awaited<ReturnType<typeof getAmadeusHotelQuotes>>;
  }
) {
  if (!plan || typeof plan !== "object") return plan;

  const clone = structuredClone(plan) as Record<string, unknown>;
  const nights = Math.max(
    1,
    Math.round(
      (new Date(body.endDate).getTime() - new Date(body.startDate).getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  const days = Math.min(10, Math.max(2, nights + 1));

  if (sources.weather) {
    clone.weather = sources.weather.summary;
  } else {
    clone.weather = "Live weather data unavailable for this destination currently.";
  }

  if (!sources.flights.length) {
    const unavailableNode = {
      mode: body.transport,
      operator: "Live transport data unavailable",
      departure: "--:--",
      arrival: "--:--",
      duration: "N/A",
      price_per_person: 0,
      total_price: 0,
      comfort: "N/A",
      stops: 0,
      badge: "Unavailable",
    };
    clone.transport = {
      recommended: { ...unavailableNode, badge: "Recommended" },
      bus: { ...unavailableNode, mode: "bus", badge: "Bus" },
      train: { ...unavailableNode, mode: "train", badge: "Train" },
      flight: { ...unavailableNode, mode: "flight", badge: "Flight" },
    };
  }

  if (!sources.hotels.length) {
    clone.hotels = [];
  }

  const attractions = sources.geo.attractions;
  const restaurants = sources.geo.restaurants;
  clone.itinerary = Array.from({ length: days }, (_, i) => {
    const morning = attractions[(i * 3) % Math.max(1, attractions.length)];
    const afternoon = attractions[(i * 3 + 1) % Math.max(1, attractions.length)];
    const evening = attractions[(i * 3 + 2) % Math.max(1, attractions.length)];
    const meal = restaurants[i % Math.max(1, restaurants.length)];
    const date = new Date(body.startDate);
    date.setDate(date.getDate() + i);

    return {
      day: i + 1,
      date: date.toISOString().slice(0, 10),
      theme: attractions.length ? `Explore ${body.destination}` : "Live attractions unavailable",
      morning: {
        activity: morning?.name || "Live attractions unavailable",
        description: morning
          ? `Visit ${morning.name}.`
          : `Could not fetch attraction data for ${body.destination}.`,
        location: morning?.address || "N/A",
        duration: "2-3 hours",
        entry_fee: 0,
        tips: "Check live opening hours before departure.",
      },
      afternoon: {
        activity: afternoon?.name || "Live attractions unavailable",
        description: afternoon
          ? `Continue with ${afternoon.name}.`
          : `Could not fetch attraction data for ${body.destination}.`,
        location: afternoon?.address || "N/A",
        duration: "2-3 hours",
        entry_fee: 0,
        tips: "Keep buffer time for city traffic.",
      },
      evening: {
        activity: evening?.name || "Live attractions unavailable",
        description: evening
          ? `Spend the evening near ${evening.name}.`
          : "Use local recommendations for evening plans.",
        location: evening?.address || "N/A",
        duration: "2 hours",
        entry_fee: 0,
        tips: "Prefer well-lit and known areas after sunset.",
      },
      food_suggestion: meal ? `${meal.name} (${meal.address})` : "Live restaurant data unavailable",
      local_transport_cost: 0,
    };
  });

  clone.food = {
    must_try_dishes: [],
    top_restaurants: restaurants.slice(0, 3).map((r, i) => ({
      name: r.name,
      cuisine: "Local",
      rating: 4 + i * 0.1,
      price_range: "Live price on map/listing",
      specialty: "See menu on provider listing",
      address: r.address,
    })),
    street_food_spots: restaurants.slice(3, 5).map((r) => ({
      name: r.name,
      specialty: "Local quick bites",
      price_range: "Live price on listing",
      location: r.address,
    })),
  };

  return clone;
}

function withDistrictData(
  plan: unknown,
  districtData: { transport: DistrictTransportPlan | null; hotels: DistrictHotelPlan[] }
) {
  if (!plan || typeof plan !== "object") return plan;
  const clone = structuredClone(plan) as Record<string, unknown>;

  if (districtData.transport) {
    clone.transport = districtData.transport;
  }
  if (districtData.hotels.length > 0) {
    clone.hotels = districtData.hotels;
  }

  return clone;
}

function withDistrictBudget(plan: unknown, districtBudget: DistrictBudgetBreakdown | null, body: TripFormData) {
  if (!plan || typeof plan !== "object" || !districtBudget) return plan;
  const clone = structuredClone(plan) as Record<string, unknown>;
  const existingBudget =
    clone.budget && typeof clone.budget === "object"
      ? (clone.budget as Record<string, unknown>)
      : null;

  const hasOnlyCoarseDistrictSplit =
    districtBudget.food === 0 &&
    districtBudget.sightseeing === 0 &&
    districtBudget.local_transport === 0 &&
    districtBudget.miscellaneous === 0;

  if (existingBudget && hasOnlyCoarseDistrictSplit) {
    const transport = Math.max(0, Number(districtBudget.transport || existingBudget.transport || 0));
    const currentNonTransport = {
      hotel: Math.max(0, Number(existingBudget.hotel || 0)),
      food: Math.max(0, Number(existingBudget.food || 0)),
      sightseeing: Math.max(0, Number(existingBudget.sightseeing || 0)),
      local_transport: Math.max(0, Number(existingBudget.local_transport || 0)),
      miscellaneous: Math.max(0, Number(existingBudget.miscellaneous || 0)),
    };
    const currentNonTransportTotal =
      currentNonTransport.hotel +
      currentNonTransport.food +
      currentNonTransport.sightseeing +
      currentNonTransport.local_transport +
      currentNonTransport.miscellaneous;
    const targetNonTransportTotal = Math.max(0, districtBudget.grand_total - transport);

    if (currentNonTransportTotal > 0 && targetNonTransportTotal > 0) {
      const scale = targetNonTransportTotal / currentNonTransportTotal;
      const scaled = {
        hotel: Math.round(currentNonTransport.hotel * scale),
        food: Math.round(currentNonTransport.food * scale),
        sightseeing: Math.round(currentNonTransport.sightseeing * scale),
        local_transport: Math.round(currentNonTransport.local_transport * scale),
        miscellaneous: Math.round(currentNonTransport.miscellaneous * scale),
      };
      const scaledTotal =
        scaled.hotel +
        scaled.food +
        scaled.sightseeing +
        scaled.local_transport +
        scaled.miscellaneous;
      const delta = targetNonTransportTotal - scaledTotal;
      scaled.hotel = Math.max(0, scaled.hotel + delta);

      clone.budget = {
        transport,
        hotel: scaled.hotel,
        food: scaled.food,
        sightseeing: scaled.sightseeing,
        local_transport: scaled.local_transport,
        miscellaneous: scaled.miscellaneous,
        grand_total: districtBudget.grand_total,
        per_person: Math.round(districtBudget.grand_total / Math.max(1, body.travelers)),
        savings_tips: [
          "Budget total is anchored to your stored district cost sheet.",
          "Food, sightseeing, and local transport are proportionally split from the live plan.",
          "Use hotel and transport tabs to compare options without changing the district budget baseline.",
        ],
      };
      return clone;
    }
  }

  clone.budget = {
    ...districtBudget,
    per_person: Math.round(districtBudget.grand_total / Math.max(1, body.travelers)),
    savings_tips: [
      "Budget is anchored to your stored district cost sheet.",
      "Food, sightseeing, and local transport are not inflated beyond the district total.",
      "Use hotel and transport tabs to compare options without changing the budget baseline.",
    ],
  };
  return clone;
}

function withBudgetFloor(
  plan: unknown,
  minimumBudget: { total: number; perPerson: number } | null,
  travelers: number
) {
  if (!plan || typeof plan !== "object" || !minimumBudget?.total) return plan;
  const clone = structuredClone(plan) as Record<string, unknown>;
  const budget =
    clone.budget && typeof clone.budget === "object"
      ? (clone.budget as Record<string, unknown>)
      : null;
  if (!budget) return clone;

  const currentTotal = Math.max(0, Number(budget.grand_total || 0));
  const targetTotal = Math.max(currentTotal, Math.round(minimumBudget.total));
  if (targetTotal === currentTotal) {
    budget.per_person = Math.round(targetTotal / Math.max(1, travelers));
    budget.grand_total = targetTotal;
    clone.budget = budget;
    return clone;
  }

  const keys = ["transport", "hotel", "food", "sightseeing", "local_transport", "miscellaneous"] as const;
  const values = Object.fromEntries(
    keys.map((key) => [key, Math.max(0, Number(budget[key] || 0))])
  ) as Record<(typeof keys)[number], number>;
  const subtotal = keys.reduce((sum, key) => sum + values[key], 0);
  const scale = subtotal > 0 ? targetTotal / subtotal : 1;

  for (const key of keys) {
    values[key] = Math.round(values[key] * scale);
  }
  const scaledTotal = keys.reduce((sum, key) => sum + values[key], 0);
  values.hotel = Math.max(0, values.hotel + (targetTotal - scaledTotal));

  clone.budget = {
    ...budget,
    ...values,
    grand_total: targetTotal,
    per_person: Math.round(targetTotal / Math.max(1, travelers)),
  };
  return clone;
}

export async function POST(request: NextRequest) {
  let requestBody: TripFormData | null = null;
  try {
    const rawBody = (await request.json()) as TripFormData;
    const sourceResolution = resolveIndianLocationName(rawBody.source);
    const destinationResolution = resolveIndianLocationName(rawBody.destination);
    const body: TripFormData = {
      ...rawBody,
      source: sourceResolution.corrected || rawBody.source,
      destination: destinationResolution.corrected || rawBody.destination,
    };
    requestBody = body;

    if (!body.source || !body.destination) {
      return NextResponse.json({ error: "Source and destination are required" }, { status: 400 });
    }
    if (!body.startDate || !body.endDate) {
      return NextResponse.json({ error: "Start date and end date are required" }, { status: 400 });
    }

    const startDate = new Date(`${body.startDate}T00:00:00`);
    const endDate = new Date(`${body.endDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Invalid travel dates" }, { status: 400 });
    }
    if (startDate < today) {
      return NextResponse.json({ error: "Start date must be today or a future date" }, { status: 400 });
    }
    if (endDate < startDate) {
      return NextResponse.json({ error: "End date must be on or after start date" }, { status: 400 });
    }

    const fallbackBase = buildFallbackPlan(body);

    // Priority: use Postgres TN backend data first; call external APIs only if missing.
    const [dbPlaces, districtTransport, districtHotels, districtBudget] = await Promise.all([
      withTimeout(
        getPreferredDestinationPlaces(body.destination, {
          interests: body.interests || [],
          tripType: body.tripType,
          mode: body.mode,
        }).catch(() => []),
        6000,
        "postgres places"
      ).catch(() => []),
      withTimeout(
        getDistrictTransportPlan({
          source: body.source,
          destination: body.destination,
          mode: body.mode,
          transport: body.transport,
          travelers: body.travelers,
        }).catch(() => null),
        4000,
        "district transport"
      ).catch(() => null),
      withTimeout(
        getDistrictHotels({
          destination: body.destination,
          hotelType: body.hotelType,
          travelers: body.travelers,
          startDate: body.startDate,
          endDate: body.endDate,
        }).catch(() => []),
        4000,
        "district hotels"
      ).catch(() => []),
      withTimeout(
        getDistrictBudgetBreakdown({
          source: body.source,
          destination: body.destination,
          startDate: body.startDate,
          endDate: body.endDate,
          travelers: body.travelers,
          mode: body.mode,
        }).catch(() => null),
        4000,
        "district budget"
      ).catch(() => null),
    ]);

    const needExternalTransport = !districtTransport;
    const needExternalHotels = districtHotels.length === 0;
    const sourceTransportQuery = needExternalTransport ? resolveTransportQueryWithLocalState(body.source) : resolveTransportQuery(body.source);
    const destinationTransportQuery = needExternalTransport ? resolveTransportQueryWithLocalState(body.destination) : resolveTransportQuery(body.destination);

    const [realFlightQuotes, realHotelQuotes, geo, weather, srcCoord, destCoord] = await Promise.all([
      withTimeout(
        (needExternalTransport
          ? getAmadeusFlightQuotes({
              source: sourceTransportQuery.query,
              destination: destinationTransportQuery.query,
              departureDate: body.startDate,
              adults: body.travelers,
            }).catch(() => [])
          : Promise.resolve([])),
        12000,
        "flight quotes"
      ).catch(() => []),
      withTimeout(
        (needExternalHotels
          ? getAmadeusHotelQuotes({
              destination: body.destination,
              checkInDate: body.startDate,
              checkOutDate: body.endDate,
              adults: body.travelers,
            }).catch(() => [])
          : Promise.resolve([])),
        12000,
        "hotel quotes"
      ).catch(() => []),
      withTimeout(
        getGeoapifyContext(body.destination).catch(() => ({ attractions: [], restaurants: [], hotels: [], nearby: [] })),
        8000,
        "geo context"
      ).catch(() => ({ attractions: [], restaurants: [], hotels: [], nearby: [] })),
      withTimeout(getOpenWeatherContext(body.destination).catch(() => null), 6000, "weather").catch(() => null),
      withTimeout(getCityCoordinates(sourceTransportQuery.query).catch(() => null), 6000, "source geocode").catch(() => null),
      withTimeout(getCityCoordinates(destinationTransportQuery.query).catch(() => null), 6000, "destination geocode").catch(() => null),
    ]);
    const googleRoutes = await getGoogleRoutesByMode({
      source: sourceTransportQuery.query,
      destination: destinationTransportQuery.query,
      sourceCoord: srcCoord,
      destinationCoord: destCoord,
    });
    const distanceKm = srcCoord && destCoord ? haversineKm(srcCoord, destCoord) : null;
    const destinationKey = normalizeCityInput(body.destination);
    const sourceKey = normalizeCityInput(body.source);
    const forceNoDirectFlight =
      Boolean(NON_AIRPORT_DESTINATIONS[destinationKey]) ||
      Boolean(NON_AIRPORT_DESTINATIONS[sourceKey]) ||
      !canTreatAsDirectFlight(body.source, body.destination);
    const hasDirectFlightQuotes = realFlightQuotes.length > 0 && !forceNoDirectFlight;
    const suggestedMode = suggestTransportMode(distanceKm, hasDirectFlightQuotes);

    const fallbackWithFlights = hasDirectFlightQuotes ? withRealFlights(fallbackBase, realFlightQuotes) : fallbackBase;
    const fallbackWithSuggested = withSuggestedTransport(
      fallbackWithFlights,
      suggestedMode,
      hasDirectFlightQuotes,
      body,
      distanceKm
    );
    const fallbackWithHotels = withGeoHotels(
      withRealHotels(fallbackWithSuggested, realHotelQuotes),
      geo,
      body
    );
    const fallbackEnriched = enrichWithGeoAndWeather(fallbackWithHotels, {
      geo,
      weather,
      destination: body.destination,
      dbPlaces,
    }, body);
    const provisionalWithRouteData = withGoogleRouteData(withModeAwareBudget(fallbackEnriched, body), googleRoutes, sourceTransportQuery.query, destinationTransportQuery.query, body.travelers);
    const provisionalWithDistrict = withDistrictData(provisionalWithRouteData, { transport: districtTransport, hotels: districtHotels });
    const minimumBudget =
      districtBudget
        ? {
            total: districtBudget.grand_total,
            perPerson: districtBudget.per_person,
          }
        : await getDistrictMinimumBudget({
            source: body.source,
            destination: body.destination,
            startDate: body.startDate,
            endDate: body.endDate,
            travelers: body.travelers,
          }).catch(() => null);
    const provisionalPlan = withBudgetFriendlyMode(
      withBudgetFloor(
        withGuaranteedTransportNotes(
          withDistrictBudget(withBudgetAlignedToData(provisionalWithDistrict, body), districtBudget, body),
          body,
          distanceKm
        ),
        minimumBudget,
        body.travelers
      ),
      body
    );
    if (minimumBudget && Number(body.budget || 0) < minimumBudget.total) {
      const gap = Math.max(0, minimumBudget.total - Math.max(0, Number(body.budget || 0)));
      return NextResponse.json(
        {
          error: `Current budget is too low for this trip. Minimum budget is INR ${minimumBudget.total.toLocaleString()}. Increase by INR ${gap.toLocaleString()} and try again.`,
        },
        { status: 400 }
      );
    }

    if (configuredKeys().length === 0) {
      return NextResponse.json({
        success: true,
        plan: provisionalPlan,
        meta: { fallback: true, reason: "No GEMINI_API_KEY configured in .env.local" },
      });
    }

    let parsedPlan: object | null = null;
    let lastRaw = "";

    for (let attempt = 1; attempt <= 1; attempt++) {
      const rawText = await withTimeout(
        generateTripPlan(body),
        15000,
        `Plan generation attempt ${attempt}`
      );
      lastRaw = rawText;
      parsedPlan = await tryParse(rawText);
      if (parsedPlan) break;
    }

    if (!parsedPlan) {
      console.error("[Bookaro] Invalid AI JSON after retries. Raw sample:", lastRaw.slice(0, 400));
      return NextResponse.json({
        success: true,
        plan: provisionalPlan,
        meta: { fallback: true, reason: "AI returned invalid data" },
      });
    }

    const merged = deepMerge(fallbackEnriched, parsedPlan);
    const withLiveTransport = withSuggestedTransport(
      hasDirectFlightQuotes ? withRealFlights(merged, realFlightQuotes) : merged,
      suggestedMode,
      hasDirectFlightQuotes,
      body,
      distanceKm
    );
    const withLiveHotels = withGeoHotels(
      withRealHotels(withLiveTransport, realHotelQuotes),
      geo,
      body
    );
    const enrichedPlan = enrichWithGeoAndWeather(withLiveHotels, {
      geo,
      weather,
      destination: body.destination,
      dbPlaces,
    }, body);
    const finalPlan = STRICT_REAL_DATA
      ? enforceRealDataOnly(enrichedPlan, body, {
          geo,
          weather,
          flights: realFlightQuotes,
          hotels: realHotelQuotes,
        })
      : enrichedPlan;
    const withBudget = withModeAwareBudget(finalPlan, body);
    const withRouteData = withGoogleRouteData(withBudget, googleRoutes, sourceTransportQuery.query, destinationTransportQuery.query, body.travelers);
    const withDistrict = withDistrictData(withRouteData, { transport: districtTransport, hotels: districtHotels });
    const alignedBudget = withBudgetFriendlyMode(
      withBudgetFloor(
        withGuaranteedTransportNotes(
          withDistrictBudget(withBudgetAlignedToData(withDistrict, body), districtBudget, body),
          body,
          distanceKm
        ),
        minimumBudget,
        body.travelers
      ),
      body
    );
    return NextResponse.json({ success: true, plan: alignedBudget });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to generate plan";
    console.error("[Bookaro] Plan API error:", msg);

    if (requestBody) {
      const base = buildFallbackPlan(requestBody);
      const [dbPlaces, districtTransport, districtHotels, districtBudget] = await Promise.all([
        withTimeout(
          getPreferredDestinationPlaces(requestBody.destination, {
            interests: requestBody.interests || [],
            tripType: requestBody.tripType,
            mode: requestBody.mode,
          }).catch(() => []),
          6000,
          "postgres places"
        ).catch(() => []),
        withTimeout(
          getDistrictTransportPlan({
            source: requestBody.source,
            destination: requestBody.destination,
            mode: requestBody.mode,
            transport: requestBody.transport,
            travelers: requestBody.travelers,
          }).catch(() => null),
          4000,
          "district transport"
        ).catch(() => null),
        withTimeout(
          getDistrictHotels({
            destination: requestBody.destination,
            hotelType: requestBody.hotelType,
            travelers: requestBody.travelers,
            startDate: requestBody.startDate,
            endDate: requestBody.endDate,
          }).catch(() => []),
          4000,
          "district hotels"
        ).catch(() => []),
        withTimeout(
          getDistrictBudgetBreakdown({
            source: requestBody.source,
            destination: requestBody.destination,
            startDate: requestBody.startDate,
            endDate: requestBody.endDate,
            travelers: requestBody.travelers,
            mode: requestBody.mode,
          }).catch(() => null),
          4000,
          "district budget"
        ).catch(() => null),
      ]);

      const needExternalTransport = !districtTransport;
      const needExternalHotels = districtHotels.length === 0;
      const sourceTransportQuery = needExternalTransport ? resolveTransportQueryWithLocalState(requestBody.source) : resolveTransportQuery(requestBody.source);
      const destinationTransportQuery = needExternalTransport ? resolveTransportQueryWithLocalState(requestBody.destination) : resolveTransportQuery(requestBody.destination);

      const [realFlightQuotes, realHotelQuotes, geo, weather, srcCoord, destCoord] = await Promise.all([
        withTimeout(
          (needExternalTransport
            ? getAmadeusFlightQuotes({
                source: sourceTransportQuery.query,
                destination: destinationTransportQuery.query,
                departureDate: requestBody.startDate,
                adults: requestBody.travelers,
              }).catch(() => [])
            : Promise.resolve([])),
          12000,
          "flight quotes"
        ).catch(() => []),
        withTimeout(
          (needExternalHotels
            ? getAmadeusHotelQuotes({
                destination: requestBody.destination,
                checkInDate: requestBody.startDate,
                checkOutDate: requestBody.endDate,
                adults: requestBody.travelers,
              }).catch(() => [])
            : Promise.resolve([])),
          12000,
          "hotel quotes"
        ).catch(() => []),
        withTimeout(
          getGeoapifyContext(requestBody.destination).catch(() => ({ attractions: [], restaurants: [], hotels: [], nearby: [] })),
          8000,
          "geo context"
        ).catch(() => ({ attractions: [], restaurants: [], hotels: [], nearby: [] })),
        withTimeout(getOpenWeatherContext(requestBody.destination).catch(() => null), 6000, "weather").catch(() => null),
        withTimeout(getCityCoordinates(sourceTransportQuery.query).catch(() => null), 6000, "source geocode").catch(() => null),
        withTimeout(getCityCoordinates(destinationTransportQuery.query).catch(() => null), 6000, "destination geocode").catch(() => null),
      ]);
      const googleRoutes = await getGoogleRoutesByMode({
        source: sourceTransportQuery.query,
        destination: destinationTransportQuery.query,
        sourceCoord: srcCoord,
        destinationCoord: destCoord,
      });
      const distanceKm = srcCoord && destCoord ? haversineKm(srcCoord, destCoord) : null;
      const destinationKey = normalizeCityInput(requestBody.destination);
      const sourceKey = normalizeCityInput(requestBody.source);
      const forceNoDirectFlight =
        Boolean(NON_AIRPORT_DESTINATIONS[destinationKey]) ||
        Boolean(NON_AIRPORT_DESTINATIONS[sourceKey]) ||
        !canTreatAsDirectFlight(requestBody.source, requestBody.destination);
      const hasDirectFlightQuotes = realFlightQuotes.length > 0 && !forceNoDirectFlight;
      const suggestedMode = suggestTransportMode(distanceKm, hasDirectFlightQuotes);

      const enriched = enrichWithGeoAndWeather(
        withGeoHotels(
          withRealHotels(
            withSuggestedTransport(
              hasDirectFlightQuotes ? withRealFlights(base, realFlightQuotes) : base,
              suggestedMode,
              hasDirectFlightQuotes,
              requestBody,
              distanceKm
            ),
            realHotelQuotes
          ),
          geo,
          requestBody
        ),
        { geo, weather, destination: requestBody.destination, dbPlaces },
        requestBody
      );
      const finalPlan = STRICT_REAL_DATA
        ? enforceRealDataOnly(enriched, requestBody, {
            geo,
            weather,
            flights: realFlightQuotes,
            hotels: realHotelQuotes,
          })
        : enriched;
      const withRouteData = withGoogleRouteData(
        withModeAwareBudget(finalPlan, requestBody),
        googleRoutes,
        sourceTransportQuery.query,
        destinationTransportQuery.query,
        requestBody.travelers
      );
      const withDistrict = withDistrictData(withRouteData, { transport: districtTransport, hotels: districtHotels });
      const minimumBudget =
        districtBudget
          ? {
              total: districtBudget.grand_total,
              perPerson: districtBudget.per_person,
            }
          : await getDistrictMinimumBudget({
              source: requestBody.source,
              destination: requestBody.destination,
              startDate: requestBody.startDate,
              endDate: requestBody.endDate,
              travelers: requestBody.travelers,
            }).catch(() => null);
      const alignedBudget = withBudgetFriendlyMode(
        withBudgetFloor(
          withGuaranteedTransportNotes(
            withDistrictBudget(withBudgetAlignedToData(withDistrict, requestBody), districtBudget, requestBody),
            requestBody,
            distanceKm
          ),
          minimumBudget,
          requestBody.travelers
        ),
        requestBody
      );
      return NextResponse.json({
        success: true,
        plan: alignedBudget,
        meta: { fallback: true, reason: msg },
      });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
