import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import Marquee from "react-fast-marquee";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowUpRight, ArrowRight, Sparkles, ShieldCheck, Building2, Briefcase, 
  ChevronLeft, ChevronRight, DollarSign, Lock, Zap, Award, CheckCircle2, 
  Target, BarChart3, Headphones, UserCheck, Star, Clock, Check, HelpCircle, Mail 
} from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useLenis } from "@/lib/useLenis";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

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
  const yImg = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);

  return (
    <section
      ref={ref}
      className="theme-keep-dark relative min-h-[100dvh] h-auto md:h-screen overflow-hidden bg-[#050506] flex flex-col"
      data-testid="slide-hero"
    >
      {/* Curtain reveal */}
      <motion.div
        className="absolute inset-0 z-50 pointer-events-none origin-top"
        style={{ background: "#050506" }}
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0 }}
        transition={{ duration: 1.3, ease: [0.76, 0, 0.24, 1], delay: 0.15 }}
      />

      {/* Full-bleed framed background — red beams left/right, clear center lane */}
      <motion.div
        style={{ y: yImg }}
        className="absolute inset-0 z-0"
        initial={{ scale: 1.06, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.55 }}
      >
        <img
          src={`${process.env.PUBLIC_URL}/hero_bg.png`}
          alt=""
          className="w-full h-full object-cover object-center"
        />
        {/* Soft vignette so copy sits in the middle of the beams */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 52% 70% at 50% 46%, rgba(5,5,6,0.78) 0%, rgba(5,5,6,0.42) 48%, rgba(5,5,6,0.18) 72%, transparent 100%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050506] via-transparent to-[#050506]/55" />
      </motion.div>

      {/* Ambient motion — red only (no purple) */}
      <motion.div
        className="absolute pointer-events-none rounded-full z-[1]"
        style={{
          left: "6%",
          top: "18%",
          width: 220,
          height: 220,
          background: "#FF3B30",
          filter: "blur(90px)",
        }}
        animate={{ opacity: [0.04, 0.1, 0.05] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
      />
      <motion.div
        className="absolute pointer-events-none rounded-full z-[1]"
        style={{
          right: "8%",
          top: "22%",
          width: 260,
          height: 260,
          background: "#FF3B30",
          filter: "blur(100px)",
        }}
        animate={{ opacity: [0.03, 0.09, 0.04] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
      />

      {/* Entire hero section centered between the background beams */}
      <div className="relative z-10 flex flex-1 flex-col w-full max-w-[920px] mx-auto px-5 sm:px-8 md:px-10 pt-[88px] pb-10 min-w-0">
        <div className="flex flex-1 flex-col items-center justify-center text-center gap-1 my-auto py-8">
          <motion.h1
            data-testid="hero-brand-logo"
            className="font-sans font-extrabold uppercase tracking-[0.12em] text-[#FF3B30] mb-5 sm:mb-6 select-none"
            style={{ fontSize: "clamp(42px, 8vw, 72px)", lineHeight: 1 }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.0 }}
          >
            FLUGR
          </motion.h1>
          {[
            { text: "The Bridge", className: "text-[#F4F4F0] font-medium" },
            { text: "Between", className: "text-[#F4F4F0] font-medium" },
            { text: "Brands & Influence.", className: "italic text-[#FF3B30] font-normal" },
          ].map((line, i) => (
            <MaskLine key={line.text} delay={1.2 + i * 0.14}>
              <span
                className={`block font-editorial leading-[1.12] tracking-tighter pb-1 ${line.className}`}
                style={{ fontSize: "clamp(34px, 6.2vw, 72px)" }}
              >
                {line.text}
              </span>
            </MaskLine>
          ))}

          <motion.p
            className="mt-5 text-[#F4F4F0]/72 text-[14px] sm:text-[15px] leading-[1.7] max-w-[520px]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.65 }}
          >
            Connect with influencers who move audiences.{" "}
            <span className="text-white font-semibold">Escrow-protected. AI-audited. Results-driven.</span>
          </motion.p>

          <motion.div
            className="flex flex-wrap items-center justify-center gap-3 mt-7"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.85 }}
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
              I&apos;m an Influencer <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>

          <motion.p
            className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#F4F4F0]/50 mt-4 flex items-center justify-center gap-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.05 }}
          >
            <Clock className="w-3 h-3 text-[#FF3B30]" /> Takes 2 minutes. No credit card required.
          </motion.p>
        </div>
      </div>
    </section>
  );
}

{/* Slide 1 Trust Signals Bar */}
function EditorialMarquee() {
  const items = [
    "✓ 50K+ Verified Influencers", "✦", "✓ 500+ Top Brands", "✦",
    "✓ ₹2Cr+ Value Delivered", "✦", "✓ 100% Escrow Protected", "✦",
    "✓ AI Content Audited", "✦", "✓ Direct Relationships", "✦"
  ];
  return (
    <div
      className="theme-keep-dark w-full overflow-hidden border-t border-b"
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
    <section id="quick-value" className="relative text-[#F4F4F0] py-14 md:py-16 overflow-hidden bg-[#0B0B0E]" data-testid="slide-quick-value">
      <div className="relative z-10 max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="hairline-b pb-5 mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
                § Slide 02 · Quick Value
              </span>
              <h2 className="font-editorial text-3xl md:text-5xl mt-1 text-[#F4F4F0]">
                WHY INFLUENCERS &amp; BRANDS <span className="italic text-[#FF3B30]">CHOOSE FLUGR</span>
              </h2>
            </div>
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-50 hidden md:block">
              Immediate Tangible Benefits · Zero Friction
            </span>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* FOR INFLUENCERS */}
          <div className="bg-[#121212]/90 border border-white/15 p-6 md:p-8 rounded-3xl shadow-2xl relative">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
              <span className="font-mono text-[11px] tracking-[0.28em] uppercase text-[#007AFF] font-bold flex items-center gap-2">
                <UserCheck className="w-4 h-4" /> FOR INFLUENCERS:
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
                <p className="font-mono text-xs text-white/60 mt-1">Direct brand relationships with zero agency cuts. Influencers earn ₹87K/month average.</p>
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
                <p className="font-mono text-xs text-white/60 mt-1">Top influencers earn ₹2L+/month with long-term brand retainers and direct repeat briefs.</p>
              </div>
            </div>
          </div>

          {/* FOR BRANDS */}
          <div className="bg-[#121212]/90 border border-white/15 p-6 md:p-8 rounded-3xl shadow-2xl relative">
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
                  ✓ Verified Influencers
                </div>
                <h4 className="font-editorial text-xl font-bold text-white">Real followers, real engagement</h4>
                <p className="font-mono text-xs text-white/60 mt-1">Strict credential checks, bot detection, and verified follower authenticity before any influencer joins your brief.</p>
              </div>

              <div className="p-4 bg-white/[0.03] border border-white/10 hover:border-[#FF3B30]/50 transition-all rounded-xs">
                <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#FF3B30] font-bold mb-1">
                  🎯 Perfect Matches
                </div>
                <h4 className="font-editorial text-xl font-bold text-white">AI finds influencers that actually fit</h4>
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
    body: "flugr is curated. Every brand is briefed, every influencer is credentialed. No open bidding wars, no race to the bottom.",
    means: "Only serious brands. Only serious influencers. Higher quality collaborations."
  },
  {
    n: "02",
    title: "Signal beats scale.",
    body: "We measure attention, not impressions. An influencer with 40,000 devoted followers moves more product than a stadium of tourists.",
    means: "Nano-influencers with high engagement are valued over vanity metrics."
  },
  {
    n: "03",
    title: "Craft is contagious.",
    body: "When brands fund culture instead of clout, work gets better on both sides. flugr exists to keep both parties honest and slightly obsessive.",
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
    <section id="manifesto" className="theme-keep-dark relative text-[#F4F4F0] py-12 md:py-16 overflow-hidden bg-[#0B0B0E]" data-testid="slide-manifesto">
      <div className="relative z-10 max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="pb-6 mb-10 border-b border-white/10">
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
              § Slide 03 · flugr Manifesto
            </span>
            <h2 className="font-editorial text-3xl md:text-5xl mt-1 text-[#F4F4F0]">
              Four Principles <span className="italic text-[#FF3B30]">of Intent</span>
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
      brandTitle: "MEET CURATED INFLUENCERS",
      brandTime: "1 day",
      brandDesc: "AI matches 20+ perfectly suited influencers. Review portfolios, ER, and past work.",
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
      brandDesc: "Receive final deliverables, approve, and release escrow payment to influencer.",
      creatorTitle: "GET PAID + REPEAT",
      creatorTime: "Instant",
      creatorDesc: "Escrow funds released to wallet when brand approves. Build recurring income."
    }
  ];

  return (
    <section id="how-it-works" className="relative text-[#F4F4F0] py-14 md:py-16 bg-[#0B0B0E]" data-testid="slide-how-it-works">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="pb-6 mb-10 border-b border-white/10 flex items-end justify-between">
            <div>
              <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
                § Slide 04 · Journey
              </span>
              <h2 className="font-editorial text-3xl md:text-5xl mt-1">
                HOW IT WORKS <span className="italic">· Two Doors · One Marketplace</span>
              </h2>
            </div>
            <div className="hidden md:flex gap-4 font-mono text-[11px] tracking-[0.2em] uppercase font-bold">
              <span className="text-[#FF3B30]">● For Brand Owners</span>
              <span className="text-[#007AFF]">● For Influencers</span>
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

              {/* Influencer Side */}
              <div className="border-l-2 border-[#007AFF] pl-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#007AFF] font-bold">
                    INFLUENCER STEP {st.num}
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
              <CheckCircle2 className="w-4 h-4 text-[#34C759]" /> Contracts &amp; Deliverables Handled Inside flugr
            </div>
            <p className="text-[11px] opacity-60">Escrow-protected for both sides · Timeline from brief start to payment: 2–3 weeks</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link to="/register/owner" className="btn-solid py-2.5 px-5 text-xs bg-[#FF3B30] text-white hover:bg-[#e03126]">
              I&apos;m a Brand →
            </Link>
            <Link to="/register/influencer" className="btn-solid py-2.5 px-5 text-xs bg-[#007AFF] hover:bg-[#0062cc] text-white">
              I&apos;m an Influencer →
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
      role: "Influencer",
      name: "Arjun Sharma",
      handle: "arjun.creates",
      niche: "Fashion & Style",
      followers: "150K followers",
      photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=400",
      quote: "Joined flugr 3 months ago. Got 5 brand deals in first week. Now I do 2-3 campaigns per month. Direct relationships with brands = way better rates than agencies.",
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
      quote: "Used to work with traditional agencies. Now we use flugr. Direct access to influencers. Better content. Faster turnaround. 40% cost savings on agency overhead.",
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
      quote: "flugr replaced our entire influencer team. Better influencers. Better prices. Zero management overhead. This is the future of digital campaigns.",
      rating: "⭐⭐⭐⭐⭐ (5/5)",
      highlight: "50+ influencers on monthly retainer"
    }
  ];

  return (
    <section id="social-proof" className="relative text-[#F4F4F0] py-14 md:py-16 bg-[#0B0B0E]" data-testid="slide-social-proof">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="pb-6 mb-10 border-b border-white/10">
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
              § Slide 05 · Credibility &amp; Proof
            </span>
            <h2 className="font-editorial text-3xl md:text-5xl mt-1">
              “Trusted by influencers &amp; brands who <span className="italic text-[#FF3B30]">actually move metrics</span>”
            </h2>
          </div>
        </FadeUp>

        {/* Metrics Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 bg-white/[0.02] border border-white/10 p-6 rounded-xs text-center">
          <div>
            <div className="font-editorial text-4xl text-white font-bold">50,000+</div>
            <div className="font-mono text-xs text-[#FF3B30] uppercase tracking-widest font-bold mt-1">INFLUENCERS</div>
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
    img: "https://images.unsplash.com/photo-1700748910941-44f7577b0ba2?auto=format&fit=crop&q=80&w=1200",
    label: "Feature 01",
    title: "Kai Monroe × Studio Noir",
    meta: "EDITORIAL · ₹12L Budget · 5.2M Reach",
    creator: "Influencer: Kai · 200K followers · 4.2% ER"
  },
  {
    img: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=1200",
    label: "Feature 02",
    title: "Bottle No.7 Launch",
    meta: "LUXURY PRODUCT · 3-Day SOLD OUT · 2.1M Reach",
    creator: "Influencer: Emma · 80K followers · 5.8% ER"
  },
  {
    img: "https://images.unsplash.com/photo-1739950839930-ef45c078f316?auto=format&fit=crop&q=80&w=1200",
    label: "Feature 03",
    title: "The Ritual Series",
    meta: "BEAUTY · Long-form · 1.8M Reach",
    creator: "Influencer: Sofia · 120K followers · 4.9% ER"
  },
  {
    img: "https://images.unsplash.com/photo-1700748909753-3d4f58eb8273?auto=format&fit=crop&q=80&w=1200",
    label: "Feature 04",
    title: "Nova Reyes × Fragrance Atlas",
    meta: "FRAGRANCE · ₹15L Budget · 3.8M Reach",
    creator: "Influencer: Reyes · 180K followers · 3.2% ER"
  },
  {
    img: "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&q=80&w=1200",
    label: "Feature 05",
    title: "Aura Skincare Launch",
    meta: "COSMETICS · ₹8L Budget · 1.2M Reach",
    creator: "Influencer: Priya · 60K followers · 6.1% ER"
  },
  {
    img: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=1200",
    label: "Feature 06",
    title: "Urban Vibe Apparel",
    meta: "STREETWEAR · ₹10L Budget · 2.7M Reach",
    creator: "Influencer: Rahul · 95K followers · 5.4% ER"
  },
  {
    img: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=1200",
    label: "Feature 07",
    title: "Arjun Sharma Menswear",
    meta: "FASHION · ₹18L Budget · 4.1M Reach",
    creator: "Influencer: Arjun · 150K followers · 5.2% ER"
  },
  {
    img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=1200",
    label: "Feature 08",
    title: "Zara India Summer Drop",
    meta: "BRAND CAMPAIGN · ₹25L Budget · 6.8M Reach",
    creator: "Influencer: Zara Team · Verified Brand"
  },
  {
    img: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=1200",
    label: "Feature 09",
    title: "HyperTech AI Workstation",
    meta: "TECH & SAAS · ₹20L Budget · 3.4M Reach",
    creator: "Influencer: TechTribe · 310K followers"
  },
  {
    img: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=1200",
    label: "Feature 10",
    title: "Veda Glow Botanical Series",
    meta: "ORGANIC BEAUTY · ₹14L Budget · 2.9M Reach",
    creator: "Influencer: Sneha · 110K followers"
  }
];

function FeaturedGrid() {
  const [stats, setStats] = useState({ influencers: 0, owners: 0, campaigns: 0 });
  useEffect(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const rows = [
    { k: "Influencers on file", v: stats.creators || 22, tail: "Verified, active, trusted" },
    { k: "Brand owners", v: stats.owners || 5, tail: "Launched in last quarter" },
    { k: "Live briefs", v: stats.campaigns || 11, tail: "Campaigns accepting applications" },
    { k: "Signal-to-noise ratio", v: "94%", tail: "Influencers matched successfully / Invites sent" },
  ];

  return (
    <section id="portfolio" className="relative text-[#F4F4F0] py-8 md:py-10 pb-6 bg-[#0B0B0E]" data-testid="slide-portfolio">
      <div className="relative z-10 max-w-[1600px] mx-auto px-6 md:px-10 space-y-8">
        <FadeUp>
          <div className="hairline-b pb-4 flex items-baseline justify-between">
            <div>
              <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
                § Slide 06 · Portfolio &amp; Signal
              </span>
              <h2 className="font-editorial text-2xl md:text-4xl mt-1">
                SELECTED WORK <span className="italic text-[#FF3B30]">SHOWCASE</span>
              </h2>
            </div>
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-50 hidden md:block">Real Campaigns from flugr Influencers (Auto-Expanding Grid)</span>
          </div>
        </FadeUp>

        {/* 5-In-A-Row Auto-Expanding Vibrant Color Campaign Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {FEATURED.map((f, i) => (
            <div key={i} className="group cursor-pointer border border-white/10 hover:border-[#FF3B30]/60 transition-all bg-[#121212] p-3 rounded-xs flex flex-col justify-between">
              <div>
                <div className="relative overflow-hidden rounded-xs" style={{ aspectRatio: '16/10' }}>
                  <img
                    src={f.img}
                    alt={f.title}
                    className="h-full w-full object-cover group-hover:scale-105 transition-all duration-700"
                  />
                  <div className="absolute top-2 left-2 font-mono text-[8px] tracking-[0.2em] uppercase bg-[#0B0B0E]/90 px-2 py-0.5 text-[#F4F4F0] border border-white/10 font-bold">
                    {f.label}
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <h3 className="font-editorial text-base group-hover:text-[#FF3B30] transition-colors leading-snug font-bold text-white">{f.title}</h3>
                  <p className="font-mono text-[9px] text-[#FF3B30] uppercase tracking-wider font-bold">{f.meta}</p>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-white/5 font-mono text-[9px] text-white/60 uppercase tracking-wider">
                {f.creator}
              </div>
            </div>
          ))}
        </div>

        {/* Studio Signal Metrics Table (Matched with Dark Obsidian Aesthetic) */}
        <div className="bg-[#121212] text-[#F4F4F0] border border-white/15 rounded-xs overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">§ FLUGR SIGNAL (Metrics)</span>
            <Link to="/marketplace" className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#34C759] font-bold hover:underline">Browse all completed campaigns →</Link>
          </div>
          {rows.map((r, i) => (
            <div key={i} className={`grid grid-cols-12 items-baseline px-6 py-3.5 ${i < rows.length - 1 ? 'border-b border-white/10' : ''}`}>
              <div className="col-span-1 font-mono text-[10px] tracking-[0.28em] uppercase text-[#FF3B30] font-bold">0{i + 1}</div>
              <div className="col-span-6 md:col-span-7 font-editorial text-lg md:text-xl font-bold text-white">{r.k}</div>
              <div className="col-span-3 md:col-span-2 font-editorial text-xl md:text-2xl italic font-bold text-[#34C759]">{r.v}</div>
              <div className="hidden md:block col-span-2 text-right font-mono text-[9px] tracking-[0.2em] uppercase text-white/50">{r.tail}</div>
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
    <section id="pricing" className="relative text-[#F4F4F0] py-6 md:py-8 bg-[#0B0B0E]" data-testid="slide-pricing">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 space-y-6">
        <FadeUp>
          <div className="pb-4 mb-4 border-b border-white/10">
            <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
              § Slide 07 · Transparent Pricing
            </span>
            <h2 className="font-editorial text-2xl md:text-4xl mt-1">
              PRICING &amp; WHAT YOU&apos;LL <span className="italic text-[#34C759]">ACTUALLY PAY</span>
            </h2>
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FOR INFLUENCERS */}
          <div className="p-6 bg-[#121212] border border-white/15 rounded-xs space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-editorial text-xl text-white font-bold">FOR INFLUENCERS</h3>
              <span className="font-mono text-[9px] text-[#007AFF] bg-[#007AFF]/10 px-2.5 py-0.5 border border-[#007AFF]/30 rounded-xs uppercase font-bold">Influencer Tier</span>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between py-0.5 border-b border-white/5">
                <span className="text-white/60">🎉 SIGNUP:</span>
                <span className="text-[#34C759] font-bold">FREE</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-white/5">
                <span className="text-white/60">🎯 PLATFORM ACCESS:</span>
                <span className="text-[#34C759] font-bold">FREE</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-white/60">🔒 ESCROW SECURITY:</span>
                <span className="text-[#34C759] font-bold">100% Guaranteed</span>
              </div>
            </div>

            <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xs font-mono text-xs space-y-1">
              <div className="text-[#FF3B30] font-bold text-[9px] uppercase tracking-wider">Example Payout:</div>
              <div>You earn <span className="text-white font-bold">₹1,00,000</span> from a campaign</div>
              <div>Platform Fee: <span className="text-[#34C759]">₹0 (100% Free)</span></div>
              <div className="text-[#34C759] font-bold text-xs pt-1 border-t border-white/10">
                You get 100% Full Payout: ₹1,00,000 ✓
              </div>
            </div>

            <ul className="space-y-1 font-mono text-xs text-white/70">
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#34C759] shrink-0" /> Zero platform cuts or hidden deductions</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#34C759] shrink-0" /> Keep 100% of your earned campaign payouts</li>
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
                <span className="text-white/60">🎯 PLATFORM ACCESS:</span>
                <span className="text-[#34C759] font-bold">FREE</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-white/60">🔒 ESCROW SECURITY:</span>
                <span className="text-[#34C759] font-bold">100% Guaranteed</span>
              </div>
            </div>

            <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xs font-mono text-xs space-y-1">
              <div className="text-[#007AFF] font-bold text-[9px] uppercase tracking-wider">Example Campaign:</div>
              <div>Campaign budget: <span className="text-white font-bold">₹1,00,000</span> for 5 influencers</div>
              <div>Platform Fee: <span className="text-[#34C759]">₹0 (100% Free)</span></div>
              <div className="text-[#007AFF] font-bold text-xs pt-1 border-t border-white/10">
                Influencers get 100% Budget: ₹1,00,000 ÷ 5 = ₹20,000 each ✓
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
            <div className="flex items-center gap-1.5"><span className="text-[#34C759] font-bold">✓</span> Influencer &amp; brand verification</div>
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
  { q: "How do I know a campaign is legitimate? (For Influencers)", a: "Every brand on flugr is verified. We vet company registration, check bank details, and review past payment history. Escrow means we hold 100% of funds before you create. You're protected." },
  { q: "What if a brand doesn't approve my deliverables? (For Influencers)", a: "Our dispute team steps in. If the brand request is unreasonable, we release payment to you. If revisions are fair, you have 5 days to resubmit. We protect both sides." },
  { q: "How does influencer matching work? (For Brands)", a: "We use AI to analyze follower demographics, engagement rates, audience overlap, and past campaign performance. Not just follower count — we find influencers whose audiences actually buy." },
  { q: "Can I work with the same influencer multiple times? (For Brands)", a: "Yes! Influencers keep all their contacts from past campaigns. Many brands hire the same influencer 5-10+ times. Direct relationships lead to better work." },
  { q: "What if I have a problem with the other party? (For Both)", a: "Message our support team. Average response time is under 30 minutes. We investigate and mediate. 94% of disputes are resolved in the influencer's favor when claims are valid." },
  { q: "Is my data private & secure? (For Both)", a: "Yes. Bank-level encryption (TLS 1.3), SOC2 Type II compliant. We never sell data. Payment info is processed by Razorpay (PCI-DSS certified)." }
];

function FAQ() {
  return (
    <section id="faq" className="relative text-[#F4F4F0] py-14 md:py-16 bg-[#0B0B0E]" data-testid="slide-faq">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10">
        <FadeUp>
          <div className="flex items-baseline justify-between pb-6 mb-10 border-b border-white/10">
            <div>
              <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
                § Slide 08 · FAQ
              </span>
              <h2 className="font-editorial text-3xl md:text-5xl mt-1">
                Questions? We have <span className="italic text-[#FF3B30]">straightforward answers</span>
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
    <section id="final-cta" className="bg-[#0B0B0E] text-[#F4F4F0] py-20 md:py-28" data-testid="slide-final-cta">
      <div className="max-w-[1600px] mx-auto px-6 md:px-10 text-center space-y-6">
        <FadeUp>
          <span className="font-mono text-[11px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">
            § Slide 09 · Final Conversion
          </span>
          <h2 className="font-editorial text-5xl md:text-7xl font-bold mt-2">
            Ready to Bridge <span className="italic text-[#FF3B30]">the Gap?</span>
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
              I&apos;m an Influencer — Build profile now (2 min setup) <ArrowRight className="w-4 h-4" />
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
   10-SLIDE PRESENTATION SLIDE DECK ENGINE
   ========================================================================= */
export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  useLenis();
  const [deckIndex, setDeckIndex] = useState(0);
  const [autoPaused, setAutoPaused] = useState(false);
  const resumeTimerRef = useRef(null);

  const slides = [
    { id: "hero", component: <><Hero /><EditorialMarquee /><Footer /></> },
    { id: "quick-value", component: <><QuickValue /></> },
    { id: "manifesto", component: <><Manifesto /></> },
    { id: "how-it-works", component: <><HowItWorks /></> },
    { id: "social-proof", component: <><SocialProof /></> },
    { id: "portfolio", component: <><FeaturedGrid /></> },
    { id: "pricing", component: <><PricingSection /></> },
    { id: "faq", component: <><FAQ /></> },
    { id: "final-cta", component: <><FinalCTA /></> },
  ];

  const goToDeck = useCallback((updater) => {
    setDeckIndex((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return ((next % slides.length) + slides.length) % slides.length;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [slides.length]);

  const prevDeck = useCallback(() => {
    goToDeck((prev) => prev - 1);
  }, [goToDeck]);

  const nextDeck = useCallback(() => {
    goToDeck((prev) => prev + 1);
  }, [goToDeck]);

  const pauseAutoThenResume = useCallback(() => {
    setAutoPaused(true);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => setAutoPaused(false), 15000);
  }, []);

  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user) return undefined;
    const handleGlobalClick = () => pauseAutoThenResume();
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [user, pauseAutoThenResume]);

  useEffect(() => {
    if (user) return undefined;
    document.body.style.background = "#0B0B0E";
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        pauseAutoThenResume();
        prevDeck();
      }
      if (e.key === "ArrowRight") {
        pauseAutoThenResume();
        nextDeck();
      }
    };
    const onReset = () => setDeckIndex(0);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resetHomeDeck", onReset);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resetHomeDeck", onReset);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [user, prevDeck, nextDeck, pauseAutoThenResume]);

  // Auto-advance slides; pause briefly after manual navigation
  useEffect(() => {
    if (user || autoPaused) return undefined;
    const id = setInterval(() => {
      nextDeck();
    }, 10000); // auto-advance homepage slides every 10s
    return () => clearInterval(id);
  }, [user, autoPaused, nextDeck, deckIndex]);

  if (user) return null;

  if (user) return null;

  return (
    <div className="App bg-[#0B0B0E] text-[#F4F4F0] min-h-screen relative overflow-x-hidden flex flex-col justify-between" data-testid="landing-page">
      {/* Simple Solid Obsidian Background */}
      <div className="fixed inset-0 pointer-events-none z-0 bg-[#0B0B0E]" />

      <div className="relative z-50">
        <Nav />
      </div>

      {/* FLOATING FAR-LEFT CHEVRON ARROW BUTTON (<) */}
      <button
        type="button"
        onClick={() => {
          pauseAutoThenResume();
          prevDeck();
        }}
        aria-label="Previous Slide"
        data-testid="deck-prev-btn"
        className="fixed left-3 md:left-4 top-1/2 -translate-y-1/2 z-50 w-7 h-7 md:w-8 md:h-8 bg-[#0B0B0E]/80 border border-white/15 hover:border-[#FF3B30] hover:bg-[#FF3B30] text-white rounded-full shadow-lg transition-all duration-300 cursor-pointer flex items-center justify-center group active:scale-95"
      >
        <ChevronLeft className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover:-translate-x-0.5 transition-transform" />
      </button>

      {/* FLOATING FAR-RIGHT CHEVRON ARROW BUTTON (>) */}
      <button
        type="button"
        onClick={() => {
          pauseAutoThenResume();
          nextDeck();
        }}
        aria-label="Next Slide"
        data-testid="deck-next-btn"
        className="fixed right-3 md:right-4 top-1/2 -translate-y-1/2 z-50 w-7 h-7 md:w-8 md:h-8 bg-[#0B0B0E]/80 border border-white/15 hover:border-[#FF3B30] hover:bg-[#FF3B30] text-white rounded-full shadow-lg transition-all duration-300 cursor-pointer flex items-center justify-center group active:scale-95"
      >
        <ChevronRight className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* PRESENTATION SLIDES (Only active slide rendered to ensure zero blank space below footer and unclipped borders) */}
      <div className="pt-16 w-full relative z-10 min-h-[calc(100vh-64px)] flex flex-col justify-between">
        <AnimatePresence mode="wait">
          <motion.div
            key={slides[deckIndex].id}
            initial={{ opacity: 0, x: 25 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -25 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="w-full flex-1 flex flex-col justify-between"
          >
            {slides[deckIndex].component}
          </motion.div>
        </AnimatePresence>
      </div>



    </div>
  );
}
