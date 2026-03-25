"use client";
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plane, Train, Bus, Car, Star, MapPin, Clock, Wifi, Dumbbell, Coffee,
  Waves, Sparkles, ArrowLeft, Wallet, Utensils, Ticket, Navigation, Package,
  Sunrise, SunMedium, MoonStar,
  ExternalLink, Hotel, ShoppingBag
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import ChatAssistant from "@/components/ChatAssistant";

interface TimeSlot {
  activity: string;
  description: string;
  location: string;
  map_url?: string;
  duration: string;
  entry_fee: number;
  tips: string;
}

interface DayPlan {
  day: number;
  date: string;
  theme: string;
  morning: TimeSlot;
  afternoon: TimeSlot;
  evening: TimeSlot;
  food_suggestion: string;
  local_transport_cost: number;
}

interface TransportOption {
  mode: string;
  operator: string;
  departure: string;
  arrival: string;
  duration: string;
  price_per_person: number;
  total_price: number;
  comfort: string;
  stops: number;
  badge: string;
  notes?: string;
}

interface HotelOption {
  name: string;
  category: string;
  rating: number;
  reviews: number;
  price_per_night: number;
  total_cost: number;
  location: string;
  amenities: string[];
  highlights: string;
  badge: string;
}

interface Dish {
  name: string;
  description: string;
  price_range: string;
  where_to_find: string;
  emoji: string;
}

interface Restaurant {
  name: string;
  cuisine: string;
  rating: number;
  price_range: string;
  specialty: string;
  address: string;
}

interface StreetFood {
  name: string;
  specialty: string;
  price_range: string;
  location: string;
}

interface Budget {
  transport: number;
  hotel: number;
  food: number;
  sightseeing: number;
  local_transport: number;
  miscellaneous: number;
  grand_total: number;
  per_person: number;
  savings_tips: string[];
}

interface TripPlan {
  summary: string;
  destination_overview: string;
  best_time_to_visit: string;
  weather: string;
  transport: {
    recommended: TransportOption;
    bus: TransportOption;
    train: TransportOption;
    flight: TransportOption;
  };
  hotels: HotelOption[];
  itinerary: DayPlan[];
  food: {
    must_try_dishes: Dish[];
    top_restaurants: Restaurant[];
    street_food_spots: StreetFood[];
  };
  budget: Budget;
  travel_tips: string[];
  nearby_destinations: { name: string; distance: string; why_visit: string }[];
  peak_season_warning: string;
  crowd_prediction: string;
}

type TransportSlot = "recommended" | "bus" | "train" | "flight";

const TRANSPORT_ICONS: Record<string, React.ReactNode> = {
  flight: <Plane size={18} />,
  train: <Train size={18} />,
  bus: <Bus size={18} />,
  car: <Car size={18} />,
};

const BUDGET_COLORS = ["#f4a261", "#e76f51", "#7bd1c8", "#ffd166", "#5ec2b7", "#64748b"];

function amenityIcon(a: string) {
  const lower = a.toLowerCase();
  if (lower.includes("wifi")) return <Wifi size={12} />;
  if (lower.includes("pool") || lower.includes("swim")) return <Waves size={12} />;
  if (lower.includes("gym") || lower.includes("fitness")) return <Dumbbell size={12} />;
  if (lower.includes("breakfast") || lower.includes("restaurant")) return <Coffee size={12} />;
  return null;
}

//  BOOKING URL BUILDERS 

function toRedBusDate(dateStr: string): string {
  // Convert "2026-02-27"  "27-Feb-2026"
  if (!dateStr) return "";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [y, m, d] = dateStr.split("-");
  return `${d}-${months[parseInt(m) - 1]}-${y}`;
}

function citySlug(city: string): string {
  return city.toLowerCase().trim().replace(/\s+/g, "-");
}

function sanitizeCity(city: string): string {
  return String(city || "").replace(/\s+/g, " ").trim();
}

function extractRouteFromSummary(summary: string): { source: string; destination: string } {
  const raw = String(summary || "");
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return { source: "", destination: "" };

  const patterns = [
    /from\s+(.+?)\s+to\s+(.+?)(?:\s+for|\s+trip|\s+with|[.,]|$)/i,
    /(.+?)\s+to\s+(.+?)(?:\s+trip|\s+for|\s+with|[.,]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1] && match?.[2]) {
      return { source: sanitizeCity(match[1]), destination: sanitizeCity(match[2]) };
    }
  }
  return { source: "", destination: "" };
}

function iataFromCity(city: string): string {
  const key = city.toLowerCase().replace(/[^a-z]/g, "");
  const map: Record<string, string> = {
    delhi: "DEL",
    newdelhi: "DEL",
    mumbai: "BOM",
    bangalore: "BLR",
    bengaluru: "BLR",
    chennai: "MAA",
    kolkata: "CCU",
    hyderabad: "HYD",
    kochi: "COK",
    cochin: "COK",
    jaipur: "JAI",
    goa: "GOI",
    pune: "PNQ",
    ahmedabad: "AMD",
    varanasi: "VNS",
    madurai: "IXM",
    coimbatore: "CJB",
    mysore: "MYQ",
    mysuru: "MYQ",
    udaipur: "UDR",
    leh: "IXL",
  };
  return map[key] || city.toUpperCase().slice(0, 3);
}

function buildTransportBookingLinks(
  mode: string,
  source: string,
  destination: string,
  startDate: string,
  travelers: number
): { label: string; url: string; color: string }[] {
  const links: { label: string; url: string; color: string }[] = [];
  const src = sanitizeCity(source);
  const dest = sanitizeCity(destination);
  if (!src || !dest) return links;
  const srcSlug = citySlug(source);
  const destSlug = citySlug(destination);
  void startDate;
  void travelers;

  if (mode === "flight") {
    const srcCode = iataFromCity(source);
    const destCode = iataFromCity(destination);
    links.push({
      label: "Booking.com",
      url: `https://www.booking.com/flights/${srcCode}-${destCode}/`,
      color: "#003580",
    });
  } else if (mode === "train") {
    links.push({
      label: "redRail",
      url: `https://www.redbus.in/railways?fromCityName=${encodeURIComponent(src)}&toCityName=${encodeURIComponent(dest)}&doj=${encodeURIComponent(startDate)}`,
      color: "#dc2626",
    });
  } else if (mode === "bus") {
    const rbDate = toRedBusDate(startDate);
    links.push({
      label: "redBus",
      url: `https://www.redbus.in/bus-tickets/${srcSlug}-to-${destSlug}?onward=${encodeURIComponent(rbDate)}`,
      color: "#dc2626",
    });
  } else if (mode === "car") {
    links.push({
      label: "Savaari",
      url: "https://www.savaari.com/",
      color: "#ea580c",
    });
    links.push({
      label: "Zoomcar",
      url: "https://www.zoomcar.com/",
      color: "#16a34a",
    });
    links.push({
      label: "Ola",
      url: `https://www.olacabs.com/outstation`,
      color: "#15803d",
    });
  }

  return links;
}

function buildGoogleRouteLink(source: string, destination: string, mode: string): string {
  const travelmode =
    mode === "car" ? "driving" :
    mode === "bus" ? "transit" :
    mode === "train" ? "transit" :
    mode === "flight" ? "transit" :
    "transit";
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(source)}&destination=${encodeURIComponent(destination)}&travelmode=${travelmode}`;
}

function isPlaceholderTime(value: string): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    !normalized ||
    normalized === "--:--" ||
    normalized === "n/a" ||
    normalized === "na" ||
    normalized === "tbd"
  );
}

function cleanTransportNotes(notes?: string, mode?: string): string {
  const raw = String(notes || "").trim();
  if (!raw) return "";
  const normalizedMode = String(mode || "").toLowerCase();
  const withoutPrefix = raw.replace(/^Route API:\s*/i, "").trim();
  if (normalizedMode === "car" || normalizedMode === "bus") {
    return withoutPrefix.replace(/\s*\|\s*/g, " | ").trim();
  }
  return withoutPrefix
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function durationTextToMinutes(value: string): number | null {
  const s = String(value || "").toLowerCase().trim();
  if (!s) return null;
  if (s.includes("as per") || s.includes("depends") || s === "n/a") return null;

  const hourDecimal = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const minutePart = s.match(/(\d+)\s*m/);
  const h = hourDecimal ? Number(hourDecimal[1]) : 0;
  const m = minutePart ? Number(minutePart[1]) : 0;
  const total = Math.round(h * 60 + m);
  return total > 0 ? total : null;
}

function normalizeTransportCards(transport: TripPlan["transport"]): Record<TransportSlot, TransportOption> {
  return {
    recommended: { ...transport.recommended, badge: "Recommended" },
    bus: { ...transport.bus, badge: "Bus" },
    train: { ...transport.train, badge: "Train" },
    flight: { ...transport.flight, badge: "Flight" },
  };
}

function buildHotelBookingLinks(
  hotelName: string,
  destination: string,
  startDate: string,
  endDate: string,
  travelers: number
): { label: string; url: string; color: string }[] {
  void hotelName;
  const checkin = startDate || "";
  const checkout = endDate || "";
  const guests = travelers || 2;

  if (!sanitizeCity(destination)) return [];
  return [{
    label: "Booking.com",
    url: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}&checkin=${checkin}&checkout=${checkout}&group_adults=${guests}&no_rooms=1&group_children=0`,
    color: "#003580",
  }];
}

//  BOOKING BUTTONS COMPONENT 

function BookingButtons({ links }: { links: { label: string; url: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/05">
      <span className="text-xs text-white/30 w-full mb-1 flex items-center gap-1">
        <ExternalLink size={10} /> Book instantly on:
      </span>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg"
          style={{ backgroundColor: link.color + "22", border: `1px solid ${link.color}44`, color: link.color }}
        >
          {link.label} <ExternalLink size={9} />
        </a>
      ))}
    </div>
  );
}

//  TRANSPORT CARD 

function TransportCard({
  title,
  option,
  highlight,
  source,
  destination,
  startDate,
  travelers,
}: {
  title: string;
  option: TransportOption;
  highlight?: boolean;
  source: string;
  destination: string;
  startDate: string;
  travelers: number;
}) {
  const badgeClass =
    option.badge.toLowerCase().includes("bus") ? "badge-cheapest" :
    option.badge.toLowerCase().includes("train") ? "badge-fastest" :
    option.badge.toLowerCase().includes("flight") ? "badge-fastest" : "badge-recommended";

  const bookingLinks = buildTransportBookingLinks(option.mode, source, destination, startDate, travelers);
  const mapsLink = buildGoogleRouteLink(source, destination, option.mode);
  const depText = isPlaceholderTime(option.departure) ? (source || "Check provider") : option.departure;
  const arrText = isPlaceholderTime(option.arrival) ? (destination || "Check provider") : option.arrival;
  const depLabel = isPlaceholderTime(option.departure) ? "Origin" : "Departure";
  const arrLabel = isPlaceholderTime(option.arrival) ? "Destination" : "Arrival";
  const hasPrice = option.total_price > 0 || option.price_per_person > 0;
  const cleanedNotes = cleanTransportNotes(option.notes, option.mode);

  return (
    <motion.div
      className={`form-shell p-5 ${highlight ? "border-[#f2a65a]/30 shadow-lg shadow-orange-500/10" : ""}`}
      whileHover={{ y: -3 }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2 text-white font-semibold capitalize">
          {TRANSPORT_ICONS[option.mode] || <Plane size={18} />}
          {title}
        </div>
        {option.badge ? <span className={`badge ${badgeClass}`}>{option.badge}</span> : null}
      </div>
      <div className="mb-3 text-sm text-white/45">{option.operator}</div>
      <div className="flex items-center gap-4 mb-4">
        <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
          <div className="text-xl font-bold text-white">{depText}</div>
          <div className="text-xs text-white/40">{depLabel}</div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-xs text-white/30 mb-1">{option.duration}</div>
          <div className="h-px bg-gradient-to-r from-transparent via-[#f2a65a] to-transparent" />
          <div className="text-xs text-white/30 mt-1">{option.stops === 0 ? "Non-stop" : `${option.stops} stop`}</div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
          <div className="text-xl font-bold text-white">{arrText}</div>
          <div className="text-xs text-white/40">{arrLabel}</div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div>
          {hasPrice ? (
            <>
              <span className="text-2xl font-bold gradient-text">{option.total_price.toLocaleString()}</span>
              <span className="text-xs text-white/40 ml-1">total  {option.price_per_person.toLocaleString()}/person</span>
            </>
          ) : (
            <span className="text-sm font-semibold text-amber-300">Live fare available on provider site</span>
          )}
        </div>
        <span className="text-xs text-white/40">{option.comfort} comfort</span>
      </div>
      {cleanedNotes && (
        <div className="mt-3 whitespace-pre-line rounded-xl border border-[#f2a65a]/15 bg-[#f2a65a]/10 p-3 text-xs text-orange-100/90">
          {cleanedNotes}
        </div>
      )}
      <a
        href={mapsLink}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-xs text-white/60 transition-colors hover:text-[#7bd1c8]"
      >
        <Navigation size={11} /> View route in Google Maps
      </a>
      <BookingButtons links={bookingLinks} />
    </motion.div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={13}
          fill={star <= Math.round(rating) ? "currentColor" : "none"}
          className={star <= Math.round(rating) ? "text-yellow-400" : "text-white/20"}
        />
      ))}
      <span className="text-sm text-white/60 ml-1">{rating}</span>
    </div>
  );
}

//  MAIN RESULTS PAGE 

interface WeatherData {
  city: string;
  temp_c: number;
  feels_like_c: number;
  humidity: number;
  wind_kmph: number;
  wind_dir: string;
  description: string;
  visibility_km: number;
  uv_index: number;
  forecast: { date: string; max_c: number; min_c: number; avg_c: number; desc: string; rain_mm: number; sunrise: string; sunset: string }[];
}

export default function ResultsPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [form, setForm] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);

  const fetchWeather = useCallback(async (city: string) => {
    if (!city?.trim()) return;
    setWeatherLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(city)}`, { signal: controller.signal });
      if (!res.ok) throw new Error("Weather unavailable");
      setWeather(await res.json());
    } catch {
      // Weather widget is optional; keep page clean if provider is unavailable.
    } finally {
      clearTimeout(timeout);
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadResult = async () => {
      try {
        const sessionRes = await fetch("/api/auth/me", { cache: "no-store" });
        if (!sessionRes.ok) {
          router.replace("/login");
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const planId = params.get("id") || localStorage.getItem("activePlanId");

        if (planId) {
          const savedRes = await fetch(`/api/plans/${planId}`, { cache: "no-store" });
          if (savedRes.ok) {
            const savedData = await savedRes.json();
            if (!active) return;
            setPlan(savedData.plan);
            setForm(savedData.form);
            if (savedData?.form?.destination) fetchWeather(savedData.form.destination);
            setAuthChecking(false);
            return;
          }
        }

        const stored = localStorage.getItem("tripPlan");
        const storedForm = localStorage.getItem("tripForm");
        if (!stored) {
          router.replace("/plan");
          return;
        }
        if (!active) return;
        const parsedPlan = JSON.parse(stored);
        setPlan(parsedPlan);
        if (storedForm) {
          const parsedForm = JSON.parse(storedForm);
          setForm(parsedForm);
          if (parsedForm.destination) fetchWeather(parsedForm.destination);
        }
      } finally {
        if (active) setAuthChecking(false);
      }
    };

    loadResult();

    return () => {
      active = false;
    };
  }, [router, fetchWeather]);

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-2 border-[#f4a261] border-t-transparent spinner" />
          <p className="text-white/40">Loading your saved plan...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-2 border-[#f4a261] border-t-transparent spinner" />
          <p className="text-white/40">Loading your trip plan...</p>
        </div>
      </div>
    );
  }

  const summaryRoute = extractRouteFromSummary(plan.summary);
  const source = sanitizeCity(String(form?.source ?? summaryRoute.source ?? ""));
  const destination = sanitizeCity(String(form?.destination ?? summaryRoute.destination ?? ""));
  const startDate = String(form?.startDate ?? "");
  const endDate = String(form?.endDate ?? "");
  const travelers = Number(form?.travelers ?? 2);
  const transportCards = normalizeTransportCards(plan.transport);

  const budgetData = [
    { name: "Transport", value: plan.budget.transport },
    { name: "Hotel", value: plan.budget.hotel },
    { name: "Food", value: plan.budget.food },
    { name: "Sightseeing", value: plan.budget.sightseeing },
    { name: "Local Transport", value: plan.budget.local_transport },
    { name: "Miscellaneous", value: plan.budget.miscellaneous },
  ];

  const TABS = [
    { id: "overview", label: "Overview", icon: <Sparkles size={14} /> },
    { id: "transport", label: "Transport", icon: <Plane size={14} /> },
    { id: "hotels", label: "Hotels", icon: <MapPin size={14} /> },
    { id: "itinerary", label: "Itinerary", icon: <Clock size={14} /> },
    { id: "food", label: "Food", icon: <Utensils size={14} /> },
    { id: "budget", label: "Budget", icon: <Wallet size={14} /> },
  ];

  return (
    <div className="min-h-screen pb-24">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-[#f2a65a]/12 blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[420px] h-[420px] rounded-full bg-cyan-500/10 blur-[110px]" />
        <div className="absolute left-[12%] top-[18%] h-24 w-24 rounded-full bg-white/6 blur-2xl float-animation" />
      </div>

      {/* Top nav */}
      <div className="sticky top-0 z-30 border-b border-white/5 bg-[#04111f]/88 px-6 py-4 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/plan" className="flex items-center gap-1.5 text-white/55 hover:text-white transition-colors text-sm">
              <ArrowLeft size={15} /> Modify Trip
            </Link>
            <div className="w-px h-4 bg-white/10" />
            <div className="text-white font-semibold text-sm">
              {source} to {destination}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge ${plan.crowd_prediction === "Low" ? "badge-cheapest" : plan.crowd_prediction === "High" ? "badge-recommended" : "badge-fastest"}`}>
              {plan.crowd_prediction} crowd
            </span>
          </div>
        </div>
      </div>

      {/* Tab nav */}
      <div className="sticky top-[65px] z-20 border-b border-white/5 bg-[#04111f]/82 px-6 py-3 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id ? "tab-active shadow-lg shadow-orange-500/15" : "text-white/45 hover:text-white hover:bg-white/05"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-8 relative z-10">

        {/*  OVERVIEW TAB  */}
        {activeTab === "overview" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="aurora-panel form-shell p-8 md:p-10 overflow-hidden">
              <div className="relative z-10">
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-[#f7d08a]/75">Trip Output</div>
                    <h1 className="font-poppins font-bold text-3xl md:text-4xl text-white mt-2">
                      Your {destination} plan is ready
                    </h1>
                    <p className="mt-3 max-w-3xl text-white/60 leading-relaxed">{plan.summary}</p>
                  </div>
                  <div className="rounded-[24px] border border-[#f2a65a]/20 bg-[#f2a65a]/10 px-4 py-3 text-right">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#f7d08a]/80">Target Budget</div>
                    <div className="mt-1 text-2xl font-bold text-white">INR {plan.budget.grand_total.toLocaleString()}</div>
                    <div className="text-xs text-white/50">final provider prices may vary</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                {[
                  { label: "Destination", value: plan.destination_overview.slice(0, 90) + "..." },
                  { label: "Weather", value: plan.weather },
                  { label: "Best Time", value: plan.best_time_to_visit },
                  { label: "Crowd Level", value: plan.crowd_prediction },
                ].map((s) => (
                  <div key={s.label} className="rounded-[22px] border border-white/8 bg-white/4 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-white/35 mb-1">{s.label}</div>
                    <div className="text-sm font-medium text-white leading-6">{s.value}</div>
                  </div>
                ))}
              </div>
              {plan.peak_season_warning && plan.peak_season_warning !== "null" && (
                <div className="mt-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex items-start gap-2">
                  <span>Season note:</span> {plan.peak_season_warning}
                </div>
              )}
              <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs">
                Trust note: this output is a planning view built from itinerary logic, weather data, and booking links. Exact prices and hotel/transport availability can change at checkout.
              </div>
            </div>
            </div>

            {/* LIVE WEATHER WIDGET */}
            {weatherLoading && (
              <div className="glass-card p-6 flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-[#f2a65a] border-t-transparent rounded-full spinner" />
                <span className="text-white/40 text-sm">Fetching live weather for {destination}...</span>
              </div>
            )}
            {weather && !weatherLoading && (
              <div className="form-shell p-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                   Live Weather  {weather.city}
                  <span className="text-xs text-white/30 font-normal ml-auto">real-time conditions</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="rounded-[22px] border border-white/8 bg-white/4 p-4 text-center">
                    <div className="text-3xl font-bold text-white">{weather.temp_c}C</div>
                    <div className="text-xs text-white/40 mt-1">{weather.description}</div>
                    <div className="text-xs text-white/30">Feels {weather.feels_like_c}C</div>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-white/4 p-4 text-center">
                    <div className="text-xl font-bold text-blue-400">{weather.humidity}%</div>
                    <div className="text-xs text-white/40 mt-1">Humidity</div>
                    <div className="text-xs text-white/30">Vis: {weather.visibility_km}km</div>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-white/4 p-4 text-center">
                    <div className="text-xl font-bold text-cyan-400">{weather.wind_kmph} km/h</div>
                    <div className="text-xs text-white/40 mt-1">Wind {weather.wind_dir}</div>
                    <div className="text-xs text-white/30">UV Index: {weather.uv_index}</div>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-white/4 p-4 text-center">
                    <div className="text-xl font-bold text-orange-400">
                      {weather.temp_c >= 35 ? " Hot" : weather.temp_c >= 25 ? " Warm" : weather.temp_c >= 15 ? " Pleasant" : " Cool"}
                    </div>
                    <div className="text-xs text-white/40 mt-1">Comfort Level</div>
                    <div className="text-xs text-white/30">
                      {weather.temp_c >= 35 ? "Carry water" : weather.temp_c >= 25 ? "Light clothes" : weather.temp_c >= 15 ? "Perfect weather" : "Pack layers"}
                    </div>
                  </div>
                </div>
                {/* 3-Day Forecast */}
                {weather.forecast.length > 0 && (
                  <div>
                    <div className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wider">3-Day Forecast</div>
                    <div className="grid grid-cols-3 gap-2">
                      {weather.forecast.map((day, i) => (
                        <div key={i} className="glass-card p-3 text-center">
                          <div className="text-xs text-white/40 mb-1">{i === 0 ? "Today" : i === 1 ? "Tomorrow" : new Date(day.date).toLocaleDateString("en-IN", { weekday: "short" })}</div>
                          <div className="text-sm font-bold text-white">{day.avg_c}C</div>
                          <div className="text-xs text-white/40">{day.max_c} / {day.min_c}</div>
                          <div className="text-xs text-white/30 mt-1 truncate">{day.desc}</div>
                          <div className="text-xs text-blue-400">{day.rain_mm > 0 ? ` ${day.rain_mm}mm` : " Dry"}</div>
                          <div className="text-xs text-white/20 mt-1"> {day.sunrise}   {day.sunset}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DESTINATION MAP */}
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-white/05 flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                   {destination} on Google Maps
                </h3>
                <a
                  href={`https://www.google.com/maps/search/${encodeURIComponent(destination + " India")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[#7bd1c8] hover:text-[#a5efe7]"
                >
                  Open in Maps <ExternalLink size={10} />
                </a>
              </div>
              <iframe
                title={`Map of ${destination}`}
                width="100%"
                height="340"
                style={{ border: 0, display: "block" }}
                loading="lazy"
                allowFullScreen
                src={`https://maps.google.com/maps?q=${encodeURIComponent(destination + " India")}&output=embed&z=10`}
              />
            </div>

            {/* Quick Book Banner */}
            <div className="glass-card border-[#f4a261]/20 p-5">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2 text-sm">
                <Ticket size={16} className="text-[#f4a261]" /> Quick Booking
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: "Flights", url: `https://www.booking.com/flights/${iataFromCity(source)}-${iataFromCity(destination)}/`, color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-300" },
                  { label: "Trains", url: `https://www.redrail.in/trains/${citySlug(source)}-to-${citySlug(destination)}`, color: "from-red-500/20 to-red-600/10 border-red-500/30 text-red-300" },
                  { label: "Buses", url: `https://www.redbus.in/search?srcCity=${encodeURIComponent(source)}&destCity=${encodeURIComponent(destination)}&onward=${encodeURIComponent(toRedBusDate(startDate))}`, color: "from-red-600/20 to-rose-600/10 border-rose-500/30 text-rose-300" },
                  { label: "Hotels", url: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}&checkin=${startDate}&checkout=${endDate}&group_adults=${travelers}`, color: "from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-300" },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border bg-gradient-to-br ${item.color} hover:scale-105 transition-transform`}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Travel Tips */}
            <div className="glass-card p-6">
              <h3 className="font-poppins font-bold text-lg text-white mb-4 flex items-center gap-2"><Sparkles size={18} className="text-[#f4a261]" /> Travel Tips</h3>
              <div className="space-y-2">
                {plan.travel_tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-white/60">
                    <span className="mt-0.5 text-[#f4a261]"></span> {tip}
                  </div>
                ))}
              </div>
            </div>

            {/* Nearby destinations */}
            {plan.nearby_destinations.length > 0 && (
              <div className="glass-card p-6">
                <h3 className="font-poppins font-bold text-lg text-white mb-4 flex items-center gap-2"><Navigation size={18} className="text-[#7bd1c8]" /> Nearby Destinations</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {plan.nearby_destinations.map((d, i) => (
                    <div key={i} className="glass-card p-4">
                      <div className="font-semibold text-white text-sm mb-1">{d.name}</div>
                      <div className="mb-1 text-xs text-[#7bd1c8]"> {d.distance}</div>
                      <div className="text-xs text-white/40">{d.why_visit}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/*  TRANSPORT TAB  */}
        {activeTab === "transport" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="section-header"><Plane size={22} className="text-[#f4a261]" /> Transport Options</h2>
              <span className="text-xs text-white/30 italic">Use provider buttons to confirm live fares and seat availability.</span>
            </div>
            <div className="grid gap-4">
              <TransportCard title="Recommended" option={transportCards.recommended} highlight source={source} destination={destination} startDate={startDate} travelers={travelers} />
              <TransportCard title="Bus" option={transportCards.bus} source={source} destination={destination} startDate={startDate} travelers={travelers} />
              <TransportCard title="Train" option={transportCards.train} source={source} destination={destination} startDate={startDate} travelers={travelers} />
              <TransportCard title="Flight" option={transportCards.flight} source={source} destination={destination} startDate={startDate} travelers={travelers} />
            </div>
          </motion.div>
        )}

        {/*  HOTELS TAB  */}
        {activeTab === "hotels" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="section-header"><Hotel size={22} className="text-[#7bd1c8]" /> Hotel Options</h2>
              <span className="text-xs text-white/30 italic">Click Book to check availability & pricing.</span>
            </div>
            <div className="grid gap-4">
              {plan.hotels.map((hotel, i) => {
                const hotelLinks = buildHotelBookingLinks(hotel.name, destination, startDate, endDate, travelers);
                return (
                  <motion.div key={i} className={`form-shell p-6 ${hotel.category === "Recommended" ? "border-[#f2a65a]/25" : ""}`} whileHover={{ y: -3 }}>
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div>
                        <h3 className="font-poppins font-bold text-xl text-white mb-1">{hotel.name}</h3>
                        <StarRating rating={hotel.rating} />
                        <p className="text-xs text-white/40 mt-1">{hotel.reviews.toLocaleString()} reviews  {hotel.location}</p>
                      </div>
                      <span className={`badge ${hotel.category === "Premium" || hotel.category === "Luxury" ? "badge-luxury" : hotel.category === "Recommended" ? "badge-recommended" : "badge-cheapest"}`}>{hotel.badge}</span>
                    </div>
                    <p className="text-white/50 text-sm mt-3">{hotel.highlights}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {hotel.amenities.map((a) => (
                        <span key={a} className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-white/05 border border-white/08 text-xs text-white/60">
                          {amenityIcon(a)} {a}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                      <div>
                        <span className="text-2xl font-bold gradient-text">{hotel.price_per_night.toLocaleString()}</span>
                        <span className="text-xs text-white/40 ml-1">/night</span>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold">{hotel.total_cost.toLocaleString()}</div>
                        <div className="text-xs text-white/40">total stay</div>
                      </div>
                    </div>
                    <BookingButtons links={hotelLinks} />
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/*  ITINERARY TAB  */}
        {activeTab === "itinerary" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <h2 className="section-header"><Clock size={22} className="text-[#f4a261]" /> Day-wise Itinerary</h2>
            <div className="space-y-6">
              {plan.itinerary.map((day) => (
                <div key={day.day} className="form-shell overflow-hidden p-0">
                  <div className="border-b border-white/6 bg-[linear-gradient(90deg,rgba(242,166,90,0.12),rgba(255,255,255,0.02))] px-6 py-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#8b5cf6] to-[#6366f1] text-lg font-bold text-white shadow-[0_18px_40px_rgba(99,102,241,0.28)]">
                          {day.day}
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.24em] text-[#f7d08a]/75">Day {day.day}</div>
                          <h3 className="mt-1 font-poppins text-xl font-bold leading-snug text-white">{day.theme}</h3>
                          <p className="mt-1 text-sm text-white/42">{day.date}</p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-sm text-white/60">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-white/35">Daily move</div>
                        <div className="mt-1 font-medium text-white">Local transport INR {day.local_transport_cost.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-6">
                    {[
                      {
                        slot: day.morning,
                        label: "Morning",
                        icon: <Sunrise size={15} />,
                        color: "from-orange-500/18 to-yellow-500/8",
                        accent: "text-orange-300",
                      },
                      {
                        slot: day.afternoon,
                        label: "Afternoon",
                        icon: <SunMedium size={15} />,
                        color: "from-sky-500/18 to-cyan-500/8",
                        accent: "text-cyan-300",
                      },
                      {
                        slot: day.evening,
                        label: "Evening",
                        icon: <MoonStar size={15} />,
                        color: "from-violet-500/18 to-indigo-500/8",
                        accent: "text-violet-300",
                      },
                    ].map(({ slot, label, color }) => slot && (
                      <div key={label} className={`overflow-hidden rounded-[24px] border border-white/6 bg-gradient-to-br ${color}`}>
                        <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_240px] md:items-start">
                          <div className="min-w-0">
                            <div className="mb-3 flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/18 text-white/80">
                                {label === "Morning" ? <Sunrise size={15} /> : label === "Afternoon" ? <SunMedium size={15} /> : <MoonStar size={15} />}
                              </div>
                              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-white/48">{label}</span>
                            </div>
                            <h4 className="break-words text-xl font-semibold leading-snug text-white">{slot.activity}</h4>
                            <p className="mt-2 break-words text-sm leading-6 text-white/58">{slot.description}</p>
                            {slot.tips && (
                              <div className="mt-4 rounded-2xl border border-white/8 bg-black/12 px-3 py-3 text-sm text-[#d8f8f3]/90">
                                {slot.tips}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 rounded-[22px] border border-white/8 bg-black/16 p-4 text-left">
                            <div className="text-[11px] uppercase tracking-[0.2em] text-white/35">Details</div>
                            <div className="mt-3 space-y-3 text-sm">
                              <div>
                                <div className="text-white/35">Location</div>
                                <div className="mt-1 break-words leading-6 text-white/72">{slot.location}</div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <div className="text-white/35">Duration</div>
                                  <div className="mt-1 font-medium text-white">{slot.duration}</div>
                                </div>
                                <div>
                                  <div className="text-white/35">Entry</div>
                                  <div className="mt-1 font-medium text-emerald-400">
                                    {slot.entry_fee > 0 ? `INR ${slot.entry_fee.toLocaleString()}` : "Free / varies"}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <a
                              href={slot.map_url || `https://www.google.com/maps/search/${encodeURIComponent(slot.location)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-4 inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 transition-colors hover:text-[#7bd1c8]"
                            >
                              <Navigation size={10} /> View on Maps
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(90deg,rgba(255,255,255,0.04),rgba(242,166,90,0.05))] px-4 py-4">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-[#f7d08a]/70">Food and movement</div>
                      <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <span className="break-words text-sm leading-6 text-white/62">{day.food_suggestion}</span>
                        <span className="shrink-0 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs text-white/55">
                          Local transport INR {day.local_transport_cost.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/*  FOOD TAB  */}
        {activeTab === "food" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h2 className="section-header"><Utensils size={22} className="text-green-400" /> Food & Restaurants</h2>

            <div className="glass-card p-6">
              <h3 className="font-semibold text-white mb-4"> Must-Try Dishes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {plan.food.must_try_dishes.map((dish, i) => (
                  <div key={i} className="glass-card p-4">
                    <div className="text-3xl mb-2">{dish.emoji}</div>
                    <div className="font-semibold text-white mb-1">{dish.name}</div>
                    <div className="text-xs text-white/45 mb-2">{dish.description}</div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-green-400">{dish.price_range}</span>
                      <span className="text-white/30"> {dish.where_to_find}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="font-semibold text-white mb-4"> Top Restaurants</h3>
              <div className="space-y-3">
                {plan.food.top_restaurants.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-white/05 last:border-0 gap-3">
                    <div className="flex-1">
                      <div className="font-semibold text-white text-sm">{r.name}</div>
                      <div className="text-xs text-white/40">{r.cuisine}  {r.address}</div>
                      <div className="mt-0.5 text-xs text-[#7bd1c8]">Specialty: {r.specialty}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <StarRating rating={r.rating} />
                      <div className="text-xs text-white/40 mt-1">{r.price_range}</div>
                      <a
                        href={`https://www.google.com/maps/search/${encodeURIComponent(r.name + " " + destination)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/50 transition-colors hover:border-[#f4a261]/30 hover:text-[#f4a261]"
                      >
                        <Navigation size={9} /> Directions
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="font-semibold text-white mb-4"> Street Food Spots</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {plan.food.street_food_spots.map((s, i) => (
                  <div key={i} className="glass-card p-3 flex items-center gap-3">
                    <div className="text-2xl"></div>
                    <div className="flex-1">
                      <div className="font-medium text-white text-sm">{s.name}</div>
                      <div className="text-xs text-white/40">{s.specialty}  {s.price_range}</div>
                      <div className="text-xs text-white/30"> {s.location}</div>
                    </div>
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(s.name + " " + destination)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/30 transition-colors hover:text-[#f4a261]"
                    >
                      <Navigation size={13} />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/*  BUDGET TAB  */}
        {activeTab === "budget" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <h2 className="section-header"><Wallet size={22} className="text-yellow-400" /> Budget Breakdown</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card p-6">
                <h3 className="font-semibold text-white mb-4">Spending Distribution</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={budgetData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                      {budgetData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={BUDGET_COLORS[index % BUDGET_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1f2937", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "white" }}
                      formatter={(value: unknown) => [`${Number(value).toLocaleString()}`, ""]}
                    />
                    <Legend formatter={(value) => <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card p-6">
                <h3 className="font-semibold text-white mb-4">Detailed Breakdown</h3>
                <div className="space-y-3">
                  {[
                    { icon: <Plane size={14} />, label: "Transport", value: plan.budget.transport },
                    { icon: <MapPin size={14} />, label: "Hotel", value: plan.budget.hotel },
                    { icon: <Utensils size={14} />, label: "Food", value: plan.budget.food },
                    { icon: <Ticket size={14} />, label: "Sightseeing", value: plan.budget.sightseeing },
                    { icon: <Navigation size={14} />, label: "Local Transport", value: plan.budget.local_transport },
                    { icon: <Package size={14} />, label: "Miscellaneous", value: plan.budget.miscellaneous },
                  ].map((item, i) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-white/60">
                        <div style={{ color: BUDGET_COLORS[i] }}>{item.icon}</div>
                        {item.label}
                      </div>
                      <span className="text-white font-medium">{item.value.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="pt-3 mt-1 border-t border-white/10 flex items-center justify-between">
                    <span className="font-bold text-white">Grand Total</span>
                    <span className="text-2xl font-bold gradient-text">{plan.budget.grand_total.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-white/40 text-right"> {plan.budget.per_person.toLocaleString()} per person</div>
                </div>
              </div>
            </div>

            {/* Book Now summary */}
            <div className="glass-card border-[#f4a261]/20 p-6">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <ShoppingBag size={18} className="text-[#f4a261]" /> Book Your Entire Trip
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <a href={`https://www.booking.com/flights/${iataFromCity(source)}-${iataFromCity(destination)}/`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all group">
                  <Plane size={20} className="text-blue-400" />
                  <div>
                    <div className="text-white font-semibold text-sm">Book Flights on Booking.com</div>
                    <div className="text-xs text-white/40">{source}  {destination}  {travelers} travelers</div>
                  </div>
                  <ExternalLink size={14} className="text-white/30 ml-auto group-hover:text-blue-400" />
                </a>
                <a href={`https://www.redrail.in/trains/${citySlug(source)}-to-${citySlug(destination)}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all group">
                  <Train size={20} className="text-red-400" />
                  <div>
                    <div className="text-white font-semibold text-sm">Book Trains on redRail</div>
                    <div className="text-xs text-white/40">{source} to {destination}</div>
                  </div>
                  <ExternalLink size={14} className="text-white/30 ml-auto group-hover:text-red-400" />
                </a>
                <a href={`https://www.redbus.in/search?srcCity=${encodeURIComponent(source)}&destCity=${encodeURIComponent(destination)}&onward=${encodeURIComponent(toRedBusDate(startDate))}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/40 transition-all group">
                  <Bus size={20} className="text-rose-400" />
                  <div>
                    <div className="text-white font-semibold text-sm">Book Buses on redBus</div>
                    <div className="text-xs text-white/40">{source} to {destination}</div>
                  </div>
                  <ExternalLink size={14} className="text-white/30 ml-auto group-hover:text-rose-400" />
                </a>
                <a href={`https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}&checkin=${startDate}&checkout=${endDate}&group_adults=${travelers}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all group">
                  <Hotel size={20} className="text-purple-400" />
                  <div>
                    <div className="text-white font-semibold text-sm">Book Hotels in {destination}</div>
                    <div className="text-xs text-white/40">{startDate} to {endDate} | {travelers} guests</div>
                  </div>
                  <ExternalLink size={14} className="text-white/30 ml-auto group-hover:text-purple-400" />
                </a>
              </div>
            </div>

            {/* Savings tips */}
            <div className="glass-card p-6">
              <h3 className="font-semibold text-white mb-4"> Budget Optimization Tips</h3>
              <div className="space-y-2">
                {plan.budget.savings_tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-white/60 py-2 border-b border-white/05 last:border-0">
                    <span className="text-green-400 font-bold">{i + 1}.</span>
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* AI Chat Floating Button */}
      <ChatAssistant tripContext={JSON.stringify({ destination, budget: plan.budget, source, startDate, endDate, travelers })} />
    </div>
  );
}

