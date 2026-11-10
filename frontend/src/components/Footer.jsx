import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";

/** Shared site footer — light studio chrome. */
export function Footer() {
  return (
    <footer
      className="bg-white text-[#1E1B4B] pt-16 pb-16 border-t border-[#1E1B4B]/08 font-sans relative z-10"
      data-testid="site-footer"
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 pb-12 border-b border-[#1E1B4B]/08">
        <div>
          <BrandLogo variant="wordmark" height={36} className="mb-3" />
          <p className="text-xs text-[#64748B] leading-relaxed max-w-xs">
            “The studio for influencers who move markets.” Connecting elite brands with verified influencers through AI matching and escrow protection.
          </p>
        </div>

        <div>
          <h4 className="text-xs tracking-[0.25em] uppercase text-[#FF2D55] font-bold mb-4">GET STARTED</h4>
          <ul className="space-y-2 text-xs text-[#475569]">
            <li><Link to="/register/owner" className="hover:text-[#FF2D55]">For Brands</Link></li>
            <li><Link to="/register/influencer" className="hover:text-[#FF2D55]">For Influencers</Link></li>
            <li><Link to="/marketplace" className="hover:text-[#FF2D55]">Marketplace Briefs</Link></li>
            <li><Link to="/register/agent" className="hover:text-[#FF2D55]">Talent Agencies</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs tracking-[0.25em] uppercase text-[#FF2D55] font-bold mb-4">COMPANY</h4>
          <ul className="space-y-2 text-xs text-[#475569]">
            <li><Link to="/" className="hover:text-[#FF2D55]">flugr Manifesto</Link></li>
            <li><Link to="/" className="hover:text-[#FF2D55]">Transparent Pricing</Link></li>
            <li><Link to="/" className="hover:text-[#FF2D55]">Case Studies</Link></li>
            <li><Link to="/" className="hover:text-[#FF2D55]">FAQ &amp; Support</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs tracking-[0.25em] uppercase text-[#FF2D55] font-bold mb-4">NEWSLETTER</h4>
          <p className="text-xs text-[#64748B] mb-3">Get weekly influencer insights &amp; brand strategy.</p>
          <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
            <input
              type="email"
              placeholder="you@brand.com"
              aria-label="Email for newsletter"
              className="px-3 py-2 bg-[#F7F8FC] border border-[#1E1B4B]/12 text-xs text-[#1E1B4B] rounded-xs focus:outline-none focus:border-[#FF2D55] flex-1 min-w-0 placeholder:text-[#94A3B8]"
            />
            <button type="submit" className="px-3 py-2 bg-[#FF2D55] text-white text-xs uppercase font-bold rounded-xs shrink-0">
              Join
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 md:px-10 pt-6 flex flex-wrap items-center justify-between text-xs text-[#94A3B8] gap-4">
        <div>© {new Date().getFullYear()} flugr. All rights reserved.</div>
        <div className="flex gap-6">
          <Link to="/legal/privacy" className="hover:text-[#1E1B4B]">Privacy Policy</Link>
          <Link to="/legal/terms" className="hover:text-[#1E1B4B]">Terms of Service</Link>
          <Link to="/legal/cookies" className="hover:text-[#1E1B4B]">Cookies</Link>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto mt-6 pt-6 border-t border-[#1E1B4B]/06 flex items-center justify-center px-6">
        <a
          href="https://palramai.in"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 select-none"
        >
          <span className="text-[10px] tracking-[0.2em] uppercase text-[#94A3B8] group-hover:text-[#64748B]">Built with</span>
          <span className="font-editorial italic text-sm text-[#1E1B4B] group-hover:text-[#FF2D55] transition-colors">PalraMai</span>
        </a>
      </div>
    </footer>
  );
}
