import { NextRequest, NextResponse } from "next/server";
import type { TripFormData } from "@/lib/gemini";
import { getDistrictBudgetBreakdown, getDistrictMinimumBudget } from "@/services/districtTravelService";

export async function GET(request: NextRequest) {
  const source = String(request.nextUrl.searchParams.get("source") || "").trim();
  const destination = String(request.nextUrl.searchParams.get("destination") || "").trim();
  const startDate = String(request.nextUrl.searchParams.get("startDate") || "").trim();
  const endDate = String(request.nextUrl.searchParams.get("endDate") || "").trim();
  const travelers = Math.max(1, Number(request.nextUrl.searchParams.get("travelers") || "1"));
  const mode = String(request.nextUrl.searchParams.get("mode") || "budget").trim() as TripFormData["mode"];

  if (!source || !destination || !startDate || !endDate) {
    return NextResponse.json({ success: true, minimumBudget: null });
  }

  const districtBudget = await getDistrictBudgetBreakdown({
    source,
    destination,
    startDate,
    endDate,
    travelers,
    mode,
  }).catch(() => null);

  const minimumBudget =
    districtBudget
      ? { total: districtBudget.grand_total, perPerson: districtBudget.per_person }
      : await getDistrictMinimumBudget({
          source,
          destination,
          startDate,
          endDate,
          travelers,
        }).catch(() => null);

  return NextResponse.json({ success: true, minimumBudget });
}
