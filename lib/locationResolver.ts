import fs from "node:fs";
import path from "node:path";
import { getLocalTravelData } from "@/lib/localTravelData";
import { normalizeCityInput } from "@/lib/cities";

type LocationKind = "state" | "district" | "destination";

type LocationCandidate = {
  name: string;
  kind: LocationKind;
};

export type LocationResolution = {
  input: string;
  corrected: string | null;
  kind: LocationKind | null;
  confidence: number;
  changed: boolean;
};

const STATE_CSV_PATH = path.join(
  process.cwd(),
  "standalone-data",
  "india-master-template",
  "india_state_master.csv"
);

const RAW_ALIAS_MAP: Record<string, string> = {
  bangalore: "Bengaluru",
  bengalooru: "Bengaluru",
  bombay: "Mumbai",
  calcutta: "Kolkata",
  madras: "Chennai",
  trivandrum: "Thiruvananthapuram",
  cochin: "Kochi",
  calicut: "Kozhikode",
  pondicherry: "Puducherry",
  orissa: "Odisha",
  uttaranchal: "Uttarakhand",
  coorg: "Kodagu",
  mysore: "Mysuru",
  simla: "Shimla",
  gurgaon: "Gurugram",
  nilgiri: "The Nilgiris",
  nilgiris: "The Nilgiris",
  nilgori: "The Nilgiris",
  nilagiri: "The Nilgiris",
  nilagiris: "The Nilgiris",
  nigiri: "The Nilgiris",
  nigiris: "The Nilgiris",
  nigori: "The Nilgiris",
  thiruvallur: "Thiruvallur",
  tiruvallur: "Thiruvallur",
  thiruvarur: "Tiruvarur",
  tiruvarur: "Tiruvarur",
  ooty: "Ooty",
  udhagamandalam: "Ooty",
  ootacamund: "Ooty",
};

let cachedCandidates: LocationCandidate[] | null = null;
let cachedByKey: Map<string, LocationCandidate> | null = null;

function normalizeLocationKey(value: string): string {
  return normalizeCityInput(
    String(value || "")
      .replace(/\b(district|state|unionterritory|ut|city|division)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function buildVariantKeys(value: string): string[] {
  const key = normalizeLocationKey(value);
  const variants = new Set<string>([key]);
  if (!key) return [];

  if (key.startsWith("thiru")) variants.add(`t${key.slice(1)}`);
  if (key.startsWith("tiru")) variants.add(`th${key.slice(1)}`);

  if (key.includes("kanyakumari") || key.includes("kanniyakumari") || key.includes("kaniyakumari")) {
    variants.add("kanyakumari");
    variants.add("kanniyakumari");
  }
  if (key.includes("thoothukudi") || key.includes("tuticorin")) {
    variants.add("thoothukudi");
    variants.add("tuticorin");
  }
  if (key.includes("tirunelveli") || key.includes("nellai")) {
    variants.add("tirunelveli");
    variants.add("nellai");
  }
  if (key.includes("tiruchi") || key.includes("trichy") || key.includes("tiruchirappalli")) {
    variants.add("tiruchi");
    variants.add("trichy");
    variants.add("tiruchirappalli");
  }
  if (key.includes("thanjavur") || key.includes("tanjavur") || key.includes("tanjore")) {
    variants.add("thanjavur");
    variants.add("tanjavur");
    variants.add("tanjore");
  }
  if (key.includes("nilgiri") || key === "ooty") {
    variants.add("thenilgiris");
    variants.add("nilgiris");
    variants.add("ooty");
  }

  return Array.from(variants).filter(Boolean);
}

function parseStateNamesFromCsv(): string[] {
  if (!fs.existsSync(STATE_CSV_PATH)) return [];
  try {
    const text = fs.readFileSync(STATE_CSV_PATH, "utf8");
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length <= 1) return [];
    return lines
      .slice(1)
      .map((line) => {
        const cols = line.split(",");
        return cols[1]?.trim() || "";
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getLocationCandidates(): { candidates: LocationCandidate[]; byKey: Map<string, LocationCandidate> } {
  if (cachedCandidates && cachedByKey) {
    return { candidates: cachedCandidates, byKey: cachedByKey };
  }

  const data = getLocalTravelData();
  const byKey = new Map<string, LocationCandidate>();
  const add = (name: string, kind: LocationKind) => {
    const trimmed = String(name || "").trim();
    const variantKeys = buildVariantKeys(trimmed);
    if (!trimmed || variantKeys.length === 0) return;
    const canonical = { name: trimmed, kind };
    for (const key of variantKeys) {
      if (!byKey.has(key)) {
        byKey.set(key, canonical);
      }
    }
  };
  const addAlias = (alias: string, target: LocationCandidate) => {
    for (const aliasKey of buildVariantKeys(alias)) {
      if (!aliasKey || byKey.has(aliasKey)) continue;
      byKey.set(aliasKey, target);
    }
  };

  for (const stateName of parseStateNamesFromCsv()) add(stateName, "state");
  for (const stateName of data?.states || []) add(stateName, "state");
  for (const row of data?.transport_routes || []) {
    add(row.source_district, "district");
    add(row.destination_district, "district");
  }
  for (const row of data?.transport_costs || []) {
    add(row.source_district, "district");
    add(row.destination_district, "district");
  }
  for (const row of data?.hotels || []) add(row.district, "district");
  for (const row of data?.places || []) {
    add(row.district, "district");
    add(row.destination, "destination");
  }

  for (const candidate of Array.from(byKey.values())) {
    const withoutLeadingArticle = candidate.name.replace(/^(the)\s+/i, "").trim();
    if (withoutLeadingArticle && withoutLeadingArticle !== candidate.name) {
      addAlias(withoutLeadingArticle, candidate);
    }

    const withoutParens = candidate.name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
    if (withoutParens && withoutParens !== candidate.name) {
      addAlias(withoutParens, candidate);
    }
  }

  for (const [alias, canonical] of Object.entries(RAW_ALIAS_MAP)) {
    const canonicalKey = normalizeLocationKey(canonical);
    const canonicalCandidate = byKey.get(canonicalKey);
    if (canonicalCandidate) {
      addAlias(alias, canonicalCandidate);
    } else {
      addAlias(alias, { name: canonical, kind: "destination" });
    }
  }

  cachedCandidates = Array.from(new Map(Array.from(byKey.values()).map((item) => [normalizeLocationKey(item.name), item])).values());
  cachedByKey = byKey;
  return { candidates: cachedCandidates, byKey: cachedByKey };
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
}

function scoreCandidate(inputKey: string, candidateKey: string, kind: LocationKind): number {
  if (inputKey === candidateKey) return 1;
  if (!inputKey || !candidateKey) return 0;
  if (candidateKey.startsWith(inputKey) || inputKey.startsWith(candidateKey)) {
    return 0.94 - Math.abs(candidateKey.length - inputKey.length) * 0.01;
  }
  if (candidateKey.includes(inputKey) || inputKey.includes(candidateKey)) {
    return 0.88 - Math.abs(candidateKey.length - inputKey.length) * 0.01;
  }

  const distance = levenshtein(inputKey, candidateKey);
  const longest = Math.max(inputKey.length, candidateKey.length);
  const similarity = 1 - distance / longest;
  const kindBonus = kind === "state" ? 0.015 : kind === "district" ? 0.01 : 0;
  return similarity + kindBonus;
}

function isUnsafeNearMatch(inputKey: string, bestKey: string, secondKey: string, bestScore: number, secondScore: number): boolean {
  const scoreGap = bestScore - secondScore;
  if (scoreGap >= 0.03) return false;
  if (bestKey === secondKey) return false;

  const sharedPrefixLength = (() => {
    let i = 0;
    while (i < inputKey.length && i < bestKey.length && i < secondKey.length) {
      if (inputKey[i] !== bestKey[i] || inputKey[i] !== secondKey[i]) break;
      i += 1;
    }
    return i;
  })();

  const bestDistance = levenshtein(inputKey, bestKey);
  const secondDistance = levenshtein(inputKey, secondKey);
  return sharedPrefixLength >= 6 && bestDistance <= 3 && secondDistance <= 3;
}

export function resolveIndianLocationName(input: string): LocationResolution {
  const trimmed = String(input || "").trim();
  const inputKey = normalizeLocationKey(trimmed);

  if (!trimmed || inputKey.length < 3) {
    return { input: trimmed, corrected: null, kind: null, confidence: 0, changed: false };
  }

  const { candidates, byKey } = getLocationCandidates();
  const exact = byKey.get(inputKey);
  if (exact) {
    return {
      input: trimmed,
      corrected: exact.name,
      kind: exact.kind,
      confidence: 1,
      changed: exact.name !== trimmed,
    };
  }

  let best: LocationCandidate | null = null;
  let bestScore = 0;
  let secondBest: LocationCandidate | null = null;
  let secondBestScore = 0;

  for (const candidate of candidates) {
    for (const candidateKey of buildVariantKeys(candidate.name)) {
      const score = scoreCandidate(inputKey, candidateKey, candidate.kind);
      if (score > bestScore) {
        secondBest = best;
        secondBestScore = bestScore;
        best = candidate;
        bestScore = score;
      } else if (score > secondBestScore) {
        secondBest = candidate;
        secondBestScore = score;
      }
    }
  }

  const minScore =
    inputKey.length <= 4 ? 0.84 :
    inputKey.length <= 6 ? 0.78 :
    0.72;

  if (!best || bestScore < minScore) {
    return { input: trimmed, corrected: null, kind: null, confidence: 0, changed: false };
  }

  if (secondBest) {
    const bestKey = normalizeLocationKey(best.name);
    const secondKey = normalizeLocationKey(secondBest.name);
    if (isUnsafeNearMatch(inputKey, bestKey, secondKey, bestScore, secondBestScore)) {
      return { input: trimmed, corrected: null, kind: null, confidence: 0, changed: false };
    }
  }

  if (best.name !== trimmed && bestScore < 0.9) {
    return { input: trimmed, corrected: null, kind: null, confidence: 0, changed: false };
  }

  return {
    input: trimmed,
    corrected: best.name,
    kind: best.kind,
    confidence: Number(bestScore.toFixed(3)),
    changed: best.name !== trimmed,
  };
}
