"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Bus, ChevronRight, Clock, MapPin, Plane, Search, Shield, Star, Train, TrendingUp, Users, Zap } from "lucide-react";

const DESTINATIONS = [
  { city: "Mysore", state: "Karnataka", image: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Mysore_palace%2C_karnataka.jpg", tag: "Palaces", color: "#f59e0b", emoji: "MY", desc: "Royal heritage and culture", bestMonths: "Oct to Feb", idealStay: "2 to 3 days", pricing: "Pricing varies by season", highlight: "Mysore Palace, markets, silk and sandalwood" },
  { city: "Ooty", state: "Tamil Nadu", image: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Tea_Estate_in_Ooty%2C_Tamil_Nadu.JPG", tag: "Hill Station", color: "#06b6d4", emoji: "OT", desc: "Tea hills and toy train", bestMonths: "Mar to Jun", idealStay: "2 to 4 days", pricing: "Peak summer costs rise faster", highlight: "Nilgiri Mountain Railway, lake views, tea estates" },
  { city: "Chennai", state: "Tamil Nadu", image: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Chennai_marina_beach.jpg", tag: "Metro Coast", color: "#10b981", emoji: "CH", desc: "Marina, food, and culture", bestMonths: "Nov to Feb", idealStay: "2 to 3 days", pricing: "Weekends and events change rates", highlight: "Marina Beach, temples, filter coffee, city breaks" },
  { city: "Goa", state: "Goa", image: "/destinations/goa.png", tag: "Beaches", color: "#06b6d4", emoji: "GO", desc: "Sun, sand & shacks", bestMonths: "Nov to Feb", idealStay: "3 to 5 days", pricing: "Festive season gets expensive", highlight: "Beaches, nightlife, seafood, watersports" },
  { city: "Manali", state: "Himachal Pradesh", image: "/destinations/manali.png", tag: "Mountains", color: "#8b5cf6", emoji: "MN", desc: "Snow & adventure", bestMonths: "Oct to Feb", idealStay: "4 to 5 days", pricing: "Snow months can spike prices", highlight: "Snow drives, cafes, Solang Valley and mountain stays" },
  { city: "Jaipur", state: "Rajasthan", image: "/destinations/jaipur.png", tag: "Heritage", color: "#f59e0b", emoji: "JP", desc: "Pink City royalty", bestMonths: "Oct to Mar", idealStay: "2 to 3 days", pricing: "Luxury stays shift totals quickly", highlight: "Amber Fort, Hawa Mahal, crafts and royal stays" },
];

const FEATURES = [
  { icon: <Zap size={22} />, title: "AI Plan in 60 Seconds", desc: "Full itinerary, transport, and hotels generated instantly by AI", color: "#e76f51" },
  { icon: <TrendingUp size={22} />, title: "Budget Optimizer", desc: "Get better deals and save up to 40% with cost comparison", color: "#7bd1c8" },
  { icon: <MapPin size={22} />, title: "End-to-End Planning", desc: "Flights, trains, hotels, food, and sightseeing in one plan", color: "#f4a261" },
  { icon: <Star size={22} />, title: "Real Local Insights", desc: "Authentic restaurant picks, local transport tips & hidden gems", color: "#ffd166" },
  { icon: <Clock size={22} />, title: "Day-wise Itinerary", desc: "Hour-by-hour plans with entry fees, tips, and travel times", color: "#5ec2b7" },
  { icon: <Shield size={22} />, title: "Instant Booking Links", desc: "One-click booking to IRCTC, MakeMyTrip, redBus, OYO & more", color: "#8ecae6" },
];

const POPULAR_ROUTES = [
  { from: "Mumbai", to: "Goa", duration: "45 min", price: "From INR 3,500" },
  { from: "Delhi", to: "Manali", duration: "14 hrs", price: "From INR 1,200" },
  { from: "Bangalore", to: "Coorg", duration: "5 hrs", price: "From INR 2,000" },
  { from: "Chennai", to: "Ooty", duration: "6 hrs", price: "From INR 800" },
  { from: "Delhi", to: "Jaipur", duration: "5 hrs", price: "From INR 400" },
  { from: "Kolkata", to: "Darjeeling", duration: "11 hrs", price: "From INR 600" },
];

function DestinationCard({ dest, index }: { dest: typeof DESTINATIONS[number]; index: number }) {
  const planHref = `/plan?dest=${encodeURIComponent(dest.city)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
      whileHover={{ y: -6 }}
      className="group overflow-hidden rounded-[30px] border border-[#f6f1e8]/10 bg-[linear-gradient(180deg,rgba(8,20,31,0.96),rgba(9,22,31,0.84))] shadow-[0_30px_80px_rgba(0,0,0,0.32)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[#0d1a29]">
        <Image src={dest.image} alt={`${dest.city} preview`} fill quality={95} className="object-cover transition-transform duration-700 group-hover:scale-105" sizes="(max-width: 768px) 100vw, 33vw" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07131f]/80 via-transparent to-transparent" />
        <div className="absolute left-4 top-4 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-lg" style={{ backgroundColor: `${dest.color}CC` }}>
          {dest.emoji} {dest.tag}
        </div>
        <div className="absolute right-4 top-4 rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-xs text-white/85 backdrop-blur-sm">
          {dest.state}
        </div>
      </div>
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-poppins text-2xl font-bold text-white">{dest.city}</h3>
            <p className="mt-1 max-w-[18rem] text-sm text-white/70">{dest.desc}</p>
          </div>
          <div className="rounded-2xl border border-[#f4a261]/18 bg-[#f4a261]/10 px-3 py-2 text-right">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#f8d49a]/80">Pricing</div>
            <div className="text-sm font-semibold text-[#f8d49a]">{dest.pricing}</div>
          </div>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
            <div className="text-white/45">Best months</div>
            <div className="mt-1 font-medium text-white">{dest.bestMonths}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/4 px-3 py-3">
            <div className="text-white/45">Ideal stay</div>
            <div className="mt-1 font-medium text-white">{dest.idealStay}</div>
          </div>
        </div>
        <div className="mb-5 rounded-2xl border border-white/8 bg-black/15 px-3 py-3 text-sm text-white/72">
          <span className="text-white/45">Why go:</span> {dest.highlight}
        </div>
        <Link href={planHref} className="inline-flex items-center gap-1 rounded-xl bg-[#e76f51] px-4 py-2 text-xs font-semibold text-[#fffaf4] hover:bg-[#f1896f]">
          Plan Trip <ChevronRight size={12} />
        </Link>
      </div>
    </motion.div>
  );
}

export default function HomePage() {
  const [heroSearch, setHeroSearch] = useState("");
  const heroTarget = heroSearch.trim() ? `/plan?dest=${encodeURIComponent(heroSearch.trim())}` : "/plan";

  return (
    <div className="min-h-screen overflow-x-hidden">
      <nav className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-white/8 bg-[#06111a]/70 px-6 py-4 backdrop-blur-2xl md:px-12">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f4a261] to-[#e76f51] text-xs font-bold shadow-lg shadow-orange-500/30">BK</div>
          <span className="font-poppins text-2xl font-bold tracking-[0.02em] text-white">Bookaro</span>
          <span className="hidden rounded-full border border-[#f4a261]/25 bg-[#f4a261]/15 px-2 py-0.5 text-xs font-medium text-[#f8d49a] md:block">India Travel AI</span>
        </div>
        <div className="hidden items-center gap-8 text-sm text-white/55 md:flex">
          <a href="#destinations" className="transition-colors hover:text-white">Destinations</a>
          <a href="#routes" className="transition-colors hover:text-white">Routes</a>
          <a href="#features" className="transition-colors hover:text-white">Features</a>
        </div>
        <Link href="/plan">
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="btn-primary px-6 py-2.5 text-sm">
            Plan Free Trip
          </motion.button>
        </Link>
      </nav>

      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-12 pt-24">
        <div className="absolute inset-0">
          <Image src="https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=2200&q=95" alt="Scenic India travel view" fill priority quality={95} className="object-cover" sizes="100vw" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,10,16,0.18),rgba(5,16,25,0.72)_52%,rgba(4,12,19,0.98)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(248,212,154,0.18),transparent_28%)]" />
        </div>

        <div className="relative z-10 grid w-full max-w-6xl items-end gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#f4a261]/20 bg-[#081520]/75 px-4 py-2 text-sm text-[#f8d49a] shadow-[0_18px_45px_rgba(0,0,0,0.24)]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="max-w-4xl">
              <h1 className="mb-5 font-poppins text-6xl font-bold leading-[0.9] text-white md:text-8xl">
                Plan India
                <br />
                <span className="gradient-text">with cinematic clarity</span>
              </h1>
              <p className="mb-8 max-w-3xl text-lg leading-relaxed text-white/78 md:text-[1.35rem]">
                Discover where to go, what it may cost, and why it is worth the trip before you open the planner.
                Bookaro now feels more like a premium travel magazine backed by an AI planning engine.
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8 w-full max-w-3xl">
              <div className="flex flex-col gap-3 rounded-[30px] border border-white/10 bg-[#091723]/72 p-3 pl-5 shadow-[0_30px_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl md:flex-row md:items-center">
                <Search size={18} className="mt-3 shrink-0 text-white/40 md:mt-0" />
                <input className="flex-1 bg-transparent py-2 text-sm text-white placeholder-white/35 outline-none" placeholder="Start with a destination or route, for example Chennai to Ooty" value={heroSearch} onChange={(e) => setHeroSearch(e.target.value)} />
                <Link href={heroTarget}>
                  <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="btn-primary flex w-full shrink-0 items-center justify-center gap-2 md:w-auto">
                    <Zap size={16} /> Plan My Trip
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-[#f8d49a]/80">Quick Picks</div>
                <div className="mt-1 font-poppins text-3xl font-bold text-white">Most saved escapes</div>
              </div>
            </div>
            <div className="space-y-3">
              {DESTINATIONS.slice(0, 3).map((dest) => (
                <Link key={dest.city} href={`/plan?dest=${encodeURIComponent(dest.city)}`}>
                  <div className="group flex items-center gap-3 rounded-[24px] border border-white/8 bg-white/4 p-3 transition-all hover:border-[#f4a261]/30 hover:bg-white/6">
                    <div className="relative h-20 w-24 overflow-hidden rounded-2xl bg-[#0d1a29]">
                      <Image src={dest.image} alt={dest.city} fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="96px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-white">{dest.city}</div>
                        <div className="text-xs text-[#f8d49a]">{dest.pricing}</div>
                      </div>
                      <div className="mt-1 text-xs text-white/55">{dest.highlight}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section id="destinations" className="px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.div className="mb-12 text-center" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#f7d08a]">Explore India</span>
            <h2 className="mt-2 mb-3 font-poppins text-4xl font-bold text-white md:text-5xl">
              Popular <span className="gradient-text">Destinations</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-white/60">
              Rebuilt with sharper photography and stronger contrast so destinations feel aspirational before the planning even starts.
            </p>
          </motion.div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {DESTINATIONS.map((dest, i) => <DestinationCard key={dest.city} dest={dest} index={i} />)}
          </div>
          <motion.div className="mt-10 text-center" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <Link href="/plan">
              <motion.button whileHover={{ scale: 1.04 }} className="btn-primary mx-auto flex items-center gap-2 px-8 py-4 text-base">
                Plan Any Destination in India <ArrowRight size={18} />
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </section>

      <section id="routes" className="border-y border-white/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(244,162,97,0.04),rgba(255,255,255,0.02))] px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <motion.div className="mb-10 text-center" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#7bd1c8]">Most Booked</span>
            <h2 className="mt-2 font-poppins text-4xl font-bold text-white">Popular Routes</h2>
          </motion.div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {POPULAR_ROUTES.map((route, i) => (
              <motion.div key={`${route.from}-${route.to}`} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} whileHover={{ scale: 1.02 }}>
                <Link href={`/plan?src=${encodeURIComponent(route.from)}&dest=${encodeURIComponent(route.to)}`}>
                  <div className="glass-card group flex cursor-pointer items-center gap-3 p-4 transition-all hover:border-[#f4a261]/30">
                    <div className="min-w-[90px] text-center">
                      <div className="text-sm font-bold text-white">{route.from}</div>
                      <div className="my-0.5 text-xs text-[#f4a261]">to</div>
                      <div className="text-sm font-bold text-white">{route.to}</div>
                    </div>
                    <div className="flex-1 border-l border-white/8 pl-3">
                      <div className="text-xs text-white/40">{route.duration}</div>
                      <div className="text-sm font-semibold text-[#7bd1c8]">{route.price}</div>
                    </div>
                    <ChevronRight size={16} className="text-white/20 transition-colors group-hover:text-[#f4a261]" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <motion.div className="mb-14 text-center" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#f8d49a]">Why Bookaro</span>
            <h2 className="mt-2 font-poppins text-4xl font-bold text-white">
              Everything for the <span className="gradient-text">perfect journey</span>
            </h2>
            <p className="mt-2 text-lg text-white/40">AI-powered travel planning from start to finish</p>
          </motion.div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} className="glass-card group cursor-pointer p-6 transition-all duration-300 hover:border-[#f4a261]/30" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} viewport={{ once: true }} whileHover={{ y: -5 }}>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110" style={{ backgroundColor: `${f.color}22`, color: f.color, border: `1px solid ${f.color}33` }}>
                  {f.icon}
                </div>
                <h3 className="mb-2 font-semibold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-white/40">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-6 text-sm uppercase tracking-widest text-white/30">We compare all travel modes</p>
          <div className="mb-8 flex flex-wrap justify-center gap-4">
            {[
              { icon: <Plane size={18} />, label: "Flights", platforms: "IndiGo  Air India  SpiceJet" },
              { icon: <Train size={18} />, label: "Trains", platforms: "IRCTC  Vande Bharat" },
              { icon: <Bus size={18} />, label: "Buses", platforms: "KSRTC  redBus  Abhibus" },
              { icon: <Users size={18} />, label: "Car/Cab", platforms: "Ola  Zoomcar  Savaari" },
            ].map((t) => (
              <div key={t.label} className="glass-card flex min-w-[140px] flex-col items-center gap-1.5 px-6 py-4 text-sm text-white/70">
                <div className="text-[#f4a261]">{t.icon}</div>
                <div className="font-semibold text-white">{t.label}</div>
                <div className="text-xs text-white/30">{t.platforms}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <motion.div className="relative mx-auto max-w-3xl overflow-hidden border border-[#f4a261]/12 bg-[linear-gradient(180deg,rgba(10,22,31,0.92),rgba(9,20,29,0.82))] p-12 text-center shadow-[0_30px_90px_rgba(0,0,0,0.3)]" initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
          <div className="mb-5 text-[11px] uppercase tracking-[0.35em] text-[#f8d49a]">Final Call</div>
          <h2 className="mb-3 font-poppins text-4xl font-bold text-white md:text-5xl">Ready to explore India?</h2>
          <p className="mb-6 text-lg text-white/50">Tell Bookaro where to go and AI does the rest in 60 seconds.</p>
          <Link href="/plan">
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="btn-primary w-full px-10 py-4 text-base sm:w-auto">
              Plan My India Trip - Free
            </motion.button>
          </Link>
        </motion.div>
      </section>
    </div>
  );
}
