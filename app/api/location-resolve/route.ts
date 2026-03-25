import { NextRequest, NextResponse } from "next/server";
import { resolveIndianLocationName } from "@/lib/locationResolver";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") || "";
  const resolved = resolveIndianLocationName(query);
  return NextResponse.json({ success: true, resolution: resolved });
}
