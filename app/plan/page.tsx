"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  Calendar,
  Users,
  Wallet,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Check,
  Compass,
  MoonStar,
  BadgeIndianRupee,
} from "lucide-react";
import type { TripFormData } from "@/lib/gemini";
import { buildFallbackPlan } from "@/lib/fallback-plan";

const INTERESTS = [
  "Beaches", "Mountains", "History", "Food & Cuisine",
  "Shopping", "Temples", "Nature", "Nightlife",
  "Adventure", "Photography", "Art & Culture", "Theme Parks",
  "Wellness & Spa", "Wine & Dine", "Music & Festivals", "Water Sports",
];

const STEPS = [
  "Where to?",
  "When?",
  "Who's coming?",
  "Your Style",
  "Ready!",
];

const STEP_META = [
  {
    eyebrow: "Route Setup",
    title: "Start with a route that makes sense",
    blurb: "Enter your source and destination first. The planner uses that to shape transport, timing, and stay suggestions.",
  },
  {
    eyebrow: "Trip Timing",
    title: "Dates can change pricing sharply",
    blurb: "Long weekends, festival periods, and peak weather windows can move prices more than most users expect.",
  },
  {
    eyebrow: "People & Spend",
    title: "Travelers and Budget",
    blurb: "Set your group size and budget for the trip.",
  },
  {
    eyebrow: "Trip Style",
    title: "Tell the planner what kind of trip this is",
    blurb: "Interests help the itinerary feel destination-specific instead of giving you a generic checklist.",
  },
  {
    eyebrow: "Review",
    title: "Check the essentials before generation",
    blurb: "Better inputs mean a better plan. Final market rates still depend on live availability and booking timing.",
  },
];

type FormData = TripFormData;
type SavedPlanSummary = {
  id: number;
  title: string;
  source: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budget: number;
  createdAt: string;
};

type ResolutionHint = {
  corrected: string;
  kind: "state" | "district" | "destination";
} | null;

type MinimumBudgetHint = {
  total: number;
  perPerson: number;
} | null;

const defaultForm: FormData = {
  source: "",
  destination: "",
  startDate: "",
  endDate: "",
  travelers: 2,
  budget: 30000,
  currency: "INR",
  transport: "auto",
  hotelType: "3-star",
  food: "both",
  tripType: "friends",
  interests: [],
  mode: "budget",
};

export default function PlanPage() {
  const router = useRouter();
  const localToday = new Date();
  localToday.setMinutes(localToday.getMinutes() - localToday.getTimezoneOffset());
  const today = localToday.toISOString().split("T")[0];

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [loadingStep, setLoadingStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [savedPlans, setSavedPlans] = useState<SavedPlanSummary[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [fieldHints, setFieldHints] = useState<{ source: ResolutionHint; destination: ResolutionHint }>({
    source: null,
    destination: null,
  });
  const [minimumBudgetHint, setMinimumBudgetHint] = useState<MinimumBudgetHint>(null);
  const [minimumBudgetLoading, setMinimumBudgetLoading] = useState(false);

  const set = (key: keyof FormData, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleInterest = (interest: string) => {
    const current = form.interests;
    if (current.includes(interest)) {
      set("interests", current.filter((i) => i !== interest));
    } else {
      set("interests", [...current, interest]);
    }
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const applyLocationAutocorrect = async (key: "source" | "destination", rawValue: string) => {
    const value = rawValue.trim();
    if (value.length < 3) {
      setFieldHints((prev) => ({ ...prev, [key]: null }));
      return;
    }

    try {
      const res = await fetch(`/api/location-resolve?q=${encodeURIComponent(value)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const resolution = data?.resolution as {
        corrected?: string | null;
        kind?: "state" | "district" | "destination" | null;
        confidence?: number | null;
        changed?: boolean;
      } | undefined;

      if (resolution?.corrected && resolution.kind) {
        if (resolution.changed && Number(resolution.confidence || 0) >= 0.9) {
          setForm((prev) => ({ ...prev, [key]: resolution.corrected as FormData[typeof key] }));
          setFieldHints((prev) => ({
            ...prev,
            [key]: { corrected: resolution.corrected!, kind: resolution.kind! },
          }));
          return;
        }
      }

      setFieldHints((prev) => ({ ...prev, [key]: null }));
    } catch {
      setFieldHints((prev) => ({ ...prev, [key]: null }));
    }
  };

  useEffect(() => {
    const ready =
      form.source.trim() &&
      form.destination.trim() &&
      form.startDate &&
      form.endDate &&
      form.travelers > 0;

    if (!ready) {
      setMinimumBudgetHint(null);
      setMinimumBudgetLoading(false);
      return;
    }

    let active = true;
    setMinimumBudgetLoading(true);

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          source: form.source,
          destination: form.destination,
          startDate: form.startDate,
          endDate: form.endDate,
          travelers: String(form.travelers),
          mode: form.mode,
        });
        const res = await fetch(`/api/budget-min?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch minimum budget");
        const data = await res.json();
        if (!active) return;
        const next = data?.minimumBudget as { total?: number; perPerson?: number } | null | undefined;
        if (next?.total && next?.perPerson) {
          setMinimumBudgetHint({
            total: Number(next.total),
            perPerson: Number(next.perPerson),
          });
        } else {
          setMinimumBudgetHint(null);
        }
      } catch {
        if (active) setMinimumBudgetHint(null);
      } finally {
        if (active) setMinimumBudgetLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [form.source, form.destination, form.startDate, form.endDate, form.travelers, form.mode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const src = params.get("src")?.trim() ?? "";
    const dest = params.get("dest")?.trim() ?? "";
    if (!src && !dest) return;

    setForm((prev) => ({
      ...prev,
      source: src || prev.source,
      destination: dest || prev.destination,
    }));
  }, []);

  useEffect(() => {
    let active = true;

    const loadUserContext = async () => {
      try {
        const sessionRes = await fetch("/api/auth/me", { cache: "no-store" });
        if (!sessionRes.ok) {
          router.replace("/login");
          return;
        }

        const sessionData = await sessionRes.json();
        if (!active) return;
        setUserName(sessionData?.user?.fullName || "Traveler");

        const plansRes = await fetch("/api/plans", { cache: "no-store" });
        if (!plansRes.ok) {
          setSavedPlans([]);
          return;
        }

        const plansData = await plansRes.json();
        if (!active) return;
        setSavedPlans(plansData?.plans || []);
      } catch {
        if (active) router.replace("/login");
      } finally {
        if (active) {
          setAuthLoading(false);
          setPlansLoading(false);
        }
      }
    };

    loadUserContext();

    return () => {
      active = false;
    };
  }, [router]);

  const AI_STEPS = [
    { icon: "1", label: "Analyzing your route & preferences" },
    { icon: "2", label: "Finding best transport options" },
    { icon: "3", label: "Searching hotels & accommodation" },
    { icon: "4", label: "Building your day-wise itinerary" },
    { icon: "5", label: "Calculating budget & saving tips" },
  ];

  const handleSubmit = async () => {
    if (minimumBudgetHint && form.budget < minimumBudgetHint.total) {
      setError(
        `Increase budget to at least INR ${minimumBudgetHint.total.toLocaleString()} for this trip.`
      );
      setStep(4);
      return;
    }

    setLoading(true);
    setError("");
    setLoadingStep(0);
    setElapsed(0);

    const stepTimers = [1500, 3500, 6000, 9000, 12000];
    stepTimers.forEach((delay, i) => {
      setTimeout(() => setLoadingStep(i), delay);
    });
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);

    let completed = false;
    const finishWithPlan = async (planData: unknown) => {
      if (completed) return;
      completed = true;
      clearInterval(timer);
      let savedPlanId: number | null = null;
      try {
        const saveRes = await fetch("/api/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: planData, form }),
        });
        if (saveRes.ok) {
          const saveData = await saveRes.json();
          savedPlanId = Number(saveData?.planId || 0) || null;
          const listRes = await fetch("/api/plans", { cache: "no-store" });
          if (listRes.ok) {
            const listData = await listRes.json();
            setSavedPlans(listData?.plans || []);
          }
        }
      } catch {
        // Plan view still works from local storage even if persistence fails.
      }
      localStorage.setItem("tripPlan", JSON.stringify(planData));
      localStorage.setItem("tripForm", JSON.stringify(form));
      if (savedPlanId) {
        localStorage.setItem("activePlanId", String(savedPlanId));
      }
      setLoadingStep(5);
      setTimeout(() => router.push(savedPlanId ? `/results?id=${savedPlanId}` : "/results"), 300);
    };

    const finishWithFallback = () => {
      finishWithPlan(buildFallbackPlan(form as TripFormData));
    };

    const hardStop = setTimeout(() => {
      finishWithFallback();
    }, 90000);

    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data?.error || "Failed to generate plan";
        if (res.status === 400) {
          clearInterval(timer);
          setLoading(false);
          setError(message);
          return;
        }
        throw new Error(message);
      }
      if (!data?.plan) throw new Error("Failed to generate plan");
      finishWithPlan(data.plan);
    } catch {
      finishWithFallback();
    } finally {
      clearTimeout(hardStop);
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;
  const stepMeta = STEP_META[step];
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-2 border-[#f4a261] border-t-transparent spinner" />
          <p className="text-white/40">Checking your sign-in...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    const pct = loadingStep >= 5 ? 100 : Math.round((loadingStep / AI_STEPS.length) * 100);

    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-br from-[#07131d] via-[#091722] to-[#041019]" />
          <div className="absolute left-[-10%] top-[-20%] h-[600px] w-[600px] rounded-full bg-[#f4a261]/14 blur-[150px] pulse-glow" />
          <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-[#7bd1c8]/10 blur-[120px]" />
        </div>

        <div className="relative z-10 w-full max-w-md text-center">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#f2a65a] to-[#ea5f48] text-5xl shadow-2xl shadow-orange-500/30 animate-pulse">
            B
          </div>

          <h2 className="mb-2 font-poppins text-3xl font-bold text-white">Bookaro AI is planning...</h2>
          <p className="mb-8 text-sm text-white/40">
            {form.source} to {form.destination} | {form.travelers} traveler{form.travelers > 1 ? "s" : ""} | INR {form.budget.toLocaleString()} target budget
          </p>

          <div className="glass-card p-6 mb-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-white/50">Generating your plan</span>
              <span className="text-xs font-bold text-[#f7d08a]">{pct}%</span>
            </div>
            <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#f2a65a] to-[#ea5f48] transition-all duration-1000"
                style={{ width: `${Math.max(pct, 5)}%` }}
              />
            </div>

            <div className="space-y-3">
              {AI_STEPS.map((s, i) => (
                <div
                  key={s.label}
                  className={`flex items-center gap-3 text-sm transition-all duration-500 ${
                    i < loadingStep ? "text-green-400" : i === loadingStep ? "text-white" : "text-white/25"
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs ${
                      i < loadingStep
                        ? "border border-green-500/40 bg-green-500/20"
                        : i === loadingStep
                          ? "border border-[#f2a65a]/40 bg-[#f2a65a]/20"
                          : "border border-white/10 bg-white/5"
                    }`}
                  >
                    {i < loadingStep ? "OK" : s.icon}
                  </div>
                  <span className={i === loadingStep ? "font-medium" : ""}>{s.label}</span>
                  {i === loadingStep && (
                    <div className="ml-auto flex gap-0.5">
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#f7d08a]" style={{ animationDelay: "0ms" }} />
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#f7d08a]" style={{ animationDelay: "150ms" }} />
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#f7d08a]" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between text-xs text-white/30">
            <span>Time elapsed: {timeStr}</span>
            <span>AI planning typically takes 30-90s</span>
          </div>

          <div className="glass-card p-3 text-xs italic text-white/40">
            Tip: {[
              "Booking trains early improves availability more than small budget changes.",
              "Peak-season hotel prices can jump faster than transport prices.",
              "A solo traveler can often stretch the same target budget further than a group.",
              "Destination weather windows matter as much as hotel star category.",
            ][loadingStep % 4]}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen px-4 py-12">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute right-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[#f4a261]/14 blur-[100px] pulse-glow" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[400px] w-[400px] rounded-full bg-[#7bd1c8]/10 blur-[100px]" />
        <div className="floating-orb left-[12%] top-[18%] h-24 w-24 bg-[#f2a65a]/25 float-animation" />
        <div className="floating-orb right-[18%] top-[28%] h-20 w-20 bg-cyan-400/20 float-animation-delay" />
      </div>

      <div className="fixed left-0 right-0 top-0 z-20 flex items-center justify-between border-b border-white/5 bg-gray-950/80 px-6 py-4 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#f2a65a] to-[#ea5f48] text-sm">B</div>
          <span className="font-poppins font-bold text-white">Bookaro</span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-3 text-sm text-white/40 sm:flex">
            <span>Step {step + 1} of {STEPS.length}</span>
            <div className="w-32 progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <button
            onClick={async () => {
              try { await fetch("/api/auth/signout", { method: "POST" }); } finally { router.push("/login"); }
            }}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>


      <div className="relative z-10 mx-auto mt-20 grid w-full max-w-6xl gap-8 lg:grid-cols-[0.78fr_1.22fr]">
        <motion.aside
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          className="aurora-panel tilt-card form-shell p-6 lg:sticky lg:top-24 lg:h-fit"
        >
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#f2a65a]/20 bg-[#f2a65a]/10 px-3 py-1 text-xs text-[#f7d08a]">
              <Compass size={12} /> Smarter Trip Setup
            </div>
            <h1 className="mt-4 font-poppins text-3xl font-bold text-white">Plan with better inputs</h1>
            <p className="mt-3 text-sm leading-6 text-white/60">
              Signed in as {userName}. Exact totals depend on season, booking window, transport choice, and room type. This form now treats budget as a planning target instead of a guaranteed outcome.
            </p>

            <div className="mt-6 space-y-3">
              {[
                { icon: <BadgeIndianRupee size={14} />, label: "Budget note", value: "Use a target, not a fixed expectation" },
                { icon: <Calendar size={14} />, label: "Seasonality", value: "Holidays and weather windows affect rates" },
                { icon: <MoonStar size={14} />, label: "Trip quality", value: "Interests improve itinerary quality" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <span className="text-[#f7d08a]">{item.icon}</span> {item.label}
                  </div>
                  <div className="mt-1 text-sm text-white/55">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[24px] border border-white/8 bg-black/18 p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-[#f7d08a]/75">{stepMeta.eyebrow}</div>
              <h2 className="mt-2 font-poppins text-2xl font-semibold text-white">{stepMeta.title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/58">{stepMeta.blurb}</p>
            </div>

            <div className="mt-6">
              <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/35">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="space-y-3">
                {STEPS.map((s, i) => (
                  <div
                    key={s}
                    className={`rounded-2xl border px-4 py-3 transition-all ${
                      i === step
                        ? "border-[#f2a65a]/40 bg-[#f2a65a]/10"
                        : i < step
                          ? "border-emerald-400/25 bg-emerald-400/10"
                          : "border-white/8 bg-white/4"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${
                          i === step
                            ? "bg-gradient-to-br from-[#f2a65a] to-[#ea5f48] text-white"
                            : i < step
                              ? "bg-emerald-500 text-white"
                              : "bg-white/10 text-white/35"
                        }`}
                      >
                        {i < step ? <Check size={14} /> : i + 1}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{s}</div>
                        <div className="text-xs text-white/45">{STEP_META[i].eyebrow}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-white/8 bg-black/18 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-[#f7d08a]/75">My Planning</div>
                  <h2 className="mt-2 font-poppins text-2xl font-semibold text-white">Saved trips</h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/55">
                  {plansLoading ? "Loading" : `${savedPlans.length} trip${savedPlans.length === 1 ? "" : "s"}`}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {savedPlans.slice(0, 4).map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => router.push(`/results?id=${plan.id}`)}
                    className="w-full rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-left transition-all hover:border-[#f2a65a]/30 hover:bg-white/6"
                  >
                    <div className="text-sm font-medium text-white">{plan.title}</div>
                    <div className="mt-1 text-xs text-white/40">
                      {plan.startDate} to {plan.endDate} | {plan.travelers} traveler{plan.travelers > 1 ? "s" : ""}
                    </div>
                    <div className="mt-2 text-xs text-[#7bd1c8]">Budget INR {plan.budget.toLocaleString()}</div>
                  </button>
                ))}

                {!plansLoading && savedPlans.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-white/40">
                    Your saved plans will appear here after you generate your first trip.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </motion.aside>

        <div className="relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30, rotateY: -6 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: -30, rotateY: 6 }}
              transition={{ duration: 0.35 }}
              className="aurora-panel tilt-card form-shell p-8 md:p-10"
            >
              <div className="relative z-10">
                <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-[#f7d08a]/70">Step {step + 1} of {STEPS.length}</div>
                    <div className="mt-2 font-poppins text-3xl font-bold text-white">{stepMeta.title}</div>
                  </div>
                  <div className="min-w-[180px]">
                    <div className="mb-2 flex items-center justify-between text-xs text-white/45">
                      <span>Journey builder</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>

                {step === 0 && (
                  <div>
                    <p className="mb-6 text-sm text-white/50">Tell us your departure and destination.</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="glass-input-wrap">
                        <label className="form-label"><MapPin size={13} className="mr-1 inline" /> From</label>
                        <input
                          className="form-input"
                          placeholder="e.g. Mumbai, Delhi, Bangalore"
                          value={form.source}
                          onChange={(e) => {
                            set("source", e.target.value);
                            setFieldHints((prev) => ({ ...prev, source: null }));
                          }}
                          onBlur={(e) => applyLocationAutocorrect("source", e.target.value)}
                        />
                        {fieldHints.source ? (
                          <p className="mt-2 text-xs text-[#7bd1c8]">
                            Autocorrected to {fieldHints.source.corrected} ({fieldHints.source.kind})
                          </p>
                        ) : null}
                      </div>
                      <div className="glass-input-wrap">
                        <label className="form-label"><MapPin size={13} className="mr-1 inline" /> To</label>
                        <input
                          className="form-input"
                          placeholder="e.g. Goa, Manali, Jaipur"
                          value={form.destination}
                          onChange={(e) => {
                            set("destination", e.target.value);
                            setFieldHints((prev) => ({ ...prev, destination: null }));
                          }}
                          onBlur={(e) => applyLocationAutocorrect("destination", e.target.value)}
                        />
                        {fieldHints.destination ? (
                          <p className="mt-2 text-xs text-[#7bd1c8]">
                            Autocorrected to {fieldHints.destination.corrected} ({fieldHints.destination.kind})
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div>
                    <p className="mb-6 text-sm text-white/50">When are you planning to travel?</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="glass-input-wrap">
                        <label className="form-label"><Calendar size={13} className="mr-1 inline" /> Start Date</label>
                        <input
                          type="date"
                          className="form-input"
                          min={today}
                          value={form.startDate}
                          onChange={(e) => {
                            const nextStart = e.target.value;
                            set("startDate", nextStart);
                            if (form.endDate && nextStart && form.endDate < nextStart) {
                              set("endDate", nextStart);
                            }
                          }}
                        />
                      </div>
                      <div className="glass-input-wrap">
                        <label className="form-label"><Calendar size={13} className="mr-1 inline" /> Return Date</label>
                        <input
                          type="date"
                          className="form-input"
                          min={form.startDate || today}
                          value={form.endDate}
                          onChange={(e) => set("endDate", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="mt-4 rounded-2xl border border-[#f2a65a]/15 bg-[#f2a65a]/8 px-4 py-3 text-sm text-white/60">
                      Prices can differ a lot around long weekends, holidays, and destination peak seasons.
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <p className="mb-6 text-sm text-white/50">Enter travelers and budget.</p>
                    <div className="space-y-4">
                      <div className="glass-input-wrap">
                        <label className="form-label"><Users size={13} className="mr-1 inline" /> Number of Travelers</label>
                        <div className="flex items-center gap-4">
                          <button
                            className="glass-card-light flex h-10 w-10 items-center justify-center rounded-xl text-xl font-bold text-white hover:bg-white/10"
                            onClick={() => set("travelers", Math.max(1, form.travelers - 1))}
                          >
                            -
                          </button>
                          <span className="w-12 text-center text-2xl font-bold text-white">{form.travelers}</span>
                          <button
                            className="glass-card-light flex h-10 w-10 items-center justify-center rounded-xl text-xl font-bold text-white hover:bg-white/10"
                            onClick={() => set("travelers", Math.min(20, form.travelers + 1))}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {minimumBudgetLoading ? (
                        <div className="inline-flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                          <span className="text-xs uppercase tracking-[0.16em] text-white/45">Minimum Budget</span>
                          <span className="text-sm text-white/60">Calculating...</span>
                        </div>
                      ) : minimumBudgetHint ? (
                        <div className="inline-flex items-center gap-3 rounded-xl border border-[#f2a65a]/25 bg-[#f2a65a]/10 px-3 py-2">
                          <span className="text-xs uppercase tracking-[0.16em] text-[#f7d08a]/85">Minimum Budget</span>
                          <span className="text-lg font-semibold text-white">INR {minimumBudgetHint.total.toLocaleString()}</span>
                        </div>
                      ) : null}

                      <div className="glass-input-wrap">
                        <label className="form-label"><Wallet size={13} className="mr-1 inline" /> Total Budget (INR)</label>
                        <input
                          type="number"
                          className="form-input"
                          min={1000}
                          step={1000}
                          value={form.budget}
                          onChange={(e) => set("budget", Number(e.target.value))}
                        />
                        {minimumBudgetHint && form.budget < minimumBudgetHint.total ? (
                          <p className="mt-2 text-xs text-red-300">
                            Increase budget to at least INR {minimumBudgetHint.total.toLocaleString()}.
                          </p>
                        ) : null}
                      </div>

                      <div className="glass-input-wrap">
                        <label className="form-label">Trip Type</label>
                        <select className="form-input" value={form.tripType} onChange={(e) => set("tripType", e.target.value)}>
                          <option value="solo">Solo</option>
                          <option value="friends">Friends</option>
                          <option value="family">Family</option>
                          <option value="romantic">Romantic Couple</option>
                          <option value="adventure">Adventure Group</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div>
                    <p className="mb-6 text-sm text-white/50">Select your interests. Multiple selections are fine.</p>
                    <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto pr-1">
                      {INTERESTS.map((interest) => (
                        <button
                          key={interest}
                          onClick={() => toggleInterest(interest)}
                          className={`interest-chip ${form.interests.includes(interest) ? "selected" : ""}`}
                        >
                          {interest}
                        </button>
                      ))}
                    </div>
                    {form.interests.length > 0 && (
                      <p className="mt-3 text-xs text-[#7bd1c8]">{form.interests.length} selected</p>
                    )}
                  </div>
                )}

                {step === 4 && (
                  <div>
                    <p className="mb-6 text-sm text-white/50">Review your trip details before AI generates your plan.</p>
                    <div className="space-y-3">
                      {[
                        { icon: "Route", label: "Route", value: `${form.source} to ${form.destination}` },
                        { icon: "Dates", label: "Dates", value: `${form.startDate} to ${form.endDate}` },
                        { icon: "People", label: "Travelers", value: `${form.travelers} person(s)` },
                        { icon: "Budget", label: "Budget target", value: `INR ${form.budget.toLocaleString()}` },
                        ...(minimumBudgetHint
                          ? [{ icon: "Minimum", label: "Minimum budget", value: `INR ${minimumBudgetHint.total.toLocaleString()}` }]
                          : []),
                        { icon: "Transport", label: "Transport", value: "Planner recommended route with alternatives" },
                        { icon: "Interests", label: "Interests", value: form.interests.length ? `${form.interests.length} selected` : "None selected" },
                      ].map((r) => (
                        <div key={r.label} className="flex items-center justify-between border-b border-white/5 py-2">
                          <span className="text-sm text-white/40">{r.icon} {r.label}</span>
                          <span className="text-sm font-medium capitalize text-white">{r.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-2xl border border-[#f2a65a]/15 bg-[#f2a65a]/8 px-4 py-3 text-sm text-white/60">
                      Final plans use your answers as inputs. Exact availability and final prices can still move with booking date and inventory.
                    </div>
                    {minimumBudgetHint && form.budget < minimumBudgetHint.total ? (
                      <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/15 p-4 text-sm text-white/75">
                        Increase budget to at least INR {minimumBudgetHint.total.toLocaleString()} for this route and group size.
                      </div>
                    ) : null}

                    {error && (() => {
                      const isRateLimit = error.includes("429") || error.includes("Too Many Requests") || error.includes("quota") || error.includes("RESOURCE_EXHAUSTED");
                      const retryMatch = error.match(/retryDelay\\":\\"(\d+)s"|retry in ([\d.]+)s/i);
                      const waitSec = retryMatch ? Math.ceil(Number(retryMatch[1] || retryMatch[2])) : 60;
                      const isAuth = error.includes("403") || error.includes("API_KEY") || error.includes("401");

                      return (
                        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/15 p-4 text-sm">
                          {isRateLimit ? (
                            <div>
                              <p className="mb-1 font-semibold text-red-400">AI service temporarily busy</p>
                              <p className="mb-2 text-white/60">The free-tier AI quota is temporarily exhausted. Please wait <span className="font-bold text-white">{waitSec} seconds</span> and try again.</p>
                              <p className="text-xs text-white/40">If it keeps failing, the daily quota may be exhausted. Try again after a few hours.</p>
                            </div>
                          ) : isAuth ? (
                            <div>
                              <p className="mb-1 font-semibold text-red-400">API Key Error</p>
                              <p className="text-white/60">Please check your AI_API_KEY in <code className="text-[#7bd1c8]">.env.local</code> and restart the server.</p>
                            </div>
                          ) : (
                            <div>
                              <p className="mb-1 font-semibold text-red-400">Generation Failed</p>
                              <p className="text-white/60">{error.length > 120 ? `${error.slice(0, 120)}...` : error}</p>
                              <p className="mt-1 text-xs text-white/40">Please try again in a few moments.</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex justify-between">
            <button
              onClick={prev}
              disabled={step === 0}
              className="btn-secondary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ArrowLeft size={16} /> Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={next}
                disabled={(step === 0 && (!form.source || !form.destination)) || (step === 1 && (!form.startDate || !form.endDate))}
                className="btn-primary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ArrowRight size={16} />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-2">
                {loading ? (
                  <>
                    <div className="spinner h-4 w-4 rounded-full border-2 border-white/30 border-t-white" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generate My Plan
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
