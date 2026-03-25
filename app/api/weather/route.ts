import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

interface WttrHourly {
  tempC: string;
  precipMM: string;
  weatherDesc: { value: string }[];
}

interface WttrDay {
  date: string;
  avgtempC: string;
  totalSnow_cm: string;
  astronomy: { sunrise: string; sunset: string }[];
  hourly: WttrHourly[];
}

interface WttrCurrentCondition {
  temp_C: string;
  FeelsLikeC: string;
  humidity: string;
  windspeedKmph: string;
  winddir16Point: string;
  weatherDesc: { value: string }[];
  visibility: string;
  uvIndex: string;
}

interface WttrResponse {
  current_condition?: WttrCurrentCondition[];
  nearest_area?: { areaName: { value: string }[]; country: { value: string }[] }[];
  weather?: WttrDay[];
}

interface OpenWeatherResponse {
  weather?: Array<{ description?: string }>;
  main?: {
    temp?: number;
    feels_like?: number;
    humidity?: number;
  };
  wind?: {
    speed?: number;
    deg?: number;
  };
  visibility?: number;
  name?: string;
}

function windDirectionFromDegrees(deg?: number): string {
  const degrees = Number(deg ?? 0);
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
}

async function fetchOpenWeather(city: string) {
  const apiKey = process.env.OPENWEATHER_API_KEY?.trim();
  if (!apiKey) return null;

  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("q", `${city},IN`);
  url.searchParams.set("units", "metric");
  url.searchParams.set("appid", apiKey);

  const res = await fetch(url.toString(), { next: { revalidate: 900 } });
  if (!res.ok) return null;

  const data = (await res.json()) as OpenWeatherResponse;
  const temp = Number(data.main?.temp);
  const feels = Number(data.main?.feels_like);
  const humidity = Number(data.main?.humidity);
  const windMps = Number(data.wind?.speed ?? 0);
  const visibilityMeters = Number(data.visibility ?? 0);

  if (!Number.isFinite(temp) || !Number.isFinite(feels) || !Number.isFinite(humidity)) {
    return null;
  }

  return {
    city: data.name || city,
    country: "India",
    temp_c: Math.round(temp),
    feels_like_c: Math.round(feels),
    humidity: Math.max(0, humidity),
    wind_kmph: Math.round(windMps * 3.6),
    wind_dir: windDirectionFromDegrees(data.wind?.deg),
    description: data.weather?.[0]?.description || "Clear",
    visibility_km: visibilityMeters > 0 ? Math.round(visibilityMeters / 1000) : 10,
    uv_index: 0,
    forecast: [],
  };
}

function looksInvalidWeather(payload: {
  temp_c: number;
  feels_like_c: number;
  humidity: number;
  wind_kmph: number;
  description: string;
}) {
  return (
    payload.temp_c === 0 &&
    payload.feels_like_c === 0 &&
    payload.humidity === 0 &&
    payload.wind_kmph === 0 &&
    (!payload.description || payload.description.toLowerCase() === "clear")
  );
}

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get("city");
  if (!city) return NextResponse.json({ error: "city required" }, { status: 400 });

  try {
    const openWeather = await fetchOpenWeather(city);
    if (openWeather) {
      return NextResponse.json(openWeather);
    }

    const res = await fetch(
      `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
      { headers: { "User-Agent": "Bookaro-Travel-App/1.0" }, next: { revalidate: 900 } }
    );
    if (!res.ok) throw new Error(`wttr.in returned ${res.status}`);
    const data: WttrResponse = await res.json();

    const current = data.current_condition?.[0];
    const area = data.nearest_area?.[0];
    const weather3day = data.weather?.slice(0, 3) ?? [];

    const payload = {
      city: area?.areaName?.[0]?.value ?? city,
      country: area?.country?.[0]?.value ?? "India",
      temp_c: Number(current?.temp_C ?? 0),
      feels_like_c: Number(current?.FeelsLikeC ?? 0),
      humidity: Number(current?.humidity ?? 0),
      wind_kmph: Number(current?.windspeedKmph ?? 0),
      wind_dir: current?.winddir16Point ?? "N",
      description: current?.weatherDesc?.[0]?.value ?? "Clear",
      visibility_km: Number(current?.visibility ?? 10),
      uv_index: Number(current?.uvIndex ?? 0),
      forecast: weather3day.map((day) => ({
        date: day.date,
        max_c: Number(day.hourly?.[4]?.tempC ?? 0),
        min_c: Number(day.hourly?.[0]?.tempC ?? 0),
        avg_c: Number(day.avgtempC ?? 0),
        desc: day.hourly?.[4]?.weatherDesc?.[0]?.value ?? "Clear",
        rain_mm: Number(day.hourly?.[4]?.precipMM ?? 0),
        sunrise: day.astronomy?.[0]?.sunrise ?? "06:00 AM",
        sunset: day.astronomy?.[0]?.sunset ?? "06:30 PM",
      })),
    };

    if (looksInvalidWeather(payload)) {
      return NextResponse.json({ error: "Weather data unavailable" }, { status: 503 });
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[Weather API]", err);
    return NextResponse.json({ error: "Weather data unavailable" }, { status: 503 });
  }
}
