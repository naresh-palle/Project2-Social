import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Nav } from "@/components/Nav";

export default function RegisterSplash() {
  return (
    <div className="relative min-h-screen bg-[#0A0A0A] text-[#F4F4F0] overflow-hidden" data-testid="register-splash">
      {/* Full Screen AI Background */}
      <div className="absolute inset-0 z-0">
        <img
          src={`${process.env.PUBLIC_URL}/splash_bg.png`}
          alt="Studio Background"
          className="w-full h-full object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/80 via-[#0A0A0A]/60 to-[#0A0A0A]" />
        <div className="grain" />
      </div>

      <div className="relative z-10">
        <Nav />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 py-20 mt-[-80px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-xl mx-auto"
        >
          <div className="text-center">
            <p className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
              § Enter the studio
            </p>
            <h1 className="font-editorial text-5xl md:text-7xl mt-4 leading-[1.15] pb-2">
              Choose your <span className="italic text-[#FF3B30]">door.</span>
            </h1>
          </div>

          <div className="mt-14 flex flex-col gap-4">
            {[
              { k: "influencer", label: "I'm a Creator", sub: "Editor • Voice" },
              { k: "owner", label: "I'm a Brand", sub: "Brand • House" },
              { k: "agent", label: "I'm an Agent", sub: "Talent • Scout" }
            ].map((r) => (
              <Link
                key={r.k}
                to={`/register/${r.k}`}
                data-testid={`splash-door-${r.k}`}
                className="group relative overflow-hidden flex items-center justify-between p-7 bg-[#0A0A0A]/60 backdrop-blur-md border border-[#F4F4F0]/10 hover:border-[#FF3B30]/50 hover:bg-[#F4F4F0]/5 transition-all duration-500 rounded-sm"
              >
                <div>
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#FF3B30] opacity-80 group-hover:opacity-100 transition-opacity">
                    {r.k === "influencer" ? "01" : r.k === "owner" ? "02" : "03"}
                  </div>
                  <div className="font-editorial text-3xl mt-2">{r.label}</div>
                  <div className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-50 group-hover:opacity-80 mt-2">
                    {r.sub}
                  </div>
                </div>
                <div className="w-12 h-12 flex items-center justify-center rounded-full border border-[#F4F4F0]/10 group-hover:border-[#FF3B30]/30 group-hover:bg-[#FF3B30]/10 transition-all duration-500">
                  <ArrowRight className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:text-[#FF3B30] -translate-x-1 group-hover:translate-x-0 transition-all duration-500" />
                </div>
              </Link>
            ))}
          </div>

          <p className="mt-16 font-mono text-[11px] tracking-[0.2em] uppercase opacity-60 text-center">
            Already inside?{" "}
            <Link to="/login" className="kinetic-underline text-[#F4F4F0] hover:text-[#FF3B30] transition-colors">
              Sign in ↗
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
