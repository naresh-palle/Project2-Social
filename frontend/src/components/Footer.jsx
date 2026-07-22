import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="hairline-t bg-[#0A0A0A] text-[#F4F4F0] px-6 md:px-10 py-16">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-4">
          <div className="font-editorial text-[14vw] md:text-[9vw] leading-[1.15] italic">
            CR<span className="not-italic">8</span><span className="tick">.</span>
          </div>
          <p className="mt-6 max-w-md font-mono text-[11px] tracking-[0.22em] uppercase opacity-60 leading-relaxed">
            Connect leading brands with creators who actually move audiences. Negotiate, collaborate, and grow your influence seamlessly on the platform built for real partnerships.
          </p>
        </div>
        <div className="md:col-span-2 md:col-start-6">
          <h4 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4">Studio</h4>
          <ul className="space-y-2 font-editorial text-lg">
            <li><Link to="/marketplace" className="kinetic-underline">Marketplace</Link></li>
            <li><Link to="/#manifesto" className="kinetic-underline">Manifesto</Link></li>
            <li><Link to="/#work" className="kinetic-underline">The Work</Link></li>
          </ul>
        </div>
        <div className="md:col-span-2">
          <h4 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4">Account</h4>
          <ul className="space-y-2 font-editorial text-lg">
            <li><Link to="/login" className="kinetic-underline">Sign In</Link></li>
            <li><Link to="/register" className="kinetic-underline">Join Studio</Link></li>
          </ul>
        </div>
        <div className="md:col-span-2">
          <h4 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4">Legal</h4>
          <ul className="space-y-2 font-editorial text-lg">
            <li><Link to="#" className="kinetic-underline">Privacy Policy</Link></li>
            <li><Link to="#" className="kinetic-underline">Terms of Service</Link></li>
            <li><Link to="#" className="kinetic-underline">FTC Guidelines</Link></li>
          </ul>
        </div>
        <div className="md:col-span-2">
          <h4 className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-50 mb-4">Contact</h4>
          <p className="font-editorial text-lg">hello@cr8.studio</p>
          <p className="font-mono text-[11px] tracking-[0.2em] uppercase opacity-50 mt-2">Paris · NY · Tokyo</p>
        </div>
      </div>
      <div className="max-w-[1600px] mx-auto hairline-t mt-12 pt-6 flex flex-wrap justify-between font-mono text-[10px] tracking-[0.25em] uppercase opacity-50">
        <span>© {new Date().getFullYear()} CR8 Studio · All rights reserved</span>
        <span>GDPR Compliant • PCI-DSS Secure</span>
      </div>

      {/* ── palram.ai developer credit ── */}
      <div className="max-w-[1600px] mx-auto mt-8 pt-6 border-t border-white/5 flex items-center justify-center">
        <a
          href="https://palram.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 select-none"
          style={{ textDecoration: 'none' }}
        >
          {/* Pulsing dot */}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF3B30] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FF3B30]" />
          </span>

          {/* Label */}
          <span className="font-mono text-[11px] tracking-[0.35em] uppercase text-[#F4F4F0]/40 group-hover:text-[#F4F4F0]/70 transition-colors duration-500">
            Crafted with precision by
          </span>

          {/* palram.ai — gradient shimmer */}
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
            palram.ai
          </span>

          {/* Arrow */}
          <span className="text-[#FF3B30]/60 group-hover:text-[#FF3B30] group-hover:translate-x-1 transition-all duration-300 font-mono text-xs">
            ↗
          </span>
        </a>
      </div>

      {/* Shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
      `}</style>
    </footer>
  );
}
