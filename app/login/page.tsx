"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, LockKeyhole, Mail, Plane, ShieldCheck, Sparkles, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const TRUST_POINTS = [
  {
    icon: <Sparkles size={18} />,
    title: "Saved trips stay together",
    text: "Keep itineraries, budget breakdowns, and route ideas in one place.",
  },
  {
    icon: <ShieldCheck size={18} />,
    title: "Private planning space",
    text: "Your future account area can hold favourites, notes, and upcoming journeys.",
  },
  {
    icon: <Plane size={18} />,
    title: "Faster repeat planning",
    text: "Return to previous destinations and build the next itinerary faster.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const isSignUp = authMode === "signup";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (isSignUp && !agreeToTerms) {
      setError("Please accept the terms and privacy policy to continue.");
      return;
    }

    setSubmitting(true);

    try {
      const endpoint = isSignUp ? "/api/auth/signup" : "/api/auth/signin";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSignUp
            ? { fullName, email, password, confirmPassword }
            : { email, password, keepSignedIn }
        ),
      });

      const data = await response.json();
      if (!response.ok) {
        if (!isSignUp && String(data?.error || "").toLowerCase().includes("no account found")) {
          setAuthMode("signup");
        }
        throw new Error(data?.error || "Authentication failed");
      }

      router.push(data?.redirectTo || "/plan");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-8">
      <div className="floating-orb left-[8%] top-24 h-36 w-36 bg-[#f4a261]/20" />
      <div className="floating-orb right-[10%] top-32 h-44 w-44 bg-[#7bd1c8]/18" />
      <div className="floating-orb bottom-16 left-1/2 h-52 w-52 -translate-x-1/2 bg-[#e76f51]/16" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 lg:min-h-[calc(100vh-4rem)] lg:flex-row lg:items-center">
        <motion.section
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="w-full lg:max-w-[34rem]"
        >
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/78 backdrop-blur-xl"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f4a261] to-[#e76f51] text-xs font-bold text-white">
              BK
            </span>
            Bookaro
          </Link>

          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#f4a261]/20 bg-[#091723]/80 px-4 py-2 text-xs uppercase tracking-[0.24em] text-[#f8d49a]">
            {isSignUp ? "Create Account" : "Member Access"}
          </div>
          <h1 className="font-poppins text-5xl font-bold leading-[0.95] text-white md:text-6xl">
            {isSignUp ? "Create your" : "Welcome back to"}
            <span className="gradient-text block">smarter trip planning</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/62 md:text-lg">
            {isSignUp
              ? "Sign up to save itineraries, keep your destination shortlist, and continue planning trips across India from one account."
              : "Sign in to manage saved itineraries, revisit route ideas, and keep your India travel plans ready whenever inspiration hits."}
          </p>

          <div className="mt-10 grid gap-4">
            {TRUST_POINTS.map((point, index) => (
              <motion.div
                key={point.title}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 * index + 0.2 }}
                className="glass-card-light flex items-start gap-4 px-5 py-4"
              >
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-[#f4a261]/18 bg-[#f4a261]/12 text-[#f8d49a]">
                  {point.icon}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">{point.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-white/55">{point.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          className="w-full lg:flex-1"
        >
          <div className="form-shell aurora-panel relative mx-auto max-w-xl overflow-hidden p-6 sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(248,212,154,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(123,209,200,0.12),transparent_24%)]" />
            <div className="relative">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-[#f8d49a]/75">
                    {isSignUp ? "Sign Up" : "Login"}
                  </p>
                  <h2 className="mt-2 font-poppins text-3xl font-bold text-white">
                    {isSignUp ? "Start your Bookaro account" : "Continue your journey"}
                  </h2>
                </div>
                <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs text-white/65">
                  Secure access
                </div>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => setAuthMode("signin")}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold ${!isSignUp ? "tab-active" : "text-white/60 hover:text-white"}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("signup")}
                  className={`rounded-xl px-4 py-3 text-sm font-semibold ${isSignUp ? "tab-active" : "text-white/60 hover:text-white"}`}
                >
                  Sign Up
                </button>
              </div>

              <form className="space-y-5" onSubmit={handleSubmit}>
                {isSignUp ? (
                  <div>
                    <label htmlFor="name" className="form-label">
                      Full name
                    </label>
                    <div className="glass-input-wrap flex items-center gap-3">
                      <User size={18} className="shrink-0 text-white/35" />
                      <input
                        id="name"
                        name="name"
                        type="text"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/28"
                      />
                    </div>
                  </div>
                ) : null}

                <div>
                  <label htmlFor="email" className="form-label">
                    Email address
                  </label>
                  <div className="glass-input-wrap flex items-center gap-3">
                    <Mail size={18} className="shrink-0 text-white/35" />
                    <input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/28"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label htmlFor="password" className="form-label mb-0">
                      Password
                    </label>
                    {!isSignUp ? (
                      <Link href="/plan" className="text-xs font-medium text-[#f8d49a] hover:text-white">
                        Forgot password?
                      </Link>
                    ) : null}
                  </div>
                  <div className="glass-input-wrap flex items-center gap-3">
                    <LockKeyhole size={18} className="shrink-0 text-white/35" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/28"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="text-white/45 hover:text-white"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {isSignUp ? (
                  <div>
                    <label htmlFor="confirmPassword" className="form-label">
                      Confirm password
                    </label>
                    <div className="glass-input-wrap flex items-center gap-3">
                      <LockKeyhole size={18} className="shrink-0 text-white/35" />
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Re-enter your password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/28"
                      />
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-4 text-sm text-white/55">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSignUp ? agreeToTerms : keepSignedIn}
                      onChange={(event) => {
                        if (isSignUp) setAgreeToTerms(event.target.checked);
                        else setKeepSignedIn(event.target.checked);
                      }}
                      className="h-4 w-4 rounded border border-white/15 bg-transparent accent-[#e76f51]"
                    />
                    {isSignUp ? "I agree to the terms and privacy policy" : "Keep me signed in"}
                  </label>
                  <span>{isSignUp ? "New traveller" : "Existing member"}</span>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/12 px-4 py-3 text-sm text-red-200">
                    {error}
                  </div>
                ) : null}

                <button type="submit" disabled={submitting} className="btn-primary w-full py-4 text-base disabled:cursor-not-allowed disabled:opacity-70">
                  {submitting ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-white/45">
                {isSignUp ? "Already have an account? " : "New to Bookaro? "}
                <button
                  type="button"
                  onClick={() => setAuthMode(isSignUp ? "signin" : "signup")}
                  className="font-medium text-[#f8d49a] hover:text-white"
                >
                  {isSignUp ? "Sign in here" : "Create an account"}
                </button>
              </p>
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
