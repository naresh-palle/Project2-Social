import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Nav } from "@/components/Nav";

export default function RegisterSplash() {
  const location = useLocation();
  const googleState = location.state?.fromGoogleLogin ? location.state : null;

  return (
    <div className="relative min-h-screen bg-[#0B0B0E] text-[#F4F4F0] overflow-hidden flex flex-col justify-between" data-testid="register-splash">
      {/* Sleek Radial Ambient Aura Background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        
        
        
        
      </div>

      <div className="relative z-50">
        <Nav />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 pt-32 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 25, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-2xl mx-auto"
        >
          <div className="text-center">
            <div className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.3em] uppercase bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-[#FF3B30] font-bold mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Studio Entry Gate
            </div>
            <h1 className="font-editorial text-5xl md:text-7xl leading-[1.15]">
              Choose your <span className="italic text-[#FF3B30]">door</span>
            </h1>
            <p className="font-mono text-xs opacity-60 uppercase tracking-widest mt-3 max-w-md mx-auto">
              {googleState
                ? "Google account is not registered yet — pick a role to complete signup"
                : "Select your role to open the dedicated studio workspace"}
            </p>
            {googleState?.email && (
              <p className="mt-4 font-mono text-[11px] text-[#FF3B30]/90 tracking-wide">
                Continuing as {googleState.email}
              </p>
            )}
          </div>

          <div className="mt-12 flex flex-col gap-5">
            {[
              { 
                k: "influencer", 
                num: "01", 
                label: "I'm an Influencer", 
                sub: "Build your body of work • Pitch on your terms • Get paid",
                badge: "Influencer Studio",
                bgHover: "hover:border-[#FF3B30] hover:bg-[#FF3B30]/10" 
              },
              { 
                k: "owner", 
                num: "02", 
                label: "I'm a Brand Owner", 
                sub: "Post briefs in 3 mins • Access credentialed talent • Escrow security",
                badge: "Brand Desk",
                bgHover: "hover:border-[#FF3B30] hover:bg-[#FF3B30]/10" 
              }
            ].map((r) => (
              <Link
                key={r.k}
                to={`/register/${r.k}`}
                state={googleState || undefined}
                data-testid={`splash-door-${r.k}`}
                className={`group relative overflow-hidden flex items-center justify-between p-8 bg-[#121212]/90 backdrop-blur-xl border border-white/15 ${r.bgHover} transition-all duration-500 rounded-3xl shadow-xl`}
              >
                {/* Accent glow line on hover */}
                <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#FF3B30] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <div className="pr-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs tracking-[0.25em] uppercase text-[#FF3B30] font-bold">
                      DOOR {r.num}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 bg-white/5 border border-white/10 text-white/70 rounded-xs">
                      {r.badge}
                    </span>
                  </div>
                  <div className="font-editorial text-3xl md:text-4xl mt-2 font-bold group-hover:text-white transition-colors">
                    {r.label}
                  </div>
                  <div className="font-mono text-[11px] tracking-[0.1em] opacity-60 group-hover:opacity-90 mt-2">
                    {r.sub}
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0 text-[#FF3B30]" />
              </Link>
            ))}
          </div>

          <p className="mt-14 font-mono text-[11px] tracking-[0.2em] uppercase opacity-60 text-center">
            Already inside the studio?{" "}
            <Link to="/login" className="underline text-[#FF3B30] font-bold hover:text-white transition-colors">
              Sign in ↗
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
