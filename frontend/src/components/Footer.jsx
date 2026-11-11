import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";

/** Shared site footer — cream / espresso brand chrome. */
export function Footer() {
  return (
    <footer
      className="bg-[#FBF7F0] text-[#2A201A] pt-16 pb-16 border-t border-[#D9CBB3] font-sans relative z-10"
      data-testid="site-footer"
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 pb-12 border-b border-[#D9CBB3]">
        <div>
          <BrandLogo variant="wordmark" height={36} className="mb-3" />
          <p className="text-xs text-[#6B5D50] leading-relaxed max-w-xs">
            “The studio for influencers who move markets.” Connecting elite brands with verified influencers through AI matching and escrow protection.
          </p>
        </div>

        <div>
          <h4 className="text-xs tracking-[0.25em] uppercase text-[#A9824A] font-bold mb-4">Get started</h4>
          <ul className="space-y-2 text-xs text-[#6B5D50]">
            <li><Link to="/register/owner" className="hover:text-[#2A201A]">For Brands</Link></li>
            <li><Link to="/register/influencer" className="hover:text-[#2A201A]">For Influencers</Link></li>
            <li><Link to="/marketplace" className="hover:text-[#2A201A]">Marketplace Briefs</Link></li>
            <li><Link to="/register/agent" className="hover:text-[#2A201A]">Talent Agencies</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs tracking-[0.25em] uppercase text-[#A9824A] font-bold mb-4">Company</h4>
          <ul className="space-y-2 text-xs text-[#6B5D50]">
            <li><Link to="/" className="hover:text-[#2A201A]">flugr Manifesto</Link></li>
            <li><Link to="/" className="hover:text-[#2A201A]">Transparent Pricing</Link></li>
            <li><Link to="/" className="hover:text-[#2A201A]">Case Studies</Link></li>
            <li><Link to="/" className="hover:text-[#2A201A]">FAQ &amp; Support</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs tracking-[0.25em] uppercase text-[#A9824A] font-bold mb-4">Newsletter</h4>
          <p className="text-xs text-[#6B5D50] mb-3">Get weekly influencer insights &amp; brand strategy.</p>
          <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
            <input
              type="email"
              placeholder="you@brand.com"
              aria-label="Email for newsletter"
              className="px-3 py-2 bg-[#F6F0E6] border border-[#D9CBB3] text-xs text-[#2A201A] rounded-xs focus:outline-none focus:border-[#A9824A] flex-1 min-w-0 placeholder:text-[#6B5D50]"
            />
            <button type="submit" className="px-3 py-2 bg-[#2A201A] text-[#F6F0E6] text-xs uppercase font-bold rounded-xs shrink-0 hover:bg-[#3A2E26]">
              Join
            </button>
          </form>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-6 md:px-10 pt-6 flex flex-wrap items-center justify-between text-xs text-[#6B5D50] gap-4">
        <div>© {new Date().getFullYear()} flugr. All rights reserved.</div>
        <div className="flex gap-6">
          <Link to="/legal/privacy" className="hover:text-[#2A201A]">Privacy Policy</Link>
          <Link to="/legal/terms" className="hover:text-[#2A201A]">Terms of Service</Link>
          <Link to="/legal/cookies" className="hover:text-[#2A201A]">Cookies</Link>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto mt-6 pt-6 border-t border-[#D9CBB3] flex items-center justify-center px-6">
        <a
          href="https://palramai.in"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 select-none"
        >
          <span className="text-[10px] tracking-[0.2em] uppercase text-[#6B5D50] group-hover:text-[#2A201A]">Built with</span>
          <span className="font-editorial italic text-sm text-[#2A201A] group-hover:text-[#A9824A] transition-colors">PalraMai</span>
        </a>
      </div>
    </footer>
  );
}
