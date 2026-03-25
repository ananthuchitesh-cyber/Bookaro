export type TripMode = "flight" | "train" | "bus" | "car";

export interface GoogleRouteSummary {
  mode: TripMode;
  distanceKm: number;
  durationText: string;
  steps: string[];
}

type LatLon = { lat: number; lon: number };

interface OrsSegmentStep {
  instruction?: string;
}

interface OrsResponse {
  features?: Array<{
    properties?: {
      summary?: {
        distance?: number;
        duration?: number;
      };
      segments?: Array<{
        steps?: OrsSegmentStep[];
      }>;
    };
  }>;
}

function hasRoutesKey(): boolean {
  const key =
    process.env.OPENROUTESERVICE_API_KEY ||
    process.env.ORS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_ROUTES_API_KEY;
  return Boolean(key && key.trim());
}

function getRoutesKey(): string {
  return (
    process.env.OPENROUTESERVICE_API_KEY ||
    process.env.ORS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_ROUTES_API_KEY ||
    ""
  ).trim();
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 60) return "N/A";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function modeToOrsProfile(mode: TripMode): "driving-car" | "driving-hgv" {
  if (mode === "bus") return "driving-hgv";
  return "driving-car";
}

function fallbackDurationByMode(mode: TripMode, distanceKm: number): string {
  const speed =
    mode === "car" ? 48 :
    mode === "bus" ? 38 :
    mode === "train" ? 55 :
    mode === "flight" ? 520 : 45;
  const seconds = Math.max(1800, Math.round((distanceKm / speed) * 3600));
  return formatDuration(seconds);
}

function notePrefix(mode: TripMode): string {
  if (mode === "flight") return "Air corridor estimate from routing distance";
  if (mode === "train") return "Rail corridor estimate from routing distance";
  return "Mapped road route";
}

export async function getGoogleRouteSummary(params: {
  source: string;
  destination: string;
  mode: TripMode;
  sourceCoord?: LatLon | null;
  destinationCoord?: LatLon | null;
}): Promise<GoogleRouteSummary | null> {
  if (!hasRoutesKey()) return null;
  if (!params.sourceCoord || !params.destinationCoord) return null;

  const profile = modeToOrsProfile(params.mode);
  const body = {
    coordinates: [
      [params.sourceCoord.lon, params.sourceCoord.lat],
      [params.destinationCoord.lon, params.destinationCoord.lat],
    ],
    instructions: true,
    language: "en",
    units: "km",
  };

  const res = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getRoutesKey(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as OrsResponse;
  const feature = data.features?.[0];
  const summary = feature?.properties?.summary;
  if (!summary) return null;

  const distanceKm = Math.max(1, Math.round((summary.distance || 0) / 1000));
  const durationSeconds = Math.round(summary.duration || 0);
  const rawSteps =
    feature?.properties?.segments?.[0]?.steps?.map((s) => s.instruction || "").filter(Boolean) || [];

  const steps: string[] = [notePrefix(params.mode)];
  if (params.mode === "car" || params.mode === "bus") {
    for (const s of rawSteps.slice(0, 5)) steps.push(s);
  }

  return {
    mode: params.mode,
    distanceKm,
    durationText:
      params.mode === "car" || params.mode === "bus"
        ? formatDuration(durationSeconds)
        : fallbackDurationByMode(params.mode, distanceKm),
    steps,
  };
}
