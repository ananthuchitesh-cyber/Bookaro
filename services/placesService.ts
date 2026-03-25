import { getTravelDbPool } from "@/lib/postgres";
import { TripFormData } from "@/lib/gemini";
import { findLocalPlaces, findLocalStateByName, resolveLocalStateName } from "@/lib/localTravelData";

export type RealPlace = {
  name: string;
  address: string;
  category: string;
  rating: number;
  image_url?: string;
  map_url?: string;
  description?: string;
  must_visit?: boolean;
};

type DestinationAlias = Record<string, string>;

const DESTINATION_ALIAS: DestinationAlias = {
  chennai: "Chennai",
  kancheepuram: "Kancheepuram",
  vellore: "Vellore",
  tiruvannamalai: "Tiruvannamalai",
  villupuram: "Villupuram",
  cuddalore: "Cuddalore",
  chidambaram: "Chidambaram",
  nagapattinam: "Nagapattinam",
  mayiladuthurai: "Mayiladuthurai",
  thanjavur: "Thanjavur",
  tanjavur: "Thanjavur",
  tanjore: "Thanjavur",
  thanjai: "Thanjavur",
  tiruvarur: "Tiruvarur",
  pudukkottai: "Pudukkottai",
  tiruchirappalli: "Tiruchirappalli",
  trichy: "Tiruchirappalli",
  perambalur: "Perambalur",
  ariyalur: "Ariyalur",
  salem: "Salem",
  namakkal: "Namakkal",
  erode: "Erode",
  coimbatore: "Coimbatore",
  tiruppur: "Tiruppur",
  ooty: "The Nilgiris",
  nilgiris: "The Nilgiris",
  "the nilgiris": "The Nilgiris",
  dharmapuri: "Dharmapuri",
  krishnagiri: "Krishnagiri",
  ranipet: "Ranipet",
  tirupattur: "Tirupattur",
  dindigul: "Dindigul",
  madurai: "Madurai",
  theni: "Theni",
  virudhunagar: "Virudhunagar",
  sivaganga: "Sivaganga",
  ramanathapuram: "Ramanathapuram",
  rameswaram: "Ramanathapuram",
  thoothukudi: "Thoothukudi",
  tirunelveli: "Tirunelveli",
  tenkasi: "Tenkasi",
  kanniyakumari: "Kanniyakumari",
  kanyakumari: "Kanniyakumari",
  kaniyakumari: "Kanniyakumari",
  karur: "Karur",
};

const INTEREST_TO_CATEGORY: Record<string, string[]> = {
  culture: ["historical", "heritage", "museum", "monument", "palace"],
  history: ["historical", "heritage", "museum", "fort", "monument"],
  temple: ["temple", "spiritual"],
  spiritual: ["temple", "spiritual", "church", "mosque"],
  nature: ["nature", "wildlife", "waterfall", "lake", "viewpoint", "hill station", "beach", "park"],
  adventure: ["trek", "hiking", "nature", "wildlife", "viewpoint", "hill station"],
  beach: ["beach", "coast", "island"],
  food: ["market", "street food", "food"],
  shopping: ["market", "shopping", "bazaar"],
};

function normalizeText(value: string): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeDestination(destination: string): string {
  const key = normalizeText(destination);
  if (DESTINATION_ALIAS[key]) return DESTINATION_ALIAS[key];
  if (key.includes("kanya") || key.includes("kaniya")) return "Kanniyakumari";
  if (key.includes("nilgiri") || key.includes("ooty")) return "The Nilgiris";
  if (key.includes("thanja") || key.includes("tanja") || key.includes("tanjore")) return "Thanjavur";
  for (const alias of Object.keys(DESTINATION_ALIAS)) {
    if (alias.length >= 6 && (key.includes(alias) || alias.includes(key))) {
      return DESTINATION_ALIAS[alias];
    }
  }
  return destination.trim();
}

function preferenceTokens(pref: Pick<TripFormData, "interests" | "tripType" | "mode">): string[] {
  const tokens = new Set<string>();
  for (const i of pref.interests || []) {
    const t = normalizeText(i);
    if (t) tokens.add(t);
  }
  tokens.add(normalizeText(pref.tripType));
  tokens.add(normalizeText(pref.mode));
  return Array.from(tokens);
}

function scorePlace(place: RealPlace, tokens: string[]): number {
  const category = normalizeText(place.category);
  const name = normalizeText(place.name);
  const description = normalizeText(place.description || "");
  const text = `${category} ${name} ${description}`;

  let score = place.must_visit ? 10 : 0;
  score += Number(place.rating || 0) * 2;

  for (const token of tokens) {
    const mappedCategories = INTEREST_TO_CATEGORY[token] || [];
    if (mappedCategories.some((c) => text.includes(c))) score += 8;
    if (text.includes(token)) score += 5;
  }

  if (category.includes("temple") && tokens.includes("family")) score += 4;
  if ((category.includes("beach") || category.includes("nature")) && tokens.includes("romantic")) score += 4;
  if ((category.includes("trek") || category.includes("wildlife")) && tokens.includes("adventure")) score += 5;
  if (tokens.includes("budget") && (place.description || "").toLowerCase().includes("free")) score += 3;

  return score;
}

function stripScore<T extends { __score: number }>(item: T): Omit<T, "__score"> {
  // Remove ranking metadata before returning place records to the planner.
  const { __score, ...rest } = item;
  void __score;
  return rest;
}

export async function getPreferredDestinationPlaces(
  destination: string,
  pref: Pick<TripFormData, "interests" | "tripType" | "mode">,
  limit = 30
): Promise<RealPlace[]> {
  if (!destination?.trim()) return [];

  const normalizedDestination = normalizeDestination(destination);
  const tokens = preferenceTokens(pref);
  const directState = resolveLocalStateName(normalizedDestination);
  const localRows = findLocalPlaces(normalizedDestination);
  if (localRows.length) {
    return localRows
      .map((p) => ({
        name: p.name,
        address: p.address,
        category: p.category,
        rating: p.must_visit ? 4.5 : 4,
        map_url: p.map_url,
        description: p.description,
        must_visit: p.must_visit,
      }))
      .map((p) => ({ ...p, __score: scorePlace(p, tokens) }))
      .sort(
        (a: RealPlace & { __score: number }, b: RealPlace & { __score: number }) =>
          b.__score - a.__score || (b.rating || 0) - (a.rating || 0)
      )
      .slice(0, Math.max(6, limit))
      .map(stripScore);
  }

  const stateHint = directState || findLocalStateByName(normalizedDestination);
  const pool = getTravelDbPool();
  if (!pool) return [];

  try {
    const exactParams = directState
      ? [directState]
      : stateHint
        ? [normalizedDestination, stateHint]
        : [normalizedDestination];
    const exactWhere = directState
      ? "lower(d.state) = lower($1)"
      : `(
          lower(d.name) = lower($1)
          OR lower(p.district) = lower($1)
        ) ${stateHint ? "AND lower(d.state) = lower($2)" : ""}`;

    const result = await pool.query(
      `
      SELECT
        p.name,
        p.address,
        p.category,
        COALESCE(p.rating, 0) AS rating,
        p.image_url,
        p.map_url,
        p.description,
        p.must_visit,
        p.district
      FROM tourist_places p
      INNER JOIN destinations d ON d.id = p.destination_id
      WHERE ${exactWhere}
      `,
      exactParams
    );
    const rows = (result.rows || []) as Array<RealPlace & { district: string }>;

    let finalRows = rows;
    if (!finalRows.length) {
      const fuzzyEnabled = !directState && normalizedDestination.length >= 5;
      if (!fuzzyEnabled) return [];

      const fuzzy = await pool.query(
        `
        SELECT
          p.name,
          p.address,
          p.category,
          COALESCE(p.rating, 0) AS rating,
          p.image_url,
          p.map_url,
          p.description,
          p.must_visit,
          p.district
        FROM tourist_places p
        INNER JOIN destinations d ON d.id = p.destination_id
        WHERE (
          lower(d.name) LIKE lower($1)
          OR lower(p.district) LIKE lower($1)
        )
        ${stateHint ? " AND lower(d.state) = lower($2)" : ""}
        `,
        stateHint ? [`%${normalizedDestination}%`, stateHint] : [`%${normalizedDestination}%`]
      );
      finalRows = (fuzzy.rows || []) as Array<RealPlace & { district: string }>;
    }

    if (!finalRows.length) return [];
    const ranked = finalRows
      .map((p) => ({ ...p, __score: scorePlace(p, tokens) }))
      .sort(
        (a: RealPlace & { __score: number }, b: RealPlace & { __score: number }) =>
          b.__score - a.__score || (b.rating || 0) - (a.rating || 0)
      )
      .slice(0, Math.max(6, limit))
      .map(stripScore);
    return ranked;
  } catch (error) {
    console.error("[placesService] getPreferredDestinationPlaces failed:", error);
    return [];
  }
}
