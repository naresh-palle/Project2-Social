import { Link } from "react-router-dom";

/** Shared site footer — matches the Homepage ExpandedFooter. */
export function Footer() {
  return (
    <footer
      className="bg-[#050505] text-[#F4F4F0] pt-16 pb-16 border-t border-white/10 font-mono relative z-10"
      data-testid="site-footer"
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 pb-12 border-b border-white/10">
        <div>
          <div className="font-editorial text-3xl font-bold mb-3 italic">
            flugr
          </div>
          <p className="text-xs text-white/60 leading-relaxed max-w-xs">
            “The studio for influencers who move markets.” Connecting elite brands with verified influencers through AI matching and escrow protection.
          </p>
        </div>

        <div>
          <h4 className="text-xs tracking-[0.25em] uppercase text-[#FF3B30] font-bold mb-4">GET STARTED</h4>
          <ul className="space-y-2 text-xs text-white/70">
            <li><Link to="/register/owner" className="hover:text-white">For Brands</Link></li>
            <li><Link to="/register/influencer" className="hover:text-white">For Influencers</Link></li>
            <li><Link to="/marketplace" className="hover:text-white">Marketplace Briefs</Link></li>
            <li><Link to="/register/agent" className="hover:text-white">Talent Agencies</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs tracking-[0.25em] uppercase text-[#FF3B30] font-bold mb-4">COMPANY</h4>
          <ul className="space-y-2 text-xs text-white/70">
            <li><Link to="/" className="hover:text-white">flugr Manifesto</Link></li>
            <li><Link to="/" className="hover:text-white">Transparent Pricing</Link></li>
            <li><Link to="/" className="hover:text-white">Case Studies</Link></li>
            <li><Link to="/" className="hover:text-white">FAQ &amp; Support</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs tracking-[0.25em] uppercase text-[#FF3B30] font-bold mb-4">NEWSLETTER</h4>
          <p className="text-xs text-white/60 mb-3">Get weekly influencer insights &amp; brand strategy.</p>
          <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
            <input
              type="email"
              placeholder="you@brand.com"
              aria-label="Email for newsletter"
              className="px-3 py-2 bg-white/5 border border-white/20 text-xs text-white rounded-xs focus:outline-none focus:border-[#FF3B30] flex-1 min-w-0"
            />
            <button type="submit" className="px-3 py-2 bg-[#FF3B30] text-white text-xs uppercase font-bold rounded-xs shrink-0">
              Join
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 md:px-10 pt-6 flex flex-wrap items-center justify-between text-xs text-white/40 gap-4">
        <div>© {new Date().getFullYear()} flugr. All rights reserved.</div>
        <div className="flex gap-6">
          <Link to="/legal/privacy" className="hover:text-white">Privacy Policy</Link>
          <Link to="/legal/terms" className="hover:text-white">Terms of Service</Link>
          <Link to="/legal/cookies" className="hover:text-white">Cookies</Link>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto mt-6 pt-6 border-t border-white/5 flex items-center justify-center px-6">
        <a
          href="https://palramai.in"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 select-none"
          style={{ textDecoration: "none" }}
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
              background: "linear-gradient(90deg, #FF3B30, #FF9500, #FF3B30, #7000FF, #FF3B30)",
              backgroundSize: "300% 100%",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              animation: "cr8-footer-shimmer 4s linear infinite",
            }}
          >
            palramai.in
          </span>
          <span className="text-[#FF3B30]/60 group-hover:text-[#FF3B30] group-hover:translate-x-1 transition-all duration-300 font-mono text-xs">
            ↗
          </span>
        </a>
      </div>

      <style>{`
        @keyframes cr8-footer-shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
      `}</style>
    </footer>
  );
}
