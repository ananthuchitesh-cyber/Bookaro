import { NextRequest, NextResponse } from "next/server";
import type { TripFormData } from "@/lib/gemini";
import { lookupIata } from "@/lib/cities";
import { resolveIndianLocationName } from "@/lib/locationResolver";
import { findLocalTransportRoute } from "@/lib/localTravelData";

function hasFare(text: string | null | undefined): boolean {
  const s = String(text || "").toLowerCase();
  if (!s || s.includes("n/a") || s.includes("no rail")) return false;
  return /\d/.test(s);
}

function parseDurationMinutes(value: string | null | undefined): number {
  const s = String(value || "").toLowerCase().trim();
  if (!s) return Number.MAX_SAFE_INTEGER;
  const hh = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const mm = s.match(/(\d+)\s*m/);
  const h = hh ? Number(hh[1]) : 0;
  const m = mm ? Number(mm[1]) : 0;
  if (h === 0 && m === 0) return Number.MAX_SAFE_INTEGER;
  return Math.round(h * 60 + m);
}

const NON_DIRECT_FLIGHT_NOTE: Record<string, string> = {
  Ooty: "Flight not available directly. Auto is recommended after reaching the nearest airport.",
  "The Nilgiris": "Flight not available directly. Auto is recommended after reaching the nearest airport.",
  Kodaikanal: "Flight not available directly. Auto is recommended after reaching the nearest airport.",
  Coorg: "Flight not available directly. Auto is recommended after reaching the nearest airport.",
  Kodagu: "Flight not available directly. Auto is recommended after reaching the nearest airport.",
  Munnar: "Flight not available directly. Auto is recommended after reaching the nearest airport.",
  Rishikesh: "Flight not available directly. Auto is recommended after reaching the nearest airport.",
  Yercaud: "Flight not available directly. Auto is recommended after reaching the nearest airport.",
  Mahabalipuram: "Flight not available directly. Auto is recommended after reaching the nearest airport.",
  Kanyakumari: "Flight not available directly. Auto is recommended after reaching the nearest airport.",
};

export async function GET(request: NextRequest) {
  const sourceInput = String(request.nextUrl.searchParams.get("source") || "").trim();
  const destinationInput = String(request.nextUrl.searchParams.get("destination") || "").trim();
  const mode = String(request.nextUrl.searchParams.get("mode") || "auto").trim() as TripFormData["transport"];

  if (!sourceInput || !destinationInput || mode === "auto") {
    return NextResponse.json({ success: true, available: true, resolvedMode: mode || "auto", note: "" });
  }

  const source = resolveIndianLocationName(sourceInput).corrected || sourceInput;
  const destination = resolveIndianLocationName(destinationInput).corrected || destinationInput;
  const routeRow = findLocalTransportRoute(source, destination);

  if (mode === "flight") {
    const directFlightAvailable =
      Boolean(lookupIata(source) && lookupIata(destination)) &&
      /✅|yes|direct|available/i.test(String(routeRow?.flight_available || ""));
    if (directFlightAvailable) {
      return NextResponse.json({ success: true, available: true, resolvedMode: "flight", note: "" });
    }
    return NextResponse.json({
      success: true,
      available: false,
      resolvedMode: "auto",
      note: NON_DIRECT_FLIGHT_NOTE[destination] || "Flight not available directly for this route. Auto is recommended.",
    });
  }

  if (mode === "train") {
    const available = Boolean(routeRow) && hasFare(routeRow?.train_fare_text) && parseDurationMinutes(routeRow?.train_time) < Number.MAX_SAFE_INTEGER;
    return NextResponse.json({
      success: true,
      available,
      resolvedMode: available ? "train" : "auto",
      note: available ? "" : "Train not available for this route. Auto is recommended.",
    });
  }

  if (mode === "bus") {
    const available = Boolean(routeRow) && (hasFare(routeRow?.bus_tnstc_fare) || hasFare(routeRow?.bus_setc_ac_fare));
    return NextResponse.json({
      success: true,
      available,
      resolvedMode: available ? "bus" : "auto",
      note: available ? "" : "Bus not available for this route. Auto is recommended.",
    });
  }

  return NextResponse.json({ success: true, available: true, resolvedMode: mode, note: "" });
}
