import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Marquee from "react-fast-marquee";
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowRight, Sparkles, ShieldCheck, Building2, Briefcase, ChevronLeft, ChevronRight } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useLenis } from "@/lib/useLenis";
import { api } from "@/lib/api";

// ————— Line reveal helper —————
function MaskLine({ children, delay = 0, className = "" }) {
  return (
    <span className="mask-line">
      <motion.span
        initial={{ y: "115%" }}
        animate={{ y: "0%" }}
        transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1], delay }}
        style={{ display: "block" }}
        className={className}
      >
        {children}
      </motion.span>
    </span>
  );
}

function FadeUp({ children, delay = 0, y = 30, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ————— Hero —————
function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yImg = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const scaleImg = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const opacityWord = useTransform(scrollYProgress, [0, 0.6], [1, 0.15]);

  return (
    <section ref={ref} className="relative h-[100vh] min-h-[720px] overflow-hidden bg-[#0A0A0A]">
      {/* clipped spotlight photograph on the right */}
      <motion.div
        style={{ y: yImg, scale: scaleImg }}
        className="absolute right-0 top-0 h-full w-[52%] md:w-[42%] lg:w-[38%]"
      >
        <div className="relative h-full w-full">
          <img
            src="https://images.pexels.com/photos/11264890/pexels-photo-11264890.jpeg"
            alt="Creator portrait"
            className="h-full w-full object-cover object-center spotlight-img"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[#0A0A0A]/10 to-[#0A0A0A]" />
        </div>
      </motion.div>

      {/* Content */}
      <div className="relative z-10 h-full max-w-[1600px] mx-auto px-6 md:px-10 pt-32 md:pt-40 pb-10 grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-10 flex flex-col justify-between h-full">
          {/* top meta */}
          <div className="flex items-start justify-between font-mono text-[11px] tracking-[0.28em] uppercase text-[#F4F4F0]/60">
            <MaskLine delay={0.1}>
              <span>◎ Vol. 08 · Winter Edition</span>
            </MaskLine>
            <MaskLine delay={0.15}>
              <span className="hidden md:inline">A studio for signal · not noise</span>
            </MaskLine>
          </div>

          {/* kinetic wordmark */}
          <div className="relative">
            <motion.h1
              style={{ opacity: opacityWord }}
              className="font-editorial text-[#F4F4F0] leading-[1.15] md:leading-[1.1] tracking-tighter"
            >
              <MaskLine delay={0.2} className="py-3">
                <span className="block text-[10vw] md:text-[7.5vw] font-medium">The bridge</span>
              </MaskLine>
              <MaskLine delay={0.35} className="py-3">
                <span className="block text-[10vw] md:text-[7.5vw] italic font-normal">
                  between owners
                </span>
              </MaskLine>
              <MaskLine delay={0.5} className="py-3">
                <span className="block text-[10vw] md:text-[7.5vw] font-medium">
                  &amp; influence<span className="tick">.</span>
                </span>
              </MaskLine>
            </motion.h1>
          </div>

          {/* bottom row */}
          <FadeUp delay={0.8}>
            <div className="grid grid-cols-12 gap-6 items-end">
              <div className="col-span-12 md:col-span-5">
                <p className="text-[#F4F4F0]/80 max-w-md text-base md:text-lg leading-relaxed">
                  CR8 connects elite brands with fully verified influencers. Lock budgets securely in smart escrow, automate caption compliance audits, and access direct analytics.
                </p>
              </div>
              <div className="col-span-12 md:col-span-4 flex flex-wrap items-center gap-4">
                <Link to="/register" data-testid="hero-cta-primary" className="btn-solid">
                  Enter the studio <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/marketplace"
                  data-testid="hero-cta-secondary"
                  className="btn-pill text-[#F4F4F0]"
                >
                  Browse Creators
                </Link>
              </div>
              <div className="col-span-12 md:col-span-3 font-mono text-[10px] tracking-[0.25em] uppercase text-[#F4F4F0]/50 md:text-right">
                <div>Scroll ↓</div>
                <div className="mt-1">to open the file</div>
              </div>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}

// ————— Marquee —————
function EditorialMarquee() {
  return (
    <section className="paper bg-[#F4F4F0] text-[#0A0A0A] hairline-t hairline-b overflow-hidden">
      <Marquee gradient={false} speed={45} className="py-8 md:py-10">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="font-editorial italic text-5xl md:text-7xl px-8 flex items-center gap-8">
            The Owners <span className="tick text-3xl">✦</span> The Influencers
            <span className="tick text-3xl">✦</span>
          </span>
        ))}
      </Marquee>
    </section>
  );
}

// ————— Manifesto (Side-by-Side Interactive Slider with < > Buttons) —————
const CHAPTERS = [
  {
    n: "01",
    title: "A studio, not a marketplace.",
    body:
      "CR8 is curated. Every owner is briefed, every creator is credentialed. No open bidding wars, no race to the bottom — only introductions that make sense.",
  },
  {
    n: "02",
    title: "Signal beats scale.",
    body:
      "We do not chase follower counts. A creator with 40,000 devoted readers can move more product than a stadium of tourists. We measure attention, not impressions.",
  },
  {
    n: "03",
    title: "Craft is contagious.",
    body:
      "When owners fund culture instead of clout, the work gets better on both sides. CR8 exists to keep both parties honest — and slightly obsessive.",
  },
  {
    n: "04",
    title: "One handshake, then work.",
    body:
      "Contracts, briefs, deliverables, timelines — all handled inside the studio. Meet once. Then get on with it.",
  },
];

function Manifesto() {
  const [activeChapter, setActiveChapter] = useState(0);

  const prevChapter = () => {
    setActiveChapter((prev) => (prev === 0 ? CHAPTERS.length - 1 : prev - 1));
  };

  const nextChapter = () => {
    setActiveChapter((prev) => (prev === CHAPTERS.length - 1 ? 0 : prev + 1));
  };

  return (
    <section id="manifesto" className="paper bg-[#F4F4F0] text-[#0A0A0A] py-16 md:py-24 border-t border-b border-[#0A0A0A]/10">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="flex items-center justify-between hairline-b pb-6 mb-12">
            <div>
              <span className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
                § Studio Manifesto
              </span>
              <h2 className="font-editorial text-3xl md:text-5xl mt-1 text-[#0A0A0A]">
                Four Chapters <span className="italic">of Intent<span className="tick">.</span></span>
              </h2>
            </div>

            {/* Clickable < > Nav Buttons & Chapter Pills */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 mr-2">
                {CHAPTERS.map((ch, idx) => (
                  <button
                    key={ch.n}
                    type="button"
                    onClick={() => setActiveChapter(idx)}
                    className={`font-mono text-[10px] tracking-widest px-3 py-1 uppercase rounded-xs transition-all ${
                      activeChapter === idx ? "bg-[#0A0A0A] text-[#F4F4F0] font-bold" : "bg-[#0A0A0A]/10 text-[#0A0A0A] hover:bg-[#0A0A0A]/20"
                    }`}
                  >
                    Ch {ch.n}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={prevChapter}
                aria-label="Previous Chapter"
                data-testid="manifesto-prev-btn"
                className="p-3 bg-[#0A0A0A] text-[#F4F4F0] border border-[#0A0A0A] hover:bg-[#FF3B30] hover:border-[#FF3B30] rounded-full transition-all duration-300 cursor-pointer shadow-lg active:scale-95"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={nextChapter}
                aria-label="Next Chapter"
                data-testid="manifesto-next-btn"
                className="p-3 bg-[#0A0A0A] text-[#F4F4F0] border border-[#0A0A0A] hover:bg-[#FF3B30] hover:border-[#FF3B30] rounded-full transition-all duration-300 cursor-pointer shadow-lg active:scale-95"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </FadeUp>

        {/* Side-by-side Manifesto Carousel Container */}
        <div className="relative overflow-hidden pt-2">
          <div
            className="flex gap-6 transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${activeChapter * (window?.innerWidth >= 768 ? 50 : 100)}%)` }}
          >
            {CHAPTERS.map((c, i) => (
              <div key={c.n} className="w-full md:w-[calc(50%-12px)] shrink-0">
                <div className="p-8 md:p-12 border border-[#0A0A0A]/15 bg-white flex flex-col justify-between h-[360px] md:h-[420px] rounded-sm relative overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div>
                    <div className="chapter-num text-7xl md:text-8xl text-[#0A0A0A] font-editorial leading-none mb-4 opacity-90">
                      {c.n[0]}<span className="tick text-[#FF3B30]">{c.n[1]}</span>
                    </div>
                    <h3 className="font-editorial text-3xl md:text-4xl leading-[1.15] text-[#0A0A0A]">
                      {c.title}
                    </h3>
                    <p className="mt-4 font-mono text-sm leading-relaxed text-[#0A0A0A]/80">
                      {c.body}
                    </p>
                  </div>
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-50 flex items-center justify-between border-t border-[#0A0A0A]/10 pt-4 mt-6">
                    <span>Chapter {c.n} / 04</span>
                    <span className="text-[#FF3B30] font-bold">Click next to explore →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ————— Split (Owners vs Agents vs Influencers Side-by-Side Slider) —————
function SplitView() {
  const [activeDoor, setActiveDoor] = useState(0);

  const doors = [
    {
      id: "owner",
      tag: "01 — For the owners",
      title: "Post your brief. Meet the mavericks.",
      points: ["Brief in under 3 minutes", "Receive curated applications", "Contract, deliver, ship"],
      ctaText: "I'm an owner",
      link: "/register/owner",
      bgClass: "bg-[#0D0D0D] border-white/10 text-white"
    },
    {
      id: "influencer",
      tag: "02 — For the creators",
      title: "Build a body of work worth signing.",
      points: ["Curated invites only", "Pitch on your terms", "Get paid, keep credit"],
      ctaText: "I'm a creator",
      link: "/register/influencer",
      bgClass: "bg-[#F4F4F0] text-[#0A0A0A] border-white/20"
    }
  ];

  const prevDoor = () => {
    setActiveDoor((prev) => (prev === 0 ? doors.length - 1 : prev - 1));
  };

  const nextDoor = () => {
    setActiveDoor((prev) => (prev === doors.length - 1 ? 0 : prev + 1));
  };

  return (
    <section id="work" className="bg-[#0A0A0A] text-[#F4F4F0] py-16 border-t border-white/10">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="flex items-center justify-between hairline-b pb-6 mb-12">
            <div>
              <span className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
                § How It Works
              </span>
              <h2 className="font-editorial text-3xl md:text-5xl mt-1">
                Three Doors <span className="italic">· One Studio<span className="tick">.</span></span>
              </h2>
            </div>

            {/* Clickable < > Nav Controls & Door Tabs */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 mr-2">
                {doors.map((d, idx) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setActiveDoor(idx)}
                    className={`font-mono text-[10px] tracking-widest px-3 py-1 uppercase rounded-xs transition-all ${
                      activeDoor === idx ? "bg-[#FF3B30] text-white font-bold" : "bg-white/10 text-white/70 hover:bg-white/20"
                    }`}
                  >
                    {d.id}s
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={prevDoor}
                aria-label="Previous Door"
                data-testid="door-prev-btn"
                className="p-3 bg-white/5 border border-white/15 hover:border-[#FF3B30] hover:bg-[#FF3B30] text-white rounded-full transition-all duration-300 cursor-pointer shadow-lg active:scale-95"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={nextDoor}
                aria-label="Next Door"
                data-testid="door-next-btn"
                className="p-3 bg-white/5 border border-white/15 hover:border-[#FF3B30] hover:bg-[#FF3B30] text-white rounded-full transition-all duration-300 cursor-pointer shadow-lg active:scale-95"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </FadeUp>

        {/* Side-by-side How It Works Carousel */}
        <div className="relative overflow-hidden pt-2">
          <div
            className="flex gap-6 transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${activeDoor * (window?.innerWidth >= 768 ? 50 : 100)}%)` }}
          >
            {doors.map((door, idx) => (
              <div key={door.id} className="w-full md:w-[calc(50%-12px)] shrink-0">
                <div className={`p-8 md:p-10 border flex flex-col justify-between h-[420px] rounded-sm relative overflow-hidden transition-all duration-300 ${door.bgClass}`}>
                  <div>
                    <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
                      {door.tag}
                    </span>
                    <h3 className="font-editorial text-3xl md:text-4xl mt-3 leading-[1.15]">
                      {door.title}
                    </h3>
                    <ul className="mt-6 font-mono text-[11px] tracking-[0.15em] uppercase space-y-2.5 opacity-90">
                      {door.points.map((pt, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <span className="text-[#FF3B30] font-bold">0{i+1} —</span> {pt}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-6 border-t border-current/10 flex items-center justify-between">
                    <Link
                      to={door.link}
                      data-testid={`split-${door.id}-cta`}
                      className="btn-solid flex items-center gap-2 text-xs py-3 px-5"
                    >
                      {door.ctaText} <ArrowUpRight className="w-4 h-4" />
                    </Link>
                    <span className="font-mono text-[10px] tracking-widest uppercase opacity-60">
                      Door 0{idx+1} of 03
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ————— Agent Showcase (AI Data & Verified Agencies) —————
const FALLBACK_AGENTS = [
  {
    id: "agent-1",
    name: "Karan Agent",
    company: "Karan Talent Agency",
    bio: "Head Talent Director representing 45+ premier lifestyle, fashion, and tech creators across India & UAE. Negotiating high-value brand deals and long-term ambassadorships.",
    industry: "Talent Management & Executive Representation",
    location: "New Delhi, Delhi",
    avatar: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=400&h=400",
    niches: ["Celebrity Endorsements", "Creator Management", "Brand Contracts"],
    website: "https://karantalent.com"
  },
  {
    id: "agent-2",
    name: "Rahul Agent",
    company: "Rahul Talent Management",
    bio: "Senior Representative specializing in tech reviewers, gaming streamers, and digital innovators. Streamlining brand deals, legal contracts, and multi-channel growth strategies.",
    industry: "Digital Talent Strategy & Creator Relations",
    location: "Bengaluru, Karnataka",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400&h=400",
    niches: ["Tech Creators", "Gaming Management", "Esports Sponsorships"],
    website: "https://rahultalent.in"
  },
  {
    id: "agent-3",
    name: "Karan Johar",
    company: "Dharma Talent Management",
    bio: "Executive Creative Director leading luxury brand integrations and celebrity creator collaborations. Bridging mainstream entertainment with digital influence.",
    industry: "Entertainment & Celebrity Talent Management",
    location: "Mumbai, Maharashtra",
    avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=400&h=400",
    niches: ["Luxury Brand Deals", "Celebrity Management", "Film & Digital"],
    website: "https://dharmatalent.com"
  },
  {
    id: "agent-4",
    name: "Shruti Hassan",
    company: "South Stars Media",
    bio: "Founder & Principal Talent Scout representing top South Asian lifestyle, music, and cinematic creators. Driving regional campaigns with pan-India reach.",
    industry: "Regional & Pan-India Talent Representation",
    location: "Hyderabad, Telangana",
    avatar: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400&h=400",
    niches: ["Regional Creators", "Cinema & Music", "Brand Partnerships"],
    website: "https://southstarsmedia.com"
  }
];

function AgentShowcase() {
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    api.get("/agents/public")
      .then((r) => {
        if (r.data && Array.isArray(r.data) && r.data.length > 0) {
          setAgents(r.data);
        } else {
          setAgents(FALLBACK_AGENTS);
        }
      })
      .catch(() => setAgents(FALLBACK_AGENTS));
  }, []);

  const displayAgents = agents.length > 0 ? agents : FALLBACK_AGENTS;

  return (
    <section id="agents-network" className="bg-[#0A0A0A] text-[#F4F4F0] py-20 border-t border-[#F4F4F0]/10">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="flex items-baseline justify-between hairline-b pb-6 mb-12">
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#FF3B30]" /> § AI Agent Network &amp; Talent Agencies
            </span>
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
              Verified Agencies · AI Roster Routing
            </span>
          </div>
        </FadeUp>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h2 className="font-editorial text-4xl md:text-6xl leading-[1.1]">
              Verified Agencies &amp; <span className="italic">AI Talent Directors<span className="tick">.</span></span>
            </h2>
            <p className="mt-3 font-mono text-[12px] tracking-[0.1em] uppercase text-[#F4F4F0]/60 max-w-xl">
              Powering multi-creator rosters, AI pitch automation, contract negotiations, and enterprise escrow payouts.
            </p>
          </div>
          <Link
            to="/register/agent"
            data-testid="agent-showcase-register"
            className="btn-solid self-start shrink-0 flex items-center gap-2"
          >
            <Building2 className="w-4 h-4" /> Register Talent Agency <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayAgents.slice(0, 4).map((ag, i) => (
            <FadeUp key={ag.id || i} delay={i * 0.08}>
              <div 
                className="group relative bg-[#121212] border border-[#F4F4F0]/10 hover:border-[#FF3B30]/40 p-6 flex flex-col justify-between h-full transition-all duration-500 rounded-sm overflow-hidden"
                data-testid={`agent-card-${i}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-4 mb-5">
                    <div className="relative w-14 h-14 rounded-full overflow-hidden border border-[#F4F4F0]/20 shrink-0">
                      <img 
                        src={ag.avatar || FALLBACK_AGENTS[i % FALLBACK_AGENTS.length].avatar} 
                        alt={ag.company || ag.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                    </div>
                    <span className="inline-flex items-center gap-1 font-mono text-[9px] tracking-[0.2em] uppercase px-2.5 py-1 bg-[#FF3B30]/10 border border-[#FF3B30]/30 text-[#FF3B30] rounded-sm">
                      <ShieldCheck className="w-3 h-3" /> Verified Agency
                    </span>
                  </div>

                  <h3 className="font-editorial text-2xl group-hover:text-[#FF3B30] transition-colors leading-tight">
                    {ag.company || ag.name}
                  </h3>
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 mt-1 flex items-center gap-2">
                    <Briefcase className="w-3 h-3 text-[#FF3B30]" /> {ag.name}
                  </div>

                  <div className="mt-3 font-mono text-[9px] tracking-[0.18em] uppercase text-[#FF3B30]/80 bg-white/[0.03] px-2.5 py-1 inline-block border border-white/5">
                    {ag.industry || "Talent Representation"}
                  </div>

                  <p className="mt-4 font-mono text-[11px] leading-relaxed opacity-70 line-clamp-3">
                    {ag.bio}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between font-mono text-[10px] tracking-[0.2em] uppercase opacity-60">
                  <span>{ag.location || ag.city || "Pan-India"}</span>
                  <span className="text-[#FF3B30] group-hover:translate-x-1 transition-transform">
                    Explore Roster ↗
                  </span>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

// ————— Featured Grid Slider (Interactive < > Side-by-Side Carousel) —————
const FEATURED = [
  {
    img: "https://images.unsplash.com/photo-1700748910941-44f7577b0ba2",
    label: "Feature 01",
    title: "Kai Monroe × Studio Noir",
    meta: "Fashion Editorial · 512K",
  },
  {
    img: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=1200",
    label: "Feature 02",
    title: "Bottle No.7 launch",
    meta: "Luxury Product · 3-day sold out",
  },
  {
    img: "https://images.unsplash.com/photo-1739950839930-ef45c078f316",
    label: "Feature 03",
    title: "The Ritual Series",
    meta: "Beauty · Long-form",
  },
  {
    img: "https://images.unsplash.com/photo-1700748909753-3d4f58eb8273",
    label: "Feature 04",
    title: "Nova Reyes × Fragrance Atlas",
    meta: "Fragrance · Editorial",
  },
  {
    img: "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&q=80&w=1200",
    label: "Feature 05",
    title: "Aura Skincare Launch",
    meta: "Cosmetics · Campaign",
  },
  {
    img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=1200",
    label: "Feature 06",
    title: "Urban Vibe Apparel",
    meta: "Streetwear · 850K Reach",
  }
];

function FeaturedGrid() {
  const [slideIndex, setSlideIndex] = useState(0);

  const prevSlide = () => {
    setSlideIndex((prev) => (prev === 0 ? FEATURED.length - 2 : prev - 1));
  };

  const nextSlide = () => {
    setSlideIndex((prev) => (prev >= FEATURED.length - 2 ? 0 : prev + 1));
  };

  return (
    <section className="bg-[#0A0A0A] text-[#F4F4F0] py-14 md:py-20 border-t border-white/10">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="flex items-center justify-between hairline-b pb-6 mb-12">
            <div>
              <span className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
                § Selected Work Showcase
              </span>
              <h2 className="font-editorial text-3xl md:text-5xl mt-1">
                Side-by-Side <span className="italic">Showcase<span className="tick">.</span></span>
              </h2>
            </div>

            {/* Clickable < > Nav Controls */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] tracking-[0.2em] uppercase opacity-60 mr-2">
                {slideIndex + 1} / {FEATURED.length - 1}
              </span>
              <button
                type="button"
                onClick={prevSlide}
                aria-label="Previous Slide"
                data-testid="featured-prev-btn"
                className="p-3 bg-white/5 border border-white/15 hover:border-[#FF3B30] hover:bg-[#FF3B30] text-white rounded-full transition-all duration-300 cursor-pointer shadow-lg active:scale-95"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                aria-label="Next Slide"
                data-testid="featured-next-btn"
                className="p-3 bg-white/5 border border-white/15 hover:border-[#FF3B30] hover:bg-[#FF3B30] text-white rounded-full transition-all duration-300 cursor-pointer shadow-lg active:scale-95"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </FadeUp>

        {/* Side-by-side Carousel Container */}
        <div className="relative overflow-hidden pt-2">
          <div 
            className="flex gap-6 transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${slideIndex * 52}%)` }}
          >
            {FEATURED.map((f, i) => (
              <div key={i} className="w-full md:w-[calc(50%-12px)] shrink-0">
                <figure className="group relative overflow-hidden bg-[#121212] border border-white/10 p-4 rounded-sm hover:border-[#FF3B30]/40 transition-colors">
                  <div className="relative overflow-hidden aspect-[16/10] max-h-[320px] md:max-h-[360px]">
                    <img
                      src={f.img}
                      alt={f.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-[#0A0A0A]/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute inset-x-0 bottom-0 p-5 md:p-6 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500">
                      <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#FF3B30] font-bold">
                        {f.label}
                      </span>
                      <div className="font-editorial text-2xl md:text-3xl mt-1 text-white">{f.title}</div>
                    </div>
                  </div>
                  <figcaption className="flex items-baseline justify-between mt-4 font-mono text-[11px] tracking-[0.2em] uppercase">
                    <span className="text-white font-semibold">{f.title}</span>
                    <span className="text-[#FF3B30]">{f.meta}</span>
                  </figcaption>
                </figure>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ————— FAQ Section —————
const FAQS = [
  { q: 'How does escrow protection keep payouts secure?', a: 'When a brand launches a campaign, funds are locked in our secure escrow. Creators submit their completed drafts, which are audited for compliance. Payouts release instantly to creators only after the brand approves the final deliverables.' },
  { q: 'What is the AI Content Review?', a: 'Our built-in AI audits drafts automatically. It checks if the brand logo is clearly visible, verifies that required hashtags like #ad are included in captions, and detects copyright or profanity risks before anything is published.' },
  { q: 'Can creators join and use CR8 for free?', a: 'Yes! Creators can sign up, list their accounts, and search opportunities for free. We only charge a small 5% transaction commission on free tier payouts.' },
  { q: 'How does the creator matching work?', a: 'Instead of simple tag filters, our system calculates a fit score using follower demographics, engagement rates, brand affinities, and fake follower risk audits to suggest the perfect candidates.' }
];

function FAQ() {
  return (
    <section className="bg-[#0A0A0A] text-[#F4F4F0] py-24 md:py-32">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="flex items-baseline justify-between hairline-b pb-6 mb-14">
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
              § FAQ
            </span>
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
              Common questions
            </span>
          </div>
        </FadeUp>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
          {FAQS.map((faq, i) => (
            <FadeUp key={faq.q} delay={i * 0.06}>
              <div className="space-y-4">
                <h4 className="font-editorial text-2xl md:text-3xl leading-tight">{faq.q}</h4>
                <p className="font-mono text-[11px] md:text-[12px] tracking-[0.05em] uppercase text-[#F4F4F0]/60 leading-relaxed max-w-lg">
                  {faq.a}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

// ————— Stats / Closing —————
function Numbers() {
  const [stats, setStats] = useState({ creators: 0, owners: 0, campaigns: 0 });
  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);
  const rows = [
    { k: "Creators on file", v: stats.creators ?? "—", tail: "credentialed" },
    { k: "Brand owners", v: stats.owners ?? "—", tail: "invited only" },
    { k: "Live briefs", v: stats.campaigns ?? "—", tail: "in the studio" },
    { k: "Signal-to-noise", v: "94%", tail: "matched to intent" },
  ];
  return (
    <section className="paper bg-[#F4F4F0] text-[#0A0A0A] py-24 hairline-t">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        {rows.map((r, i) => (
          <FadeUp key={i} delay={i * 0.08}>
            <div className="hairline-b py-6 md:py-8 grid grid-cols-12 items-baseline">
              <div className="col-span-3 md:col-span-2 font-mono text-[11px] tracking-[0.28em] uppercase opacity-70">
                0{i + 1}
              </div>
              <div className="col-span-6 md:col-span-6 font-editorial text-3xl md:text-5xl leading-[1.1]">
                {r.k}
              </div>
              <div className="col-span-3 md:col-span-2 font-editorial text-4xl md:text-6xl italic text-right md:text-left">
                {r.v}
              </div>
              <div className="hidden md:block md:col-span-2 text-right font-mono text-[11px] tracking-[0.22em] uppercase opacity-60">
                {r.tail}
              </div>
            </div>
          </FadeUp>
        ))}
      </div>
    </section>
  );
}

function ClosingCTA() {
  return (
    <section className="bg-[#0A0A0A] text-[#F4F4F0] py-32 md:py-40">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-10">
          <FadeUp>
            <p className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60 mb-6">
              § End of file
            </p>
          </FadeUp>
          <MaskLine delay={0.1} className="py-3">
            <h2 className="font-editorial text-[13vw] md:text-[9vw] leading-[1.1]">
              Bring the work.
            </h2>
          </MaskLine>
          <MaskLine delay={0.22} className="py-3">
            <h2 className="font-editorial italic text-[13vw] md:text-[9vw] leading-[1.1]">
              We&apos;ll bring the room<span className="tick">.</span>
            </h2>
          </MaskLine>
          <FadeUp delay={0.5}>
            <div className="mt-12 flex flex-wrap gap-4">
              <Link to="/register" data-testid="closing-cta" className="btn-solid">
                Enter the studio <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/marketplace" className="btn-pill" data-testid="closing-cta-secondary">
                Browse the file
              </Link>
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}

// ————— Landing Side-by-Side Deck Engine —————
export default function Landing() {
  useLenis();
  const [deckIndex, setDeckIndex] = useState(0);

  const slides = [
    { id: "hero", label: "01 · Overview", component: <Hero /> },
    { id: "manifesto", label: "02 · Manifesto", component: <Manifesto /> },
    { id: "work", label: "03 · How It Works", component: <SplitView /> },
    { id: "agencies", label: "04 · Talent Agencies", component: <AgentShowcase /> },
    { id: "portfolio", label: "05 · Selected Work", component: <FeaturedGrid /> },
    { id: "faq", label: "06 · FAQ & Metrics", component: <><FAQ /><Numbers /><ClosingCTA /></> }
  ];

  const prevDeck = () => {
    setDeckIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const nextDeck = () => {
    setDeckIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    document.body.style.background = "#0A0A0A";
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") prevDeck();
      if (e.key === "ArrowRight") nextDeck();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="App bg-[#0A0A0A] text-[#F4F4F0] min-h-screen relative overflow-x-hidden" data-testid="landing-page">
      <div className="grain" />
      <Nav />

      {/* TOP SIDE-BY-SIDE DECK NAVIGATION BAR */}
      <div className="fixed top-20 left-0 right-0 z-40 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-white/10 px-6 py-3 flex items-center justify-between font-mono text-[10px] tracking-widest uppercase">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="opacity-50 mr-2 font-bold text-[#FF3B30]">Studio Deck:</span>
          {slides.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setDeckIndex(idx)}
              className={`px-3 py-1.5 rounded-sm transition-all whitespace-nowrap cursor-pointer ${
                deckIndex === idx
                  ? "bg-[#FF3B30] text-white font-bold shadow-lg"
                  : "bg-white/5 text-white/70 hover:bg-white/15"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="opacity-60 hidden sm:inline">{deckIndex + 1} / {slides.length}</span>
          <button
            type="button"
            onClick={prevDeck}
            aria-label="Previous Slide Deck"
            data-testid="deck-prev-btn"
            className="p-2 bg-white/10 hover:bg-[#FF3B30] border border-white/20 text-white rounded-full transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={nextDeck}
            aria-label="Next Slide Deck"
            data-testid="deck-next-btn"
            className="p-2 bg-white/10 hover:bg-[#FF3B30] border border-white/20 text-white rounded-full transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* FLOATING SIDE-BY-SIDE ARROW BUTTONS (LEFT & RIGHT) */}
      <button
        type="button"
        onClick={prevDeck}
        aria-label="Previous Slide Deck"
        className="fixed left-4 top-1/2 -translate-y-1/2 z-50 p-4 bg-[#0A0A0A]/80 border border-white/20 hover:border-[#FF3B30] hover:bg-[#FF3B30] text-white rounded-full shadow-2xl transition-all duration-300 cursor-pointer hidden md:flex items-center justify-center group"
      >
        <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
      </button>

      <button
        type="button"
        onClick={nextDeck}
        aria-label="Next Slide Deck"
        className="fixed right-4 top-1/2 -translate-y-1/2 z-50 p-4 bg-[#0A0A0A]/80 border border-white/20 hover:border-[#FF3B30] hover:bg-[#FF3B30] text-white rounded-full shadow-2xl transition-all duration-300 cursor-pointer hidden md:flex items-center justify-center group"
      >
        <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
      </button>

      {/* SIDE-BY-SIDE SLIDE DECK STACK CONTAINER */}
      <div className="pt-24 pb-6">
        {/* RESPONSIVE VIEWPORT SLIDE DECK CONTAINER */}
        <div className="relative overflow-hidden w-full min-h-[calc(100vh-200px)] flex items-center">
          <div
            className="flex transition-transform duration-700 ease-out w-full"
            style={{ transform: `translateX(-${deckIndex * 100}%)` }}
          >
            {slides.map((s, idx) => (
              <div 
                key={s.id} 
                className="w-full shrink-0 min-h-[calc(100vh-220px)] max-h-[calc(100vh-140px)] overflow-y-auto no-scrollbar px-2 sm:px-6 md:px-12 flex flex-col justify-center"
              >
                {s.component}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WHITE STRIP MARQUEE AT BOTTOM */}
      <div className="w-full shadow-lg z-30">
        <EditorialMarquee />
      </div>

      <Footer />
    </div>
  );
}
