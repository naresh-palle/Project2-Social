import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Nav } from "@/components/Nav";

export default function RegisterSplash() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]" data-testid="register-splash">
      <div className="grain" />
      <Nav />
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-5 pt-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="relative overflow-hidden hidden md:block md:col-span-2 hairline-r"
        >
          <img
            src="https://images.pexels.com/photos/35458193/pexels-photo-35458193.jpeg"
            alt="Studio"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[#0A0A0A]/50" />
          <div className="absolute bottom-10 left-10 right-10">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-70">
              Vol. 08 · Winter Edition
            </p>
            <h2 className="font-editorial text-5xl italic mt-4 leading-[1.15]">
              Two doors.<br />
              One studio.
            </h2>
          </div>
        </motion.div>

        <div className="md:col-span-3 flex items-center justify-center px-6 md:px-20 py-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            className="w-full max-w-lg"
          >
            <p className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
              § Enter the studio
            </p>
            <h1 className="font-editorial text-5xl md:text-6xl mt-3 leading-[1.15]">
              Choose your <span className="italic">door.</span>
            </h1>

            <div className="mt-12 flex flex-col gap-6">
              {[
                { k: "owner", label: "I'm an Owner", sub: "Brand · House" },
                { k: "influencer", label: "I'm a Creator", sub: "Editor · Voice" },
                { k: "agent", label: "I'm an Agent", sub: "Talent · Scout" }
              ].map((r) => (
                <Link
                  key={r.k}
                  to={`/register/${r.k}`}
                  data-testid={`splash-door-${r.k}`}
                  className="group relative overflow-hidden flex items-center justify-between p-6 hairline-t hairline-b hairline-l hairline-r bg-[#0A0A0A] hover:bg-[#F4F4F0] hover:text-[#0A0A0A] transition-colors duration-500"
                >
                  <div>
                    <div className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-70 group-hover:opacity-100 transition-opacity">
                      {r.k === "owner" ? "01" : r.k === "influencer" ? "02" : "03"}
                    </div>
                    <div className="font-editorial text-3xl mt-2">{r.label}</div>
                    <div className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-60 group-hover:opacity-100 mt-2">
                      {r.sub}
                    </div>
                  </div>
                  <ArrowRight className="w-6 h-6 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500" />
                </Link>
              ))}
            </div>

            <p className="mt-12 font-mono text-[11px] tracking-[0.2em] uppercase opacity-60 text-center">
              Already inside?{" "}
              <Link to="/login" className="kinetic-underline text-[#F4F4F0] hover:text-[#FF3B30] transition-colors">
                Sign in →
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
