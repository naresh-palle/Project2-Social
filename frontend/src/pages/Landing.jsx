import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Marquee from "react-fast-marquee";
import { Link } from "react-router-dom";
import { ArrowUpRight, ArrowRight, Sparkles, ShieldCheck, Building2, Briefcase } from "lucide-react";
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

// ————— Manifesto —————
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
  return (
    <section id="manifesto" className="paper bg-[#F4F4F0] text-[#0A0A0A] py-24 md:py-40">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="flex items-baseline justify-between hairline-b pb-6 mb-16">
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
              § Manifesto
            </span>
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
              Four chapters
            </span>
          </div>
        </FadeUp>

        <div className="space-y-24 md:space-y-32">
          {CHAPTERS.map((c, i) => {
            const alignRight = i % 2 === 1;
            return (
              <div
                key={c.n}
                className="grid grid-cols-12 gap-6 md:gap-10 items-end"
              >
                <FadeUp
                  className={`col-span-12 md:col-span-4 ${
                    alignRight ? "md:col-start-9 md:order-2" : ""
                  }`}
                >
                  <div className="chapter-num text-[24vw] md:text-[14vw] text-[#0A0A0A] leading-[1.15]">
                    {c.n[0]}
                    <span className="tick not-italic">{c.n[1]}</span>
                  </div>
                </FadeUp>
                <FadeUp
                  delay={0.15}
                  className={`col-span-12 md:col-span-7 ${
                    alignRight ? "md:col-start-1 md:order-1" : "md:col-start-6"
                  }`}
                >
                  <h3 className="font-editorial text-4xl md:text-6xl leading-[1.1] tracking-tight">
                    {c.title}
                  </h3>
                  <p className="mt-6 max-w-md text-base md:text-lg leading-relaxed text-[#0A0A0A]/75">
                    {c.body}
                  </p>
                </FadeUp>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ————— Split (Owners vs Agents vs Influencers) —————
function SplitView() {
  const [hover, setHover] = useState(null);

  return (
    <section id="work" className="bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 pt-24 pb-6">
        <FadeUp>
          <div className="flex items-baseline justify-between hairline-b pb-6">
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
              § How it works
            </span>
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
              Three doors · one studio
            </span>
          </div>
        </FadeUp>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 md:px-10 pb-16 pt-6 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[520px]">
        {/* Door 1: Brand Owners */}
        <motion.div
          onHoverStart={() => setHover("owner")}
          onHoverEnd={() => setHover(null)}
          whileHover={{ y: -4 }}
          transition={{ duration: 0.4 }}
          className="relative hairline-r hairline-l hairline-b hairline-t p-8 md:p-10 flex flex-col justify-between overflow-hidden bg-[#0D0D0D] border border-white/10 hover:border-[#FF3B30]/40 transition-colors"
          data-testid="split-owners"
        >
          <div>
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30]">
              01 — For the owners
            </span>
            <h3 className="font-editorial text-4xl md:text-5xl mt-4 leading-[1.1]">
              Post your brief.
              <br />
              <span className="italic">Meet the mavericks.</span>
            </h3>
          </div>
          <ul className="mt-8 font-mono text-[11px] tracking-[0.15em] uppercase space-y-3 opacity-80">
            <li><span className="tick">01 —</span> Brief in under 3 minutes</li>
            <li><span className="tick">02 —</span> Receive curated applications</li>
            <li><span className="tick">03 —</span> Contract, deliver, ship</li>
          </ul>
          <Link
            to="/register/owner"
            data-testid="split-owner-cta"
            className="btn-pill mt-8 self-start"
          >
            I&apos;m an owner <ArrowUpRight className="w-4 h-4" />
          </Link>
          <div
            className="absolute -right-24 -bottom-24 h-[320px] w-[320px] rounded-full opacity-[0.06] blur-2xl"
            style={{ background: "radial-gradient(circle, #FF3B30 0%, transparent 60%)" }}
          />
        </motion.div>

        {/* Door 2: Talent Agents */}
        <motion.div
          onHoverStart={() => setHover("agent")}
          onHoverEnd={() => setHover(null)}
          whileHover={{ y: -4 }}
          transition={{ duration: 0.4 }}
          className="relative hairline-r hairline-l hairline-b hairline-t p-8 md:p-10 flex flex-col justify-between overflow-hidden bg-[#121212] border border-[#FF3B30]/30 hover:border-[#FF3B30] transition-colors"
          data-testid="split-agents"
        >
          <div>
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30]">
              02 — For Talent Agents
            </span>
            <h3 className="font-editorial text-4xl md:text-5xl mt-4 leading-[1.1]">
              Manage your roster.
              <br />
              <span className="italic">Scale agency deals.</span>
            </h3>
          </div>
          <ul className="mt-8 font-mono text-[11px] tracking-[0.15em] uppercase space-y-3 opacity-80">
            <li><span className="tick">01 —</span> Represent 50+ creators</li>
            <li><span className="tick">02 —</span> AI Pitch &amp; auto-contracting</li>
            <li><span className="tick">03 —</span> Verified escrow payouts</li>
          </ul>
          <Link
            to="/register/agent"
            data-testid="split-agent-cta"
            className="btn-solid mt-8 self-start bg-[#FF3B30] text-white hover:bg-[#e03126]"
          >
            I&apos;m an agent <ArrowUpRight className="w-4 h-4" />
          </Link>
        </motion.div>

        {/* Door 3: Influencers */}
        <motion.div
          onHoverStart={() => setHover("influencer")}
          onHoverEnd={() => setHover(null)}
          whileHover={{ y: -4 }}
          transition={{ duration: 0.4 }}
          className="relative bg-[#F4F4F0] text-[#0A0A0A] paper p-8 md:p-10 flex flex-col justify-between overflow-hidden hairline-b"
          data-testid="split-influencers"
        >
          <div>
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
              03 — For the creators
            </span>
            <h3 className="font-editorial text-4xl md:text-5xl mt-4 leading-[1.1]">
              Build a body of work
              <br />
              <span className="italic">worth signing.</span>
            </h3>
          </div>
          <ul className="mt-8 font-mono text-[11px] tracking-[0.15em] uppercase space-y-3">
            <li><span className="tick">01 —</span> Curated invites only</li>
            <li><span className="tick">02 —</span> Pitch on your terms</li>
            <li><span className="tick">03 —</span> Get paid, keep credit</li>
          </ul>
          <Link
            to="/register/influencer"
            data-testid="split-influencer-cta"
            className="btn-pill mt-8 self-start text-[#0A0A0A]"
          >
            I&apos;m a creator <ArrowUpRight className="w-4 h-4" />
          </Link>
        </motion.div>
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

// ————— Featured Grid —————
const FEATURED = [
  {
    span: "md:col-span-6",
    img: "https://images.unsplash.com/photo-1700748910941-44f7577b0ba2",
    label: "Feature 01",
    title: "Kai Monroe × Studio Noir",
    meta: "Fashion Editorial · 512K",
  },
  {
    span: "md:col-span-6",
    img: "https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd",
    label: "Feature 02",
    title: "Bottle No.7 launch",
    meta: "Luxury Product · 3-day sold out",
  },
  {
    span: "md:col-span-6",
    img: "https://images.unsplash.com/photo-1739950839930-ef45c078f316",
    label: "Feature 03",
    title: "The Ritual Series",
    meta: "Beauty · Long-form",
  },
  {
    span: "md:col-span-6",
    img: "https://images.unsplash.com/photo-1700748909753-3d4f58eb8273",
    label: "Feature 04",
    title: "Nova Reyes × Fragrance Atlas",
    meta: "Fragrance · Editorial",
  },
];

function FeaturedGrid() {
  return (
    <section className="bg-[#0A0A0A] text-[#F4F4F0] py-24 md:py-32">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="flex items-baseline justify-between hairline-b pb-6 mb-14">
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
              § Selected work
            </span>
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
              2025 file
            </span>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10">
          {FEATURED.map((f, i) => (
            <FadeUp key={i} delay={i * 0.06} className={f.span}>
              <figure className="group relative overflow-hidden">
                <div className="relative overflow-hidden aspect-[4/5]">
                  <motion.img
                    src={f.img}
                    alt={f.title}
                    className="h-full w-full object-cover"
                    initial={{ scale: 1.06 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }}
                  />
                  <div className="absolute inset-0 bg-[#0A0A0A]/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-x-0 bottom-0 p-5 md:p-6 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500">
                    <span className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-70">
                      {f.label}
                    </span>
                    <div className="font-editorial text-2xl md:text-3xl mt-1">{f.title}</div>
                  </div>
                </div>
                <figcaption className="flex items-baseline justify-between mt-3 font-mono text-[11px] tracking-[0.2em] uppercase opacity-70">
                  <span>{f.title}</span>
                  <span>{f.meta}</span>
                </figcaption>
              </figure>
            </FadeUp>
          ))}
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

// ————— Landing —————
export default function Landing() {
  useLenis();
  useEffect(() => {
    document.body.style.background = "#0A0A0A";
  }, []);

  return (
    <div className="App bg-[#0A0A0A] text-[#F4F4F0]" data-testid="landing-page">
      <div className="grain" />
      <Nav />
      <Hero />
      <EditorialMarquee />
      <Manifesto />
      <SplitView />
      <AgentShowcase />
      <FeaturedGrid />
      <FAQ />
      <Numbers />
      <ClosingCTA />
      <Footer />
    </div>
  );
}
