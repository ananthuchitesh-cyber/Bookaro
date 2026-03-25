
export interface GeoPlace {
  name: string;
  address: string;
  category: string;
}

export interface GeoapifyContext {
  attractions: GeoPlace[];
  restaurants: GeoPlace[];
  hotels: GeoPlace[];
  nearby: Array<{ name: string; distance: string; why_visit: string }>;
}

interface GeoapifyGeocodeResponse {
  features?: Array<{
    properties?: {
      lon?: number;
      lat?: number;
    };
  }>;
}

interface GeoapifyPlacesResponse {
  features?: Array<{
    properties?: {
      name?: string;
      formatted?: string;
      address_line2?: string;
      city?: string;
      suburb?: string;
      district?: string;
      county?: string;
      state?: string;
      categories?: string[];
    };
  }>;
}

type GeoapifyPlaceProps = {
  name?: string;
  formatted?: string;
  address_line2?: string;
  city?: string;
  suburb?: string;
  district?: string;
  county?: string;
  state?: string;
  categories?: string[];
};

function hasGeoapify(): boolean {
  return Boolean(process.env.GEOAPIFY_API_KEY && process.env.GEOAPIFY_API_KEY.trim());
}

function normalizePlaceName(name?: string): string | null {
  if (!name) return null;
  const n = name.trim();
  if (!n || n.toLowerCase() === "unknown") return null;
  return n;
}

function placeAddress(p?: GeoapifyPlaceProps): string {
  return (
    p?.formatted ||
    p?.address_line2 ||
    [p?.suburb, p?.district, p?.city, p?.state].filter(Boolean).join(", ") ||
    "City center"
  );
}

async function geocodeCity(city: string): Promise<{ lat: number; lon: number } | null> {
  if (!hasGeoapify()) return null;
  const queries = [
    { text: `${city.trim()} India`, withCountry: true },
    { text: city.trim(), withCountry: true },
    { text: city.trim(), withCountry: false },
  ];

  for (const q of queries) {
    const url = new URL("https://api.geoapify.com/v1/geocode/search");
    url.searchParams.set("text", q.text);
    if (q.withCountry) url.searchParams.set("filter", "countrycode:in");
    url.searchParams.set("limit", "1");
    url.searchParams.set("apiKey", process.env.GEOAPIFY_API_KEY || "");

    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) continue;
    const data = (await res.json()) as GeoapifyGeocodeResponse;
    const first = data.features?.[0]?.properties;
    if (first?.lat && first?.lon) return { lat: first.lat, lon: first.lon };
  }
  return null;
}

export async function getCityCoordinates(city: string): Promise<{ lat: number; lon: number } | null> {
  return geocodeCity(city);
}

async function fetchPlaces(params: {
  lat: number;
  lon: number;
  categories: string;
  limit: number;
}): Promise<GeoPlace[]> {
  if (!hasGeoapify()) return [];
  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories", params.categories);
  url.searchParams.set("filter", `circle:${params.lon},${params.lat},50000`);
  url.searchParams.set("bias", `proximity:${params.lon},${params.lat}`);
  url.searchParams.set("limit", String(params.limit));
  url.searchParams.set("apiKey", process.env.GEOAPIFY_API_KEY || "");

  const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
  if (!res.ok) return [];

  const data = (await res.json()) as GeoapifyPlacesResponse;
  return (data.features || [])
    .map((f) => {
      const name = normalizePlaceName(f.properties?.name);
      if (!name) return null;
      return {
        name,
        address: placeAddress(f.properties),
        category: f.properties?.categories?.[0] || "place",
      } as GeoPlace;
    })
    .filter((x): x is GeoPlace => Boolean(x));
}

export async function getGeoapifyContext(destination: string): Promise<GeoapifyContext> {
  const geo = await geocodeCity(destination);
  if (!geo) return { attractions: [], restaurants: [], hotels: [], nearby: [] };

  const [attractionsPrimary, attractionsSecondary, restaurants, hotels, nearbyCities] = await Promise.all([
    fetchPlaces({
      lat: geo.lat,
      lon: geo.lon,
      categories: "tourism.sights,entertainment,leisure.park",
      limit: 24,
    }),
    fetchPlaces({
      lat: geo.lat,
      lon: geo.lon,
      categories: "tourism,natural,heritage",
      limit: 24,
    }),
    fetchPlaces({
      lat: geo.lat,
      lon: geo.lon,
      categories: "catering.restaurant,catering.fast_food,catering.cafe",
      limit: 20,
    }),
    fetchPlaces({
      lat: geo.lat,
      lon: geo.lon,
      categories: "accommodation.hotel,accommodation.guest_house,accommodation.hostel",
      limit: 24,
    }),
    fetchPlaces({
      lat: geo.lat,
      lon: geo.lon,
      categories: "populated_place.city,populated_place.town",
      limit: 12,
    }),
  ]);

  const dedupe = (places: GeoPlace[]) => {
    const seen = new Set<string>();
    const out: GeoPlace[] = [];
    for (const p of places) {
      const key = `${p.name.toLowerCase()}|${p.address.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
    return out;
  };

  const attractions = dedupe([...attractionsPrimary, ...attractionsSecondary]);
  const food = dedupe(restaurants);
  const stays = dedupe(hotels);

  const nearby = dedupe(nearbyCities)
    .filter((p) => p.name.toLowerCase() !== destination.toLowerCase())
    .slice(0, 4)
    .map((p) => ({
      name: p.name,
      distance: "Nearby",
      why_visit: `Popular stop around ${destination}`,
    }));

  return {
    attractions: attractions.slice(0, 18),
    restaurants: food.slice(0, 12),
    hotels: stays.slice(0, 12),
    nearby,
  };
}
