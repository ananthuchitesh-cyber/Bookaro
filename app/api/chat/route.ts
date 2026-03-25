import { NextRequest, NextResponse } from "next/server";
import { generateChatResponse } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const { message, tripContext } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const allKeys = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEY_2,
      process.env.GEMINI_API_KEY_3,
      process.env.GEMINI_API_KEY_4,
      process.env.GEMINI_API_KEY_5,
    ].filter((k) => k && k.trim() && k !== "your_gemini_api_key_here");

    if (allKeys.length === 0) {
      return NextResponse.json({
        success: true,
        reply:
          "I can still help. Keep 10-15% of your budget for buffer costs, prefer daytime arrivals, and save offline maps plus local emergency contacts.",
      });
    }

    const reply = await generateChatResponse(message, tripContext || "No trip planned yet.");
    return NextResponse.json({ success: true, reply });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get response";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
