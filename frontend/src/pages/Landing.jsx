import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Marquee from "react-fast-marquee";
import { Link } from "react-router-dom";
import { 
  ArrowUpRight, ArrowRight, Sparkles, ShieldCheck, Building2, Briefcase, 
  ChevronLeft, ChevronRight, DollarSign, Lock, Zap, Award, CheckCircle2, 
  Target, BarChart3, Headphones, UserCheck, Star, Clock, Check, HelpCircle, Mail 
} from "lucide-react";
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

/* =========================================================================
   SLIDE 01: HERO (Premium + Conversion)
   ========================================================================= */
function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yImg = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);

  return (
    <section ref={ref} className="relative h-screen overflow-hidden bg-[#0A0A0A] flex flex-col justify-between" data-testid="slide-hero">
      {/* 1. Curtain reveal */}
      <motion.div
        className="absolute inset-0 z-50 pointer-events-none origin-top"
        style={{ background: "#0A0A0A" }}
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        transition={{ duration: 1.3, ease: [0.76, 0, 0.24, 1], delay: 0.15 }}
      />

      {/* 2. Full-width background image */}
      <motion.div
        style={{ y: yImg }}
        className="absolute inset-0 z-0"
        initial={{ scale: 1.08, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.6 }}
      >
        <img
          src={`${process.env.PUBLIC_URL}/hero_models_bg.jpg`}
          alt="CR8 Creator Models"
          className="w-full h-full object-cover object-top"
        />
        <div className="absolute inset-0" style={{
          background: "linear-gradient(90deg, #0A0A0A 0%, #0A0A0A 38%, rgba(10,10,10,0.78) 55%, rgba(10,10,10,0.25) 100%)"
        }} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent" />
      </motion.div>

      {/* 3. Subtle Floating Glow Orbs */}
      {[
        { color: "#FF3B30", x: "8%",  y: "30%", size: 240, delay: 1.2 },
        { color: "#7000FF", x: "20%", y: "60%", size: 180, delay: 1.6 },
        { color: "#007AFF", x: "5%",  y: "80%", size: 140, delay: 2.0 },
      ].map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: orb.x, top: orb.y,
            width: orb.size, height: orb.size,
            background: orb.color,
            filter: "blur(80px)",
            opacity: 0,
          }}
          animate={{ opacity: [0, 0.08, 0.04, 0.08] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: orb.delay }}
        />
      ))}

      {/* 4. Left content area */}
      <div className="relative z-10 flex flex-col h-full px-8 md:px-14 pt-[76px] pb-6 justify-between"
        style={{ width: "48%", minWidth: "320px", maxWidth: "620px" }}
      >
        <motion.div
          className="flex items-center justify-between pb-3"
          style={{ borderBottom: "1px solid rgba(244,244,240,0.10)" }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.1 }}
        >
          <span className="font-mono text-[10px] tracking-[0.32em] uppercase text-[#FF3B30] font-bold">CR8 × STUDIO</span>
          <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#F4F4F0]/45 hidden md:inline">⌘ Slide 01 / 09</span>
        </motion.div>

        <div className="flex flex-col justify-center gap-2 my-auto">
          {["The Bridge Between", "Brands & Influence."].map((line, i) => (
            <MaskLine key={line} delay={1.3 + i * 0.18}>
              <span className={`block font-editorial leading-[1.18] tracking-tighter pb-1 ${
                i === 1 ? "italic text-[#FF3B30] font-normal" : "text-[#F4F4F0] font-medium"
              }`}
                style={{ fontSize: "clamp(30px, 4.5vw, 64px)" }}
              >
                {line}{i === 1 && <span className="tick text-[#F4F4F0]" />}
              </span>
            </MaskLine>
          ))}

          <motion.p
            className="mt-4 text-[#F4F4F0]/70 text-[14px] leading-[1.65] max-w-[420px]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.8 }}
          >
            Connect with creators who move audiences. <span className="text-white font-semibold">Escrow-protected. AI-audited. Results-driven.</span>
          </motion.p>

          {/* Color-Coded Dual CTAs (48px height) */}
          <motion.div
            className="flex flex-wrap items-center gap-3 mt-6"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 2.0 }}
          >
            <Link
              to="/register/owner"
              data-testid="hero-cta-brand"
              className="inline-flex items-center justify-center gap-2 px-6 h-[48px] font-mono text-[11px] tracking-[0.22em] uppercase text-white bg-[#FF3B30] hover:bg-[#e03126] transition-all duration-300 shadow-[0_0_24px_rgba(255,59,48,0.4)] rounded-xs font-bold"
            >
              I&apos;m a Brand <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/register/influencer"
              data-testid="hero-cta-creator"
              className="inline-flex items-center justify-center gap-2 px-6 h-[48px] font-mono text-[11px] tracking-[0.22em] uppercase text-white bg-[#007AFF] hover:bg-[#0062cc] transition-all duration-300 shadow-[0_0_24px_rgba(0,122,255,0.4)] rounded-xs font-bold"
            >
              I&apos;m a Creator <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>

          <motion.p
            className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#F4F4F0]/50 mt-3 flex items-center gap-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.2 }}
          >
            <Clock className="w-3 h-3 text-[#FF3B30]" /> ⏱️ Takes 2 minutes. No credit card required.
          </motion.p>
        </div>

        <div className="pt-3 border-t border-white/10">
          <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-[#FF3B30]/70 font-bold">
            ◎ Use floating arrows (&lt; &gt;) or keyboard arrows to navigate slides
          </span>
        </div>
      </div>
    </section>
  );
}

{/* Slide 1 Trust Signals Bar */}
function EditorialMarquee() {
  const items = [
    "✓ 50K+ Verified Creators", "✦", "✓ 500+ Top Brands", "✦",
    "✓ ₹2Cr+ Value Delivered", "✦", "✓ 100% Escrow Protected", "✦",
    "✓ AI Content Audited", "✦", "✓ Direct Relationships", "✦"
  ];
  return (
    <div
      className="w-full overflow-hidden border-t border-b"
      style={{
        background: "#0A0A0A",
        borderColor: "rgba(255,59,48,0.25)",
        padding: "14px 0",
      }}
    >
      <Marquee gradient={false} speed={50}>
        {[...items, ...items].map((item, i) => (
          <span
            key={i}
            className={`font-mono tracking-[0.28em] uppercase px-6 ${
              item === "✦"
                ? "text-[#FF3B30] text-xs"
                : "text-[#F4F4F0]/80 text-[11px] font-bold"
            }`}
          >
            {item}
          </span>
        ))}
      </Marquee>
    </div>
  );
}

/* =========================================================================
   SLIDE 02: QUICK VALUE (Critical for Conversion)
   ========================================================================= */
function QuickValue() {
  return (
    <section id="quick-value" className="relative text-[#F4F4F0] py-14 md:py-16 overflow-hidden bg-[#0A0A0A]" data-testid="slide-quick-value">
      <div className="relative z-10 max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="hairline-b pb-5 mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
                § Slide 02 · Quick Value
              </span>
              <h2 className="font-editorial text-3xl md:text-5xl mt-1 text-[#F4F4F0]">
                WHY CREATORS &amp; BRANDS <span className="italic text-[#FF3B30]">CHOOSE CR8<span className="tick text-[#F4F4F0]">.</span></span>
              </h2>
            </div>
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-50 hidden md:block">
              Immediate Tangible Benefits · Zero Friction
            </span>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* FOR CREATORS */}
          <div className="bg-[#121212]/90 border border-white/15 p-6 md:p-8 rounded-sm shadow-2xl relative">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
              <span className="font-mono text-[11px] tracking-[0.28em] uppercase text-[#007AFF] font-bold flex items-center gap-2">
                <UserCheck className="w-4 h-4" /> FOR CREATORS:
              </span>
              <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#34C759] bg-[#34C759]/10 px-2.5 py-1 border border-[#34C759]/30 rounded-xs font-bold">
                100% Free Signup
              </span>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-white/[0.03] border border-white/10 hover:border-[#007AFF]/50 transition-all rounded-xs">
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#FF3B30] font-bold mb-1">
                  💰 Higher Payouts
                </div>
                <h4 className="font-editorial text-xl font-bold text-white">No middleman = more money in your pocket</h4>
                <p className="font-mono text-xs text-white/60 mt-1">Direct brand relationships with zero agency cuts. Creators earn ₹87K/month average.</p>
              </div>

              <div className="p-4 bg-white/[0.03] border border-white/10 hover:border-[#007AFF]/50 transition-all rounded-xs">
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#34C759] font-bold mb-1">
                  🔒 Secure &amp; Safe
                </div>
                <h4 className="font-editorial text-xl font-bold text-white">Escrow protection gets you paid fairly</h4>
                <p className="font-mono text-xs text-white/60 mt-1">Campaign budget is locked before you post. Payout releases immediately upon milestone approval.</p>
              </div>

              <div className="p-4 bg-white/[0.03] border border-white/10 hover:border-[#007AFF]/50 transition-all rounded-xs">
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#FF9500] font-bold mb-1">
                  ⚡ Fast &amp; Easy
                </div>
                <h4 className="font-editorial text-xl font-bold text-white">Get opportunities within hours</h4>
                <p className="font-mono text-xs text-white/60 mt-1">Receive direct campaign invites and pitch active briefs matched specifically to your niche within 2 hours.</p>
              </div>

              <div className="p-4 bg-white/[0.03] border border-white/10 hover:border-[#007AFF]/50 transition-all rounded-xs">
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#AF52DE] font-bold mb-1">
                  🌟 Grow Your Brand
                </div>
                <h4 className="font-editorial text-xl font-bold text-white">Build portfolio, get recurring clients</h4>
                <p className="font-mono text-xs text-white/60 mt-1">Top creators earn ₹2L+/month with long-term brand retainers and direct repeat briefs.</p>
              </div>
            </div>
          </div>

          {/* FOR BRANDS */}
          <div className="bg-[#121212]/90 border border-white/15 p-6 md:p-8 rounded-sm shadow-2xl relative">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
              <span className="font-mono text-[11px] tracking-[0.28em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
                <Building2 className="w-4 h-4" /> FOR BRANDS:
              </span>
              <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#FF3B30] bg-[#FF3B30]/10 px-2.5 py-1 border border-[#FF3B30]/30 rounded-xs font-bold">
                Post Brief in 3 Mins
              </span>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-white/[0.03] border border-white/10 hover:border-[#FF3B30]/50 transition-all rounded-xs">
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#007AFF] font-bold mb-1">
                  ✓ Verified Creators
                </div>
                <h4 className="font-editorial text-xl font-bold text-white">Real followers, real engagement</h4>
                <p className="font-mono text-xs text-white/60 mt-1">Strict credential checks, bot detection, and verified follower authenticity before any creator joins your brief.</p>
              </div>

              <div className="p-4 bg-white/[0.03] border border-white/10 hover:border-[#FF3B30]/50 transition-all rounded-xs">
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#FF3B30] font-bold mb-1">
                  🎯 Perfect Matches
                </div>
                <h4 className="font-editorial text-xl font-bold text-white">AI finds creators that actually fit</h4>
                <p className="font-mono text-xs text-white/60 mt-1">AI analyzes audience alignment, aesthetic style, and niche intent — not just vanity follower numbers.</p>
              </div>

              <div className="p-4 bg-white/[0.03] border border-white/10 hover:border-[#FF3B30]/50 transition-all rounded-xs">
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#34C759] font-bold mb-1">
                  📊 Results-Driven
                </div>
                <h4 className="font-editorial text-xl font-bold text-white">Proven ROI on every campaign</h4>
                <p className="font-mono text-xs text-white/60 mt-1">Real-time conversion tracking, click-through metrics, reach audits, and detailed sales performance reports.</p>
              </div>

              <div className="p-4 bg-white/[0.03] border border-white/10 hover:border-[#FF3B30]/50 transition-all rounded-xs">
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#FF9500] font-bold mb-1">
                  💼 Support &amp; Setup
                </div>
                <h4 className="font-editorial text-xl font-bold text-white">Handholding from start to finish</h4>
                <p className="font-mono text-xs text-white/60 mt-1">We handle contracts, escrow, compliance audits, and dispute resolution with &lt;2hr support response.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
   SLIDE 03: STUDIO MANIFESTO (With → Means: benefit translation)
   ========================================================================= */
const CHAPTERS_WITH_MEANS = [
  {
    n: "01",
    title: "A studio, not a marketplace.",
    body: "CR8 is curated. Every brand is briefed, every creator is credentialed. No open bidding wars, no race to the bottom.",
    means: "Only serious brands. Only serious creators. Higher quality collaborations."
  },
  {
    n: "02",
    title: "Signal beats scale.",
    body: "We measure attention, not impressions. A creator with 40,000 devoted followers moves more product than a stadium of tourists.",
    means: "Nano-influencers with high engagement are valued over vanity metrics."
  },
  {
    n: "03",
    title: "Craft is contagious.",
    body: "When brands fund culture instead of clout, work gets better on both sides. CR8 exists to keep both parties honest and slightly obsessive.",
    means: "Higher quality content. Better brand storytelling. Real creative partnerships."
  },
  {
    n: "04",
    title: "One handshake, then work.",
    body: "Contracts, briefs, deliverables, timelines — all handled inside the studio. Meet once. Then get on with it.",
    means: "No back-and-forth. No middleman friction. Direct relationship, total clarity."
  }
];

function Manifesto() {
  return (
    <section id="manifesto" className="relative text-[#F4F4F0] py-12 md:py-16 overflow-hidden" style={{
      background: 'linear-gradient(135deg, #0D0221 0%, #0A0A1A 30%, #110D2E 60%, #0D0221 100%)'
    }} data-testid="slide-manifesto">
      <div className="relative z-10 max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="pb-6 mb-10 border-b border-white/10">
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
              § Slide 03 · Studio Manifesto
            </span>
            <h2 className="font-editorial text-3xl md:text-5xl mt-1 text-[#F4F4F0]">
              Four Principles <span className="italic text-[#FF3B30]">of Intent<span className="tick text-[#F4F4F0]">.</span></span>
            </h2>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {CHAPTERS_WITH_MEANS.map((c) => (
            <div key={c.n} className="p-6 md:p-8 flex flex-col justify-between bg-white/[0.04] border border-white/10 backdrop-blur-md rounded-xs hover:border-[#FF3B30]/40 transition-all">
              <div>
                <div className="text-4xl md:text-5xl font-editorial leading-none mb-3">
                  {c.n[0]}<span className="tick text-[#FF3B30]">{c.n[1]}</span>
                </div>
                <h3 className="font-editorial text-xl md:text-2xl leading-[1.2] text-[#F4F4F0] font-bold">
                  {c.title}
                </h3>
                <p className="mt-2.5 font-mono text-xs leading-relaxed text-[#F4F4F0]/70">
                  {c.body}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-white/10 font-mono text-xs text-[#FF3B30] font-bold flex items-start gap-2 bg-[#FF3B30]/5 p-3 rounded-xs">
                <span>→ Means:</span>
                <span className="text-white/90 font-normal">{c.means}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
   SLIDE 04: HOW IT WORKS (Clear Parallel Journey with Timelines)
   ========================================================================= */
function HowItWorks() {
  const steps = [
    {
      num: "01",
      brandTitle: "POST YOUR BRIEF",
      brandTime: "3 minutes",
      brandDesc: "Specify campaign goals, required deliverables, budget range, and timeline.",
      creatorTitle: "BUILD YOUR PROFILE",
      creatorTime: "2 minutes",
      creatorDesc: "Link Instagram/YouTube, set rates, select category & niche. Verified in seconds."
    },
    {
      num: "02",
      brandTitle: "MEET CURATED CREATORS",
      brandTime: "1 day",
      brandDesc: "AI matches 20+ perfectly suited creators. Review portfolios, ER, and past work.",
      creatorTitle: "BROWSE & APPLY",
      creatorTime: "Immediate",
      creatorDesc: "Matching campaigns appear. Send direct pitch or wait for brand invitations."
    },
    {
      num: "03",
      brandTitle: "HIRE & AGREE",
      brandTime: "1 hour",
      brandDesc: "Contract, terms, & approvals handled inside studio. Pay via secure escrow.",
      creatorTitle: "CREATE & SHIP",
      creatorTime: "Deliverables",
      creatorDesc: "Drafts submitted via studio. Brand reviews, approves, or requests quick revisions."
    },
    {
      num: "04",
      brandTitle: "REVIEW & RELEASE PAYMENT",
      brandTime: "1 week",
      brandDesc: "Receive final deliverables, approve, and release escrow payment to creator.",
      creatorTitle: "GET PAID + REPEAT",
      creatorTime: "Instant",
      creatorDesc: "Escrow funds released to wallet when brand approves. Build recurring income."
    }
  ];

  return (
    <section id="how-it-works" className="relative text-[#F4F4F0] py-14 md:py-16 bg-[#0A0A0A]" data-testid="slide-how-it-works">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="pb-6 mb-10 border-b border-white/10 flex items-end justify-between">
            <div>
              <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
                § Slide 04 · Journey
              </span>
              <h2 className="font-editorial text-3xl md:text-5xl mt-1">
                HOW IT WORKS <span className="italic">· Two Doors · One Studio<span className="tick">.</span></span>
              </h2>
            </div>
            <div className="hidden md:flex gap-4 font-mono text-[11px] tracking-[0.2em] uppercase font-bold">
              <span className="text-[#FF3B30]">● For Brand Owners</span>
              <span className="text-[#007AFF]">● For Creators</span>
            </div>
          </div>
        </FadeUp>

        <div className="space-y-4">
          {steps.map((st) => (
            <div key={st.num} className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-[#121212] border border-white/15 p-6 rounded-xs">
              {/* Brand Side */}
              <div className="border-l-2 border-[#FF3B30] pl-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#FF3B30] font-bold">
                    BRAND STEP {st.num}
                  </span>
                  <span className="font-mono text-[9px] uppercase px-2 py-0.5 bg-[#FF3B30]/10 text-white rounded-xs border border-[#FF3B30]/30 font-bold">
                    ⏱️ {st.brandTime}
                  </span>
                </div>
                <h4 className="font-editorial text-xl font-bold text-white">{st.brandTitle}</h4>
                <p className="font-mono text-xs text-white/60 mt-1">{st.brandDesc}</p>
              </div>

              {/* Creator Side */}
              <div className="border-l-2 border-[#007AFF] pl-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#007AFF] font-bold">
                    CREATOR STEP {st.num}
                  </span>
                  <span className="font-mono text-[9px] uppercase px-2 py-0.5 bg-[#007AFF]/10 text-white rounded-xs border border-[#007AFF]/30 font-bold">
                    ⏱️ {st.creatorTime}
                  </span>
                </div>
                <h4 className="font-editorial text-xl font-bold text-white">{st.creatorTitle}</h4>
                <p className="font-mono text-xs text-white/60 mt-1">{st.creatorDesc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTAs at bottom */}
        <div className="mt-8 p-6 bg-[#121212] border border-white/15 rounded-xs flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="font-mono text-xs text-white/70 space-y-1">
            <div className="flex items-center gap-2 text-white font-bold">
              <CheckCircle2 className="w-4 h-4 text-[#34C759]" /> Contracts &amp; Deliverables Handled Inside Studio
            </div>
            <p className="text-[11px] opacity-60">Escrow-protected for both sides · Timeline from brief start to payment: 2–3 weeks</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/register/owner" className="btn-solid py-2.5 px-5 text-xs bg-[#FF3B30] text-white hover:bg-[#e03126]">
              I&apos;m a Brand →
            </Link>
            <Link to="/register/influencer" className="btn-solid py-2.5 px-5 text-xs bg-[#007AFF] hover:bg-[#0062cc] text-white">
              I&apos;m a Creator →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
   SLIDE 05: SOCIAL PROOF & TESTIMONIALS (NEW - Critical for Conversion)
   ========================================================================= */
function SocialProof() {
  const testimonials = [
    {
      role: "Creator",
      name: "Arjun Sharma",
      handle: "@arjun.creates",
      niche: "Fashion & Style",
      followers: "150K followers",
      photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=400",
      quote: "Joined CR8 3 months ago. Got 5 brand deals in first week. Now I do 2-3 campaigns per month. Direct relationships with brands = way better rates than agencies.",
      rating: "⭐⭐⭐⭐⭐ (5/5)",
      highlight: "Earnings this month: ₹2,50,000"
    },
    {
      role: "Brand Owner",
      name: "Zara Fashion India",
      handle: "Fashion Brand",
      niche: "Mumbai, India",
      followers: "Verified Brand",
      photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400",
      quote: "Used to work with traditional agencies. Now we use CR8. Direct access to creators. Better content. Faster turnaround. 40% cost savings on agency overhead.",
      rating: "⭐⭐⭐⭐⭐ (5/5)",
      highlight: "12 successful campaigns this quarter"
    },
    {
      role: "Brand Owner",
      name: "TechTribe India",
      handle: "Tech Brand",
      niche: "Bangalore, India",
      followers: "Verified Enterprise",
      photo: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=400",
      quote: "CR8 replaced our entire influencer team. Better creators. Better prices. Zero management overhead. This is the future of digital campaigns.",
      rating: "⭐⭐⭐⭐⭐ (5/5)",
      highlight: "50+ creators on monthly retainer"
    }
  ];

  return (
    <section id="social-proof" className="relative text-[#F4F4F0] py-14 md:py-16 bg-[#0A0A0A]" data-testid="slide-social-proof">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="pb-6 mb-10 border-b border-white/10">
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
              § Slide 05 · Credibility &amp; Proof
            </span>
            <h2 className="font-editorial text-3xl md:text-5xl mt-1">
              “Trusted by creators &amp; brands who <span className="italic text-[#FF3B30]">actually move metrics<span className="tick text-white">.</span></span>”
            </h2>
          </div>
        </FadeUp>

        {/* Metrics Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 bg-white/[0.02] border border-white/10 p-6 rounded-xs text-center">
          <div>
            <div className="font-editorial text-4xl text-white font-bold">50,000+</div>
            <div className="font-mono text-xs text-[#FF3B30] uppercase tracking-widest font-bold mt-1">CREATORS</div>
            <div className="font-mono text-[10px] text-white/50 uppercase mt-0.5">Verified ✓</div>
          </div>
          <div className="border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0">
            <div className="font-editorial text-4xl text-white font-bold">500+</div>
            <div className="font-mono text-xs text-[#007AFF] uppercase tracking-widest font-bold mt-1">BRANDS</div>
            <div className="font-mono text-[10px] text-white/50 uppercase mt-0.5">Vetting ✓</div>
          </div>
          <div className="border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0">
            <div className="font-editorial text-4xl text-white font-bold">₹2 Crore+</div>
            <div className="font-mono text-xs text-[#34C759] uppercase tracking-widest font-bold mt-1">VALUE DELIVERED</div>
            <div className="font-mono text-[10px] text-white/50 uppercase mt-0.5">Escrow Released ✓</div>
          </div>
        </div>

        {/* Testimonials Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="p-6 bg-[#121212] border border-white/15 rounded-xs flex flex-col justify-between hover:border-[#FF3B30]/40 transition-all">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <img src={t.photo} alt={t.name} className="w-12 h-12 rounded-full object-cover border border-white/20" />
                  <div>
                    <h4 className="font-editorial text-lg text-white font-bold">{t.name}</h4>
                    <p className="font-mono text-[10px] text-white/60 uppercase tracking-wider">{t.handle} · {t.niche}</p>
                  </div>
                </div>

                <p className="font-mono text-xs text-white/80 leading-relaxed italic border-l-2 border-[#FF3B30] pl-3 py-1">
                  &ldquo;{t.quote}&rdquo;
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                <span className="font-mono text-[10px] text-[#FF9500] font-bold">{t.rating}</span>
                <span className="font-mono text-[10px] text-[#34C759] bg-[#34C759]/10 px-2 py-0.5 border border-[#34C759]/30 rounded-xs font-bold">{t.highlight}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
   SLIDE 06: SELECTED WORK & STUDIO SIGNAL
   ========================================================================= */
const FEATURED = [
  {
    img: "https://images.unsplash.com/photo-1700748910941-44f7577b0ba2",
    label: "Feature 01",
    title: "Kai Monroe × Studio Noir",
    meta: "EDITORIAL · ₹12L Budget · 5.2M Reach",
    creator: "Creator: Kai · 200K followers · 4.2% ER"
  },
  {
    img: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=1200",
    label: "Feature 02",
    title: "Bottle No.7 Launch",
    meta: "LUXURY PRODUCT · 3-Day SOLD OUT · 2.1M Reach",
    creator: "Creator: Emma · 80K followers · 5.8% ER"
  },
  {
    img: "https://images.unsplash.com/photo-1739950839930-ef45c078f316",
    label: "Feature 03",
    title: "The Ritual Series",
    meta: "BEAUTY · Long-form · 1.8M Reach",
    creator: "Creator: Sofia · 120K followers · 4.9% ER"
  },
  {
    img: "https://images.unsplash.com/photo-1700748909753-3d4f58eb8273",
    label: "Feature 04",
    title: "Nova Reyes × Fragrance Atlas",
    meta: "FRAGRANCE · ₹15L Budget · 3.8M Reach",
    creator: "Creator: Reyes · 180K followers · 3.2% ER"
  },
  {
    img: "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&q=80&w=1200",
    label: "Feature 05",
    title: "Aura Skincare Launch",
    meta: "COSMETICS · ₹8L Budget · 1.2M Reach",
    creator: "Creator: Priya · 60K followers · 6.1% ER"
  },
  {
    img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=1200",
    label: "Feature 06",
    title: "Urban Vibe Apparel",
    meta: "STREETWEAR · ₹10L Budget · 2.7M Reach",
    creator: "Creator: Rahul · 95K followers · 5.4% ER"
  }
];

function FeaturedGrid() {
  const [stats, setStats] = useState({ creators: 0, owners: 0, campaigns: 0 });
  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const rows = [
    { k: "Creators on file", v: stats.creators || 22, tail: "Verified, active, trusted" },
    { k: "Brand owners", v: stats.owners || 5, tail: "Launched in last quarter" },
    { k: "Live briefs", v: stats.campaigns || 11, tail: "Campaigns accepting applications" },
    { k: "Signal-to-noise ratio", v: "94%", tail: "Creators matched successfully / Invites sent" },
  ];

  return (
    <section id="portfolio" className="relative text-[#F4F4F0] py-12 md:py-16 bg-[#0A0A0A]" data-testid="slide-portfolio">
      <div className="relative z-10 max-w-[1600px] mx-auto px-6 md:px-10 space-y-8">
        <FadeUp>
          <div className="hairline-b pb-4 flex items-baseline justify-between">
            <div>
              <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
                § Slide 06 · Portfolio &amp; Signal
              </span>
              <h2 className="font-editorial text-2xl md:text-4xl mt-1">
                SELECTED WORK <span className="italic">SHOWCASE<span className="tick">.</span></span>
              </h2>
            </div>
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-50 hidden md:block">Real Campaigns from CR8 Creators</span>
          </div>
        </FadeUp>

        {/* Carousel Grid of 6 Campaign Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURED.map((f, i) => (
            <div key={i} className="group cursor-pointer border border-white/10 hover:border-[#FF3B30]/50 transition-all bg-white/[0.02] p-3 rounded-xs">
              <div className="relative overflow-hidden" style={{ aspectRatio: '16/10' }}>
                <img
                  src={f.img}
                  alt={f.title}
                  className="h-full w-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                />
                <div className="absolute top-2 left-2 font-mono text-[8px] tracking-[0.2em] uppercase bg-[#0A0A0A]/90 px-2 py-0.5 text-[#F4F4F0] border border-white/10 font-bold">
                  {f.label}
                </div>
              </div>
              <div className="mt-3 px-1 space-y-1">
                <h3 className="font-editorial text-lg group-hover:text-[#FF3B30] transition-colors leading-snug font-bold">{f.title}</h3>
                <p className="font-mono text-[10px] text-[#FF3B30] uppercase tracking-wider font-bold">{f.meta}</p>
                <p className="font-mono text-[9px] text-white/50 uppercase tracking-wider">{f.creator}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Studio Signal Metrics Table */}
        <div className="bg-[#F4F4F0] text-[#0A0A0A] rounded-xs overflow-hidden">
          <div className="px-6 py-3 border-b border-[#0A0A0A]/10 flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 font-bold">§ STUDIO SIGNAL (Metrics)</span>
            <Link to="/marketplace" className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#FF3B30] font-bold hover:underline">Browse all completed campaigns →</Link>
          </div>
          {rows.map((r, i) => (
            <div key={i} className={`grid grid-cols-12 items-baseline px-6 py-3.5 ${i < rows.length - 1 ? 'border-b border-[#0A0A0A]/10' : ''}`}>
              <div className="col-span-1 font-mono text-[10px] tracking-[0.28em] uppercase opacity-50">0{i + 1}</div>
              <div className="col-span-6 md:col-span-7 font-editorial text-lg md:text-xl font-bold">{r.k}</div>
              <div className="col-span-3 md:col-span-2 font-editorial text-xl md:text-2xl italic font-bold">{r.v}</div>
              <div className="hidden md:block col-span-2 text-right font-mono text-[9px] tracking-[0.2em] uppercase opacity-60">{r.tail}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
   SLIDE 07: PRICING & COSTS (NEW - Critical for Conversion Transparency)
   ========================================================================= */
function PricingSection() {
  return (
    <section id="pricing" className="relative text-[#F4F4F0] py-6 md:py-8 bg-[#0A0A0A]" data-testid="slide-pricing">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 space-y-6">
        <FadeUp>
          <div className="pb-4 mb-4 border-b border-white/10">
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
              § Slide 07 · Transparent Pricing
            </span>
            <h2 className="font-editorial text-2xl md:text-4xl mt-1">
              PRICING &amp; WHAT YOU&apos;LL <span className="italic text-[#34C759]">ACTUALLY PAY<span className="tick text-white">.</span></span>
            </h2>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FOR CREATORS */}
          <div className="p-6 bg-[#121212] border border-white/15 rounded-xs space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-editorial text-xl text-white font-bold">FOR CREATORS</h3>
              <span className="font-mono text-[9px] text-[#007AFF] bg-[#007AFF]/10 px-2.5 py-0.5 border border-[#007AFF]/30 rounded-xs uppercase font-bold">Creator Tier</span>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between py-0.5 border-b border-white/5">
                <span className="text-white/60">🎉 SIGNUP:</span>
                <span className="text-[#34C759] font-bold">FREE</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-white/5">
                <span className="text-white/60">🎯 PLATFORM:</span>
                <span className="text-[#34C759] font-bold">FREE</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-white/60">💰 COMMISSION:</span>
                <span className="text-[#FF3B30] font-bold">13% on completed work</span>
              </div>
            </div>

            <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xs font-mono text-xs space-y-1">
              <div className="text-[#FF3B30] font-bold text-[9px] uppercase tracking-wider">Example Payout:</div>
              <div>You earn <span className="text-white font-bold">₹1,00,000</span> from a campaign</div>
              <div>We take <span className="text-white/60">₹13,000 (13%)</span></div>
              <div className="text-[#34C759] font-bold text-xs pt-1 border-t border-white/10">
                You get ₹87,000 ✓
              </div>
            </div>

            <ul className="space-y-1 font-mono text-xs text-white/70">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#34C759] shrink-0" /> Way better than agency cuts (typically 20–30%)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#34C759] shrink-0" /> You only pay if you earn</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#34C759] shrink-0" /> We handle contracts, disputes, &amp; escrow collections</li>
            </ul>
          </div>

          {/* FOR BRANDS */}
          <div className="p-6 bg-[#121212] border border-white/15 rounded-xs space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-editorial text-xl text-white font-bold">FOR BRANDS</h3>
              <span className="font-mono text-[9px] text-[#FF3B30] bg-[#FF3B30]/10 px-2.5 py-0.5 border border-[#FF3B30]/30 rounded-xs uppercase font-bold">Brand Tier</span>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between py-0.5 border-b border-white/5">
                <span className="text-white/60">🎉 SIGNUP:</span>
                <span className="text-[#34C759] font-bold">FREE</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-white/5">
                <span className="text-white/60">🎯 PLATFORM:</span>
                <span className="text-[#34C759] font-bold">FREE</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-white/60">💰 COMMISSION:</span>
                <span className="text-[#FF3B30] font-bold">13% on total spend</span>
              </div>
            </div>

            <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xs font-mono text-xs space-y-1">
              <div className="text-[#007AFF] font-bold text-[9px] uppercase tracking-wider">Example Campaign:</div>
              <div>Campaign budget: <span className="text-white font-bold">₹1,00,000</span> for 5 creators</div>
              <div>Total fee to us: <span className="text-white/60">₹13,000 (13%)</span></div>
              <div className="text-[#007AFF] font-bold text-xs pt-1 border-t border-white/10">
                Creators get: ₹87,000 ÷ 5 = ₹17,400 each
              </div>
            </div>

            <ul className="space-y-1 font-mono text-xs text-white/70">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#34C759] shrink-0" /> All-inclusive (no hidden platform fees)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#34C759] shrink-0" /> Contracts, AI matching, &amp; dispute support included</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#34C759] shrink-0" /> Faster than agencies (2–3 weeks vs 6–8 weeks)</li>
            </ul>
          </div>
        </div>

        {/* WHAT'S INCLUDED (Both Sides) — Clean grid with zero text overlap */}
        <div className="p-5 bg-[#121212] border border-white/15 rounded-xs space-y-3">
          <h4 className="font-editorial text-lg text-white font-bold border-b border-white/10 pb-2">WHAT&apos;S INCLUDED (Both Sides):</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4 font-mono text-xs text-white/90 leading-normal">
            <div className="flex items-center gap-1.5"><span className="text-[#34C759] font-bold">✓</span> Platform access (unlimited briefs)</div>
            <div className="flex items-center gap-1.5"><span className="text-[#34C759] font-bold">✓</span> Escrow payment protection</div>
            <div className="flex items-center gap-1.5"><span className="text-[#34C759] font-bold">✓</span> Creator &amp; brand verification</div>
            <div className="flex items-center gap-1.5"><span className="text-[#34C759] font-bold">✓</span> AI content compliance audit</div>
            <div className="flex items-center gap-1.5"><span className="text-[#34C759] font-bold">✓</span> Automated contract templating</div>
            <div className="flex items-center gap-1.5"><span className="text-[#34C759] font-bold">✓</span> Dispute resolution (&lt;2hr support)</div>
            <div className="flex items-center gap-1.5"><span className="text-[#34C759] font-bold">✓</span> Direct studio messaging</div>
            <div className="flex items-center gap-1.5"><span className="text-[#34C759] font-bold">✓</span> Performance &amp; ROI tracking</div>
            <div className="flex items-center gap-1.5"><span className="text-[#34C759] font-bold">✓</span> Verified ratings &amp; reviews</div>
          </div>
          <div className="pt-2 border-t border-white/10 text-center font-mono text-[10px] text-[#FF3B30] font-bold tracking-[0.25em] uppercase">
            NO HIDDEN FEES, EVER.
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================================
   SLIDE 08: FAQ (Objection Handling)
   ========================================================================= */
const EXPANDED_FAQS = [
  { q: "How do I know a campaign is legitimate? (For Creators)", a: "Every brand on CR8 is verified. We vet company registration, check bank details, and review past payment history. Escrow means we hold 100% of funds before you create. You're protected." },
  { q: "What if a brand doesn't approve my deliverables? (For Creators)", a: "Our dispute team steps in. If the brand request is unreasonable, we release payment to you. If revisions are fair, you have 5 days to resubmit. We protect both sides." },
  { q: "How does creator matching work? (For Brands)", a: "We use AI to analyze follower demographics, engagement rates, audience overlap, and past campaign performance. Not just follower count — we find creators whose audiences actually buy." },
  { q: "Can I work with the same creator multiple times? (For Brands)", a: "Yes! Creators keep all their contacts from past campaigns. Many brands hire the same creator 5-10+ times. Direct relationships lead to better work." },
  { q: "What if I have a problem with the other party? (For Both)", a: "Message our support team. Average response time is under 30 minutes. We investigate and mediate. 94% of disputes are resolved in the creator's favor when claims are valid." },
  { q: "Is my data private & secure? (For Both)", a: "Yes. Bank-level encryption (TLS 1.3), SOC2 Type II compliant. We never sell data. Payment info is processed by Razorpay (PCI-DSS certified)." }
];

function FAQ() {
  return (
    <section id="faq" className="relative text-[#F4F4F0] py-14 md:py-16 bg-[#0A0A0A]" data-testid="slide-faq">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="flex items-baseline justify-between pb-6 mb-10 border-b border-white/10">
            <div>
              <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
                § Slide 08 · FAQ
              </span>
              <h2 className="font-editorial text-3xl md:text-5xl mt-1">
                Questions? We have <span className="italic text-[#FF3B30]">straightforward answers<span className="tick text-white">.</span></span>
              </h2>
            </div>
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#FF3B30]/70 font-bold hidden md:block">
              Support Response: &lt; 2 hours
            </span>
          </div>
        </FadeUp>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {EXPANDED_FAQS.map((faq, i) => (
            <FadeUp key={faq.q} delay={i * 0.05}>
              <div className="space-y-3 p-6 bg-[#121212] border border-white/15 rounded-xs hover:border-[#FF3B30]/40 transition-all">
                <div className="text-[#FF3B30] font-mono text-[10px] tracking-[0.3em] uppercase font-bold">Q0{i+1}</div>
                <h4 className="font-editorial text-xl leading-tight text-[#F4F4F0] font-bold">{faq.q}</h4>
                <p className="font-mono text-xs text-[#F4F4F0]/60 leading-relaxed">
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

/* =========================================================================
   SLIDE 09: FINAL CONVERSION CTA
   ========================================================================= */
function FinalCTA() {
  return (
    <section id="final-cta" className="bg-[#0A0A0A] text-[#F4F4F0] py-20 md:py-28" data-testid="slide-final-cta">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 text-center space-y-6">
        <FadeUp>
          <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
            § Slide 09 · Final Conversion
          </span>
          <h2 className="font-editorial text-5xl md:text-7xl font-bold mt-2">
            Ready to Bridge <span className="italic text-[#FF3B30]">the Gap?<span className="tick text-white">.</span></span>
          </h2>
        </FadeUp>

        <FadeUp delay={0.2}>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              to="/register/owner"
              data-testid="final-cta-brand"
              className="inline-flex items-center justify-center gap-2 px-8 h-[52px] font-mono text-[11px] tracking-[0.22em] uppercase text-white bg-[#FF3B30] hover:bg-[#e03126] transition-all rounded-xs font-bold shadow-[0_0_24px_rgba(255,59,48,0.4)]"
            >
              I&apos;m a Brand — Post brief now (3 min setup) <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/register/influencer"
              data-testid="final-cta-creator"
              className="inline-flex items-center justify-center gap-2 px-8 h-[52px] font-mono text-[11px] tracking-[0.22em] uppercase text-white bg-[#007AFF] hover:bg-[#0062cc] transition-all rounded-xs font-bold shadow-[0_0_24px_rgba(0,122,255,0.4)]"
            >
              I&apos;m a Creator — Build profile now (2 min setup) <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </FadeUp>

        <FadeUp delay={0.3}>
          <p className="font-mono text-xs text-white/50 tracking-wider uppercase pt-2">
            ⏱️ Takes 2 minutes. No credit card. No commitment. Start working within 24 hours.
          </p>
          <div className="pt-2 font-mono text-xs">
            Already have an account? <Link to="/login" className="text-[#FF3B30] hover:underline font-bold">Sign In →</Link>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}

/* =========================================================================
   SLIDE 10: EXPANDED FOOTER
   ========================================================================= */
function ExpandedFooter() {
  return (
    <footer className="bg-[#050505] text-[#F4F4F0] pt-16 pb-12 border-t border-white/10 font-mono" data-testid="slide-footer">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-white/10">
        <div>
          <div className="font-editorial text-3xl font-bold mb-3">CR8 <span className="italic text-[#FF3B30]">STUDIO</span></div>
          <p className="text-xs text-white/60 leading-relaxed max-w-xs">
            “The studio for creators who move markets.” Connecting elite brands with verified creators through AI matching and escrow protection.
          </p>
        </div>

        <div>
          <h4 className="text-xs tracking-[0.25em] uppercase text-[#FF3B30] font-bold mb-4">GET STARTED</h4>
          <ul className="space-y-2 text-xs text-white/70">
            <li><Link to="/register/owner" className="hover:text-white">For Brands</Link></li>
            <li><Link to="/register/influencer" className="hover:text-white">For Creators</Link></li>
            <li><Link to="/marketplace" className="hover:text-white">Marketplace Briefs</Link></li>
            <li><Link to="/register/agent" className="hover:text-white">Talent Agencies</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs tracking-[0.25em] uppercase text-[#FF3B30] font-bold mb-4">COMPANY</h4>
          <ul className="space-y-2 text-xs text-white/70">
            <li><a href="#manifesto" className="hover:text-white">Studio Manifesto</a></li>
            <li><a href="#pricing" className="hover:text-white">Transparent Pricing</a></li>
            <li><a href="#social-proof" className="hover:text-white">Case Studies</a></li>
            <li><a href="#faq" className="hover:text-white">FAQ &amp; Support</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs tracking-[0.25em] uppercase text-[#FF3B30] font-bold mb-4">NEWSLETTER</h4>
          <p className="text-xs text-white/60 mb-3">Get weekly creator insights &amp; brand strategy.</p>
          <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
            <input type="email" placeholder="enter email..." className="px-3 py-2 bg-white/5 border border-white/20 text-xs text-white rounded-xs focus:outline-none focus:border-[#FF3B30]" />
            <button type="submit" className="px-3 py-2 bg-[#FF3B30] text-white text-xs uppercase font-bold rounded-xs">Join</button>
          </form>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 md:px-10 pt-6 flex flex-wrap items-center justify-between text-xs text-white/40 gap-4">
        <div>© 2026 CR8 Studio. All rights reserved.</div>
        <div className="flex gap-6">
          <Link to="/privacy" className="hover:text-white">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-white">Terms of Service</Link>
          <Link to="/cookies" className="hover:text-white">Cookies</Link>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto mt-6 pt-6 border-t border-white/5 flex items-center justify-center">
        <a
          href="https://palramai.in"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 select-none"
          style={{ textDecoration: 'none' }}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF3B30] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF3B30]" />
          </span>
          <span className="font-mono text-[11px] tracking-[0.35em] uppercase text-[#F4F4F0]/40 group-hover:text-[#F4F4F0]/70 transition-colors duration-500">
            Crafted with precision by
          </span>
          <span
            className="font-editorial italic text-xl md:text-2xl tracking-tight transition-all duration-500 group-hover:scale-105"
            style={{
              background: 'linear-gradient(90deg, #FF3B30, #FF9500, #FF3B30, #7000FF, #FF3B30)',
              backgroundSize: '300% 100%',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              animation: 'shimmer 4s linear infinite',
            }}
          >
            palramai.in
          </span>
          <span className="text-[#FF3B30]/60 group-hover:text-[#FF3B30] group-hover:translate-x-1 transition-all duration-300 font-mono text-xs">
            ↗
          </span>
        </a>
      </div>
    </footer>
  );
}

/* =========================================================================
   10-SLIDE PRESENTATION SLIDE DECK ENGINE
   ========================================================================= */
export default function Landing() {
  useLenis();
  const [deckIndex, setDeckIndex] = useState(0);

  const slides = [
    { id: "hero", component: <><Hero /><EditorialMarquee /></> },
    { id: "quick-value", component: <QuickValue /> },
    { id: "manifesto", component: <Manifesto /> },
    { id: "how-it-works", component: <HowItWorks /> },
    { id: "social-proof", component: <SocialProof /> },
    { id: "portfolio", component: <FeaturedGrid /> },
    { id: "pricing", component: <PricingSection /> },
    { id: "faq", component: <FAQ /> },
    { id: "final-cta", component: <><FinalCTA /><ExpandedFooter /></> },
  ];

  const prevDeck = () => {
    setDeckIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const nextDeck = () => {
    setDeckIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    document.body.style.background = "#0B0B0E";
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") prevDeck();
      if (e.key === "ArrowRight") nextDeck();
    };
    const onReset = () => setDeckIndex(0);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resetHomeDeck", onReset);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resetHomeDeck", onReset);
    };
  }, []);

  return (
    <div className="App bg-[#0B0B0E] text-[#F4F4F0] min-h-screen relative overflow-x-hidden flex flex-col justify-between" data-testid="landing-page">
      {/* Multi-Layer Ambient Lighting Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div 
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-5 blur-3xl" 
          style={{ background: "radial-gradient(circle, #FF3B30 0%, #7000FF 45%, transparent 75%)" }}
        />
        <div 
          className="absolute top-1/3 -left-40 w-[600px] h-[600px] rounded-full opacity-5 blur-3xl" 
          style={{ background: "radial-gradient(circle, #FF9500 0%, #FF3B30 60%, transparent 75%)" }}
        />
        <div 
          className="absolute bottom-10 right-10 w-[700px] h-[700px] rounded-full opacity-5 blur-3xl" 
          style={{ background: "radial-gradient(circle, #34C759 0%, #007AFF 55%, transparent 75%)" }}
        />
        <div className="grain" />
      </div>

      <div className="relative z-50">
        <Nav />
      </div>

      {/* FLOATING FAR-LEFT CHEVRON ARROW BUTTON (<) */}
      <button
        type="button"
        onClick={prevDeck}
        aria-label="Previous Slide"
        data-testid="deck-prev-btn"
        className="fixed left-4 md:left-6 top-1/2 -translate-y-1/2 z-50 w-11 h-11 md:w-13 md:h-13 bg-[#0A0A0A]/90 border border-white/20 hover:border-[#FF3B30] hover:bg-[#FF3B30] text-white rounded-full shadow-2xl transition-all duration-300 cursor-pointer flex items-center justify-center group active:scale-95"
      >
        <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 group-hover:-translate-x-0.5 transition-transform" />
      </button>

      {/* FLOATING FAR-RIGHT CHEVRON ARROW BUTTON (>) */}
      <button
        type="button"
        onClick={nextDeck}
        aria-label="Next Slide"
        data-testid="deck-next-btn"
        className="fixed right-4 md:right-6 top-1/2 -translate-y-1/2 z-50 w-11 h-11 md:w-13 md:h-13 bg-[#0A0A0A]/90 border border-white/20 hover:border-[#FF3B30] hover:bg-[#FF3B30] text-white rounded-full shadow-2xl transition-all duration-300 cursor-pointer flex items-center justify-center group active:scale-95"
      >
        <ChevronRight className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* HORIZONTAL SIDE-BY-SIDE PRESENTATION SLIDE DECK CONTAINER */}
      <div className="pt-16 w-full flex-1 relative z-10 overflow-hidden">
        <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden">
          <div
            className="flex transition-transform duration-700 ease-out w-full h-full"
            style={{ transform: `translateX(-${deckIndex * 100}%)` }}
          >
            {slides.map((s) => (
              <div 
                key={s.id} 
                className="w-full h-full shrink-0 overflow-hidden flex flex-col justify-start"
              >
                <div className="w-full h-full overflow-y-auto">
                  {s.component}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
