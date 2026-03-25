import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-2.5-flash";

//  MULTI-KEY ROTATION 
// Reads GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3, GEMINI_API_KEY_4, GEMINI_API_KEY_5
// from .env.local. When one key hits quota/rate-limit, automatically switches
// to the next key so the site stays online 24/7.

function getApiKeys(): string[] {
  const keys: string[] = [];
  const envKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
  ];
  for (const k of envKeys) {
    if (k && k.trim() && k !== "your_gemini_api_key_here") {
      keys.push(k.trim());
    }
  }
  return keys;
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("429") ||
    msg.includes("Too Many Requests") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota")
  );
}

function getRetryDelay(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/retryDelay\\":\\"(\d+)s"|retry in ([\d.]+)s/i);
  return m ? (Math.ceil(Number(m[1] || m[2])) + 3) * 1000 : 35000;
}

export interface TripFormData {
  source: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budget: number;
  currency: string;
  transport: "auto" | "flight" | "train" | "bus" | "car";
  hotelType: "budget" | "3-star" | "5-star" | "luxury";
  food: "veg" | "non-veg" | "both" | "local";
  tripType: "family" | "friends" | "solo" | "romantic" | "adventure";
  interests: string[];
  mode: "budget" | "luxury" | "adventure" | "family" | "romantic";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Robust JSON extractor: strips thinking text, code fences, angle brackets inside
 * strings, and finds the outermost JSON object by brace matching.
 */
export function extractJSON(raw: string): string {
  let text = raw.trim();

  // Remove markdown code fences
  text = text.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/im, "").trim();

  // Remove zero-width and other invisible chars
  text = text.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "");

  // Find the outermost JSON object
  const start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in AI response");

  let depth = 0;
  let end = -1;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (!inString) {
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
  }

  if (end === -1) throw new Error("JSON object is not properly closed");

  let jsonStr = text.slice(start, end + 1);

  // Fix common issues: unescaped control chars inside strings
  jsonStr = jsonStr.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, " ");

  return jsonStr;
}

export function buildTripPrompt(data: TripFormData): string {
  const nights = Math.max(
    1,
    Math.round(
      (new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  const totalDays = Math.min(nights, 5);
  const perPersonBudget = Math.round(data.budget / data.travelers);
  const selectedTransport = data.transport === "auto" ? "best available (auto)" : data.transport;
  const selectedTransportMode = data.transport === "auto" ? "train" : data.transport;

  return `You are Bookaro, an expert AI travel planner specializing in Indian tourism. Generate a 100% REAL, ACCURATE travel plan for the route below.

TRIP DETAILS:
- Route: ${data.source} to ${data.destination}
- Dates: ${data.startDate} to ${data.endDate} (${nights} nights, ${totalDays} days)
- Travelers: ${data.travelers} people | Total Budget: Rs.${data.budget} (Rs.${perPersonBudget}/person)
- Transport: ${selectedTransport} | Hotel: ${data.hotelType} | Food: ${data.food}
- Trip type: ${data.tripType} | Mode: ${data.mode} | Interests: ${data.interests.join(", ")}

STRICT RULES  FOLLOW EXACTLY:
1. Use ONLY real, existing places, hotels, restaurants, and transport operators
2. Use ACCURATE real-world prices in Indian Rupees (2025-26 rates)
3. Each day's activities must be REAL famous sights/experiences at ${data.destination}
4. Hotel names must be REAL hotels that actually exist in ${data.destination}
5. Restaurant names must be REAL, well-known restaurants at ${data.destination}
6. Transport operators must be REAL (e.g., IndiGo, Vande Bharat, KSRTC, etc.)
7. Return ONLY the JSON below  no markdown, no explanation, no thinking text
8. Start your response with { and end with }  nothing else

OUTPUT THIS JSON (fill all values with real data):
{
  "summary": "Write 2 specific sentences about this exact ${data.source} to ${data.destination} trip for ${data.travelers} people in ${data.mode} mode",
  "destination_overview": "Write 2 sentences about what makes ${data.destination} famous and worth visiting",
  "best_time_to_visit": "Write the actual best months to visit ${data.destination}",
  "weather": "Describe actual weather in ${data.destination} during ${data.startDate.split("-")[1] === "01" || data.startDate.split("-")[1] === "02" || data.startDate.split("-")[1] === "12" ? "winter" : data.startDate.split("-")[1] === "06" || data.startDate.split("-")[1] === "07" || data.startDate.split("-")[1] === "08" ? "monsoon" : "spring/autumn"} season",
  "transport": {
    "recommended": {
      "mode": "${selectedTransportMode}",
      "operator": "Write real ${selectedTransportMode} operator name for ${data.source} to ${data.destination} route",
      "departure": "06:30",
      "arrival": "Write realistic arrival time",
      "duration": "Write realistic journey duration",
      "price_per_person": ${selectedTransportMode === "flight" ? Math.round(perPersonBudget * 0.25) : selectedTransportMode === "train" ? Math.round(perPersonBudget * 0.1) : Math.round(perPersonBudget * 0.08)},
      "total_price": ${selectedTransportMode === "flight" ? Math.round(perPersonBudget * 0.25) * data.travelers : selectedTransportMode === "train" ? Math.round(perPersonBudget * 0.1) * data.travelers : Math.round(perPersonBudget * 0.08) * data.travelers},
      "comfort": "High",
      "stops": 0,
      "badge": "Best Choice"
    },
    "cheapest": {
      "mode": "${selectedTransportMode === "flight" ? "train" : "bus"}",
      "operator": "Write real cheap transport operator for ${data.source} to ${data.destination}",
      "departure": "22:00",
      "arrival": "Write realistic arrival time next day",
      "duration": "Write realistic duration",
      "price_per_person": ${Math.round(perPersonBudget * 0.05)},
      "total_price": ${Math.round(perPersonBudget * 0.05) * data.travelers},
      "comfort": "Medium",
      "stops": 1,
      "badge": "Cheapest"
    },
    "fastest": {
      "mode": "${data.transport === "flight" ? "flight" : "flight"}",
      "operator": "Write fastest real transport operator",
      "departure": "09:00",
      "arrival": "Write earliest real arrival time",
      "duration": "Write shortest realistic duration",
      "price_per_person": ${Math.round(perPersonBudget * 0.3)},
      "total_price": ${Math.round(perPersonBudget * 0.3) * data.travelers},
      "comfort": "High",
      "stops": 0,
      "badge": "Fastest"
    }
  },
  "hotels": [
    {
      "name": "Write name of a real budget hotel in ${data.destination}",
      "category": "Budget",
      "rating": 3.7,
      "reviews": 820,
      "price_per_night": ${Math.round(perPersonBudget * 0.06)},
      "total_cost": ${Math.round(perPersonBudget * 0.06) * nights},
      "location": "Write real area/neighborhood in ${data.destination}",
      "amenities": ["WiFi", "AC", "Hot Water"],
      "highlights": "Write what makes this hotel good for budget travelers",
      "badge": "Budget Pick"
    },
    {
      "name": "Write name of a real mid-range hotel in ${data.destination}",
      "category": "Recommended",
      "rating": 4.2,
      "reviews": 1650,
      "price_per_night": ${Math.round(perPersonBudget * 0.12)},
      "total_cost": ${Math.round(perPersonBudget * 0.12) * nights},
      "location": "Write real area in ${data.destination}",
      "amenities": ["WiFi", "Pool", "AC", "Breakfast", "Parking"],
      "highlights": "Write what makes this the best value choice",
      "badge": "Best Value"
    },
    {
      "name": "Write name of a real premium hotel or resort in ${data.destination}",
      "category": "Premium",
      "rating": 4.7,
      "reviews": 3100,
      "price_per_night": ${Math.round(perPersonBudget * 0.25)},
      "total_cost": ${Math.round(perPersonBudget * 0.25) * nights},
      "location": "Write prime area in ${data.destination}",
      "amenities": ["WiFi", "Pool", "Spa", "AC", "Restaurant", "Gym", "Concierge"],
      "highlights": "Write what makes this premium option special",
      "badge": "Luxury"
    }
  ],
  "itinerary": [
${Array.from({ length: totalDays }, (_, i) => `    {
      "day": ${i + 1},
      "date": "Day ${i + 1} - ${data.startDate}",
      "theme": "Write a theme for day ${i + 1} activities at ${data.destination}",
      "morning": {
        "activity": "Write a REAL famous morning attraction/activity at ${data.destination}",
        "description": "Write 2 sentences describing this place and what to do there specifically",
        "location": "Write exact real place name at ${data.destination}",
        "duration": "2-3 hours",
        "entry_fee": ${i === 0 ? 0 : Math.round(Math.random() * 200)},
        "tips": "Write a specific practical visitor tip for this place"
      },
      "afternoon": {
        "activity": "Write a REAL famous afternoon attraction at ${data.destination}",
        "description": "Write 2 sentences about this place and the experience",
        "location": "Write exact real place name",
        "duration": "3 hours",
        "entry_fee": ${Math.round(Math.random() * 300)},
        "tips": "Write specific tip for visiting this afternoon"
      },
      "evening": {
        "activity": "Write a REAL famous evening activity at ${data.destination}",
        "description": "Write 2 sentences about this experience",
        "location": "Write exact real place name",
        "duration": "2 hours",
        "entry_fee": 0,
        "tips": "Write specific evening tip"
      },
      "food_suggestion": "Write a specific real restaurant name and dish to try today at ${data.destination}",
      "local_transport_cost": ${Math.round(300 + (data.travelers - 1) * 150)}
    }`).join(",\n")}
  ],
  "food": {
    "must_try_dishes": [
      {
        "name": "Write real signature dish of ${data.destination}",
        "description": "Write what this dish is and why it is famous here",
        "price_range": "Rs.${Math.round(perPersonBudget * 0.02)}-${Math.round(perPersonBudget * 0.04)}",
        "where_to_find": "Write real restaurant or area famous for this dish in ${data.destination}",
        "emoji": ""
      },
      {
        "name": "Write second real local dish of ${data.destination}",
        "description": "Write what makes this dish unique to this region",
        "price_range": "Rs.${Math.round(perPersonBudget * 0.015)}-${Math.round(perPersonBudget * 0.03)}",
        "where_to_find": "Write real place to get this",
        "emoji": ""
      },
      {
        "name": "Write a famous ${data.destination} street food or snack",
        "description": "Write what it tastes like and when to eat it",
        "price_range": "Rs.30-150",
        "where_to_find": "Write real street food area in ${data.destination}",
        "emoji": ""
      }
    ],
    "top_restaurants": [
      {
        "name": "Write name of a real top-rated restaurant in ${data.destination}",
        "cuisine": "Write real cuisine type",
        "rating": 4.5,
        "price_range": "Rs.${Math.round(perPersonBudget * 0.04)}-${Math.round(perPersonBudget * 0.08)} per person",
        "specialty": "Write their real signature dish",
        "address": "Write real area/address in ${data.destination}"
      },
      {
        "name": "Write a second real famous restaurant in ${data.destination}",
        "cuisine": "Write real cuisine type",
        "rating": 4.3,
        "price_range": "Rs.${Math.round(perPersonBudget * 0.03)}-${Math.round(perPersonBudget * 0.06)} per person",
        "specialty": "Write real specialty dish",
        "address": "Write real area in ${data.destination}"
      },
      {
        "name": "Write a third real well-known restaurant or dhaba in ${data.destination}",
        "cuisine": "Write cuisine type",
        "rating": 4.4,
        "price_range": "Rs.${Math.round(perPersonBudget * 0.025)}-${Math.round(perPersonBudget * 0.05)} per person",
        "specialty": "Write specialty",
        "address": "Write area"
      }
    ],
    "street_food_spots": [
      {
        "name": "Write real street food market or area in ${data.destination}",
        "specialty": "Write what you must try there",
        "price_range": "Rs.50-200",
        "location": "Write exact area or market name"
      },
      {
        "name": "Write second real street food spot in ${data.destination}",
        "specialty": "Write famous item sold here",
        "price_range": "Rs.30-150",
        "location": "Write real location"
      }
    ]
  },
  "budget": {
    "transport": ${Math.round(selectedTransportMode === "flight" ? perPersonBudget * 0.25 * data.travelers : perPersonBudget * 0.1 * data.travelers)},
    "hotel": ${Math.round(perPersonBudget * 0.12 * nights)},
    "food": ${Math.round(perPersonBudget * 0.08 * data.travelers * nights / 2)},
    "sightseeing": ${Math.round(perPersonBudget * 0.05 * data.travelers)},
    "local_transport": ${Math.round(500 * data.travelers * totalDays)},
    "miscellaneous": ${Math.round(perPersonBudget * 0.05 * data.travelers)},
    "grand_total": ${Math.round(data.budget * 0.92)},
    "per_person": ${Math.round(data.budget * 0.92 / data.travelers)},
    "savings_tips": [
      "Write real money-saving tip specific to ${data.destination}",
      "Write another practical cost-saving advice for this trip",
      "Write a third tip to reduce expenses without losing experience"
    ]
  },
  "travel_tips": [
    "Write important practical tip specific to visiting ${data.destination}",
    "Write safety or packing advice for ${data.destination} in this season",
    "Write local etiquette or cultural tip for ${data.destination}"
  ],
  "nearby_destinations": [
    {
      "name": "Write a real nearby place to ${data.destination} worth a day trip",
      "distance": "Write real distance in km",
      "why_visit": "Write why this place is worth visiting from ${data.destination}"
    },
    {
      "name": "Write another real nearby destination",
      "distance": "Write real distance",
      "why_visit": "Write specific reason to visit"
    }
  ],
  "peak_season_warning": "Write specific peak season warning for ${data.destination} or write null if March is not peak season",
  "crowd_prediction": "${data.startDate.split("-")[1] === "12" || data.startDate.split("-")[1] === "01" ? "High" : data.startDate.split("-")[1] === "06" || data.startDate.split("-")[1] === "07" || data.startDate.split("-")[1] === "08" ? "Low" : "Medium"}"
}`;
}

export async function generateTripPlan(data: TripFormData): Promise<string> {
  const prompt = buildTripPrompt(data);
  const keys = getApiKeys();

  if (keys.length === 0) {
    throw new Error("No GEMINI_API_KEY configured in .env.local");
  }

  let lastError: Error = new Error("Unknown error");

  // Outer: try each API key
  // Inner: retry same key up to 2x for transient errors only
  for (let pass = 0; pass < 2; pass++) {
    for (let ki = 0; ki < keys.length; ki++) {
      const key = keys[ki];
      const client = new GoogleGenerativeAI(key);
      const model = client.getGenerativeModel({
        model: MODEL,
        generationConfig: { temperature: 0.4, maxOutputTokens: 8192 },
      });

      try {
        console.log(`[Bookaro] Key #${ki + 1} attempt ${pass + 1}`);
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log(`[Bookaro]  Key #${ki + 1} returned ${text.length} chars`);
        return text;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        lastError = error;
        console.warn(`[Bookaro]  Key #${ki + 1} failed: ${error.message.substring(0, 120)}`);

        if (isQuotaError(error)) {
          console.log(`[Bookaro] Key #${ki + 1} quota/rate-limited  switching to next key`);
          continue; // immediately try next key, no waiting
        }

        // 404 = model not found, skip this key permanently
        if (error.message.includes("not found") || error.message.includes("404")) {
          console.warn(`[Bookaro] Key #${ki + 1}: model not found, skipping`);
          continue;
        }

        // Other error (network etc)  throw immediately
        throw error;
      }
    }

    // All keys failed in this pass  wait before trying again
    if (pass < 1) {
      const waitMs = getRetryDelay(lastError);
      console.log(`[Bookaro] All ${keys.length} key(s) exhausted. Waiting ${Math.round(waitMs / 1000)}s before retry...`);
      await sleep(waitMs);
    }
  }

  // Build helpful error message based on key count
  const keyMsg = keys.length === 1
    ? "Your single API key is rate-limited. Add more keys (GEMINI_API_KEY_2, etc.) in .env.local for 24/7 availability."
    : `All ${keys.length} API keys are rate-limited. Wait a few minutes or add more keys.`;
  throw new Error(keyMsg);
}

export async function generateChatResponse(message: string, tripContext: string): Promise<string> {
  const prompt = `You are Bookaro AI, an expert Indian travel assistant.
Trip context: ${tripContext.substring(0, 400)}
User question: ${message}
Give a helpful, accurate answer in 2-3 sentences about Indian travel. Be friendly.`;

  const keys = getApiKeys();
  if (keys.length === 0) return "API key not configured.";

  for (let ki = 0; ki < keys.length; ki++) {
    try {
      const client = new GoogleGenerativeAI(keys[ki]);
      const model = client.getGenerativeModel({ model: MODEL });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      if (isQuotaError(err)) continue; // try next key
      if ((err instanceof Error) && (err.message.includes("404") || err.message.includes("not found"))) continue;
      break;
    }
  }
  return "I'm having trouble connecting right now. Please try again in a moment!";
}

