import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="hairline-t bg-[#0A0A0A] text-[#F4F4F0] px-6 md:px-10 py-16">
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-10">
        <div className="md:col-span-4">
          <div className="font-editorial text-[14vw] md:text-[9vw] leading-[0.85] italic">
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
    </footer>
  );
}
