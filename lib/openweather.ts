export interface OpenWeatherContext {
  summary: string;
  tempC: number;
  feelsLikeC: number;
  humidity: number;
}

interface OpenWeatherCurrentResponse {
  weather?: Array<{ description?: string }>;
  main?: {
    temp?: number;
    feels_like?: number;
    humidity?: number;
  };
}

function hasOpenWeather(): boolean {
  return Boolean(process.env.OPENWEATHER_API_KEY && process.env.OPENWEATHER_API_KEY.trim());
}

export async function getOpenWeatherContext(city: string): Promise<OpenWeatherContext | null> {
  if (!hasOpenWeather()) return null;

  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.set("q", `${city},IN`);
  url.searchParams.set("units", "metric");
  url.searchParams.set("appid", process.env.OPENWEATHER_API_KEY || "");

  const res = await fetch(url.toString(), { next: { revalidate: 900 } });
  if (!res.ok) return null;

  const data = (await res.json()) as OpenWeatherCurrentResponse;
  const description = data.weather?.[0]?.description || "clear sky";
  const temp = Number(data.main?.temp ?? 0);
  const feels = Number(data.main?.feels_like ?? temp);
  const humidity = Number(data.main?.humidity ?? 0);

  return {
    summary: `${description}, ${Math.round(temp)}°C (feels like ${Math.round(feels)}°C), humidity ${humidity}%`,
    tempC: temp,
    feelsLikeC: feels,
    humidity,
  };
}
