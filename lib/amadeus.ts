import { lookupIata } from "@/lib/cities";

interface AmadeusTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface AmadeusLocationResponse {
  data?: Array<{
    iataCode?: string;
    subType?: string;
    address?: { cityName?: string; countryCode?: string };
  }>;
}

interface AmadeusFlightOfferResponse {
  data?: Array<{
    id: string;
    itineraries: Array<{
      duration: string;
      segments: Array<{
        departure: { at: string; iataCode: string };
        arrival: { at: string; iataCode: string };
        carrierCode: string;
        number: string;
        numberOfStops?: number;
      }>;
    }>;
    price: { total: string; currency: string };
  }>;
}

interface AmadeusHotelOfferResponse {
  data?: Array<{
    hotel?: {
      name?: string;
      rating?: string;
      address?: { lines?: string[]; cityName?: string };
      amenities?: string[];
      latitude?: number;
      longitude?: number;
    };
    offers?: Array<{
      price?: { total?: string; currency?: string };
      checkInDate?: string;
      checkOutDate?: string;
    }>;
  }>;
}

export interface FlightQuote {
  operator: string;
  departure: string;
  arrival: string;
  duration: string;
  stops: number;
  totalPrice: number;
  perPersonPrice: number;
}

export interface HotelQuote {
  name: string;
  rating: number;
  location: string;
  amenities: string[];
  pricePerNight: number;
  totalCost: number;
}

type Cache = { token: string | null; expiresAt: number };
const tokenCache: Cache = { token: null, expiresAt: 0 };

const AMADEUS_BASE = "https://test.api.amadeus.com";

function hasCreds(): boolean {
  return Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET);
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function normalizeDuration(isoDuration: string): string {
  const m = isoDuration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
  if (!m) return isoDuration;
  const hours = Number(m[1] || 0);
  const mins = Number(m[2] || 0);
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

async function getAccessToken(): Promise<string> {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.AMADEUS_CLIENT_ID || "",
    client_secret: process.env.AMADEUS_CLIENT_SECRET || "",
  });

  const res = await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Amadeus auth failed (${res.status})`);
  }

  const data = (await res.json()) as AmadeusTokenResponse;
  tokenCache.token = data.access_token;
  tokenCache.expiresAt = Date.now() + Math.max(5, data.expires_in - 10) * 1000;
  return data.access_token;
}

async function findCityIata(city: string): Promise<string | null> {
  const local = lookupIata(city);
  if (local) return local;

  const token = await getAccessToken();
  const url = new URL(`${AMADEUS_BASE}/v1/reference-data/locations`);
  url.searchParams.set("subType", "CITY,AIRPORT");
  url.searchParams.set("keyword", city);
  url.searchParams.set("page[limit]", "5");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = (await res.json()) as AmadeusLocationResponse;
  const top = data.data?.[0];
  return top?.iataCode || null;
}

export async function getAmadeusFlightQuotes(params: {
  source: string;
  destination: string;
  departureDate: string;
  adults: number;
}): Promise<FlightQuote[]> {
  try {
    if (!hasCreds()) return [];
    if (!params.departureDate) return [];

    const [originCode, destinationCode] = await Promise.all([
      findCityIata(params.source),
      findCityIata(params.destination),
    ]);

    if (!originCode || !destinationCode) return [];

    const token = await getAccessToken();
    const url = new URL(`${AMADEUS_BASE}/v2/shopping/flight-offers`);
    url.searchParams.set("originLocationCode", originCode);
    url.searchParams.set("destinationLocationCode", destinationCode);
    url.searchParams.set("departureDate", params.departureDate);
    url.searchParams.set("adults", String(Math.max(1, params.adults)));
    url.searchParams.set("currencyCode", "INR");
    url.searchParams.set("max", "8");

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];

    const payload = (await res.json()) as AmadeusFlightOfferResponse;
    const offers = payload.data ?? [];

    return offers
      .map((offer) => {
        const itinerary = offer.itineraries?.[0];
        const firstSeg = itinerary?.segments?.[0];
        const lastSeg = itinerary?.segments?.[itinerary.segments.length - 1];
        if (!itinerary || !firstSeg || !lastSeg) return null;

        const total = Math.round(Number(offer.price.total || 0));
        if (!Number.isFinite(total) || total <= 0) return null;

        const stops = Math.max(0, itinerary.segments.length - 1);
        return {
          operator: `${firstSeg.carrierCode} ${firstSeg.number}`,
          departure: formatTime(firstSeg.departure.at),
          arrival: formatTime(lastSeg.arrival.at),
          duration: normalizeDuration(itinerary.duration),
          stops,
          totalPrice: total,
          perPersonPrice: Math.max(1, Math.round(total / Math.max(1, params.adults))),
        } as FlightQuote;
      })
      .filter((x): x is FlightQuote => Boolean(x));
  } catch (error) {
    console.warn("[Bookaro] Amadeus flight quotes unavailable:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function getAmadeusHotelQuotes(params: {
  destination: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  rooms?: number;
}): Promise<HotelQuote[]> {
  try {
    if (!hasCreds()) return [];
    if (!params.checkInDate || !params.checkOutDate) return [];

    const cityCode = await findCityIata(params.destination);
    if (!cityCode) return [];

    const token = await getAccessToken();
    const url = new URL(`${AMADEUS_BASE}/v3/shopping/hotel-offers`);
    url.searchParams.set("cityCode", cityCode);
    url.searchParams.set("checkInDate", params.checkInDate);
    url.searchParams.set("checkOutDate", params.checkOutDate);
    url.searchParams.set("adults", String(Math.max(1, params.adults)));
    url.searchParams.set("roomQuantity", String(Math.max(1, params.rooms || 1)));
    url.searchParams.set("bestRateOnly", "true");
    url.searchParams.set("currency", "INR");

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];

    const payload = (await res.json()) as AmadeusHotelOfferResponse;
    const list = payload.data ?? [];

    return list
      .map((item) => {
        const offer = item.offers?.[0];
        const total = Number(offer?.price?.total || 0);
        if (!offer || !Number.isFinite(total) || total <= 0) return null;

        const nights = Math.max(
          1,
          Math.round(
            (new Date(params.checkOutDate).getTime() - new Date(params.checkInDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );
        const location =
          item.hotel?.address?.lines?.join(", ") ||
          item.hotel?.address?.cityName ||
          params.destination;

        return {
          name: item.hotel?.name || "Hotel",
          rating: Number(item.hotel?.rating || 4),
          location,
          amenities: (item.hotel?.amenities || []).slice(0, 6),
          totalCost: Math.round(total),
          pricePerNight: Math.max(1, Math.round(total / nights)),
        } as HotelQuote;
      })
      .filter((x): x is HotelQuote => Boolean(x))
      .sort((a, b) => a.totalCost - b.totalCost)
      .slice(0, 6);
  } catch (error) {
    console.warn("[Bookaro] Amadeus hotel quotes unavailable:", error instanceof Error ? error.message : String(error));
    return [];
  }
}
