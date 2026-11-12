import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { jwtDecode } from "jwt-decode";
import { AiIcon } from "@/components/AiIcon";
import { Nav } from "@/components/Nav";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { useAuth } from "@/lib/auth";
import { postLoginDestination } from "@/lib/onboarding";
import { PUBLIC_AGENT_ENABLED } from "@/lib/features";
import { toast } from "sonner";
import { useState } from "react";

export default function RegisterSplash() {
  const location = useLocation();
  const nav = useNavigate();
  const { googleLogin } = useAuth();
  const [loading, setLoading] = useState(false);
  const googleState = location.state?.fromGoogleLogin ? location.state : null;

  const handleGoogleCredential = async (credential) => {
    try {
      setLoading(true);
      const decoded = jwtDecode(credential);
      const r = await googleLogin(credential, { create_if_missing: true });
      setLoading(false);
      if (r.ok) {
        if (r.created) {
          toast.success("Your CR8 account has been created successfully. Complete your profile to access all features.");
        } else {
          toast.success(`Welcome, ${decoded.name || decoded.email}!`);
        }
        nav(postLoginDestination(r.user));
      } else {
        toast.error(r.error || "Google sign-up failed");
      }
    } catch (_) {
      setLoading(false);
      toast.error("Google sign-up failed");
    }
  };

  return (
    <div
      className="relative min-h-screen bg-[#F6F0E6] text-[#2A201A] overflow-hidden flex flex-col justify-between"
      data-testid="register-splash"
      style={{
        background:
          "radial-gradient(ellipse 70% 50% at 20% 10%, rgba(169,130,74,0.12) 0%, transparent 55%), radial-gradient(ellipse 55% 45% at 90% 85%, rgba(231,218,196,0.5) 0%, transparent 60%), #F6F0E6",
      }}
    >
      <div className="relative z-50">
        <Nav />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 pt-28 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 25, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-2xl mx-auto"
        >
          <div className="text-center">
            <div className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.28em] uppercase bg-[#FBF7F0] border border-[#D9CBB3] px-3 py-1.5 rounded-full text-[#A9824A] font-bold mb-3">
              <AiIcon name="sparkles" className="w-3.5 h-3.5" /> Create Your CR8 Account
            </div>
            <h1 className="font-editorial text-[40px] md:text-[56px] leading-[1.1] tracking-tight text-[#2A201A]">
              Create your <span className="italic text-[#A9824A]">CR8</span> account
            </h1>
            <p className="font-mono text-[11px] text-[#6B5D50] uppercase tracking-[0.18em] mt-3 max-w-md mx-auto font-semibold">
              {googleState
                ? "Finish role selection to continue Google signup"
                : "Continue with Google or mobile / email — then complete mandatory profile details"}
            </p>
            {googleState?.email && (
              <p className="mt-4 font-mono text-[11px] text-[#A9824A] tracking-wide font-semibold">
                Continuing as {googleState.email}
              </p>
            )}
          </div>

          <div className="mt-8 bg-[#FBF7F0] border border-[#D9CBB3] rounded-3xl p-6 shadow-[0_18px_40px_-28px_rgba(42,32,26,0.35)]">
            <SocialAuthButtons
              mode="signup"
              loading={loading}
              onGoogleCredential={handleGoogleCredential}
              onGoogleError={(reason) => toast.error(reason || "Google sign-up failed")}
            />

            <div className="flex items-center gap-3 my-6 opacity-70">
              <div className="h-px bg-[#2A201A]/12 flex-1" />
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase font-semibold text-[#6B5D50]">Or</span>
              <div className="h-px bg-[#2A201A]/12 flex-1" />
            </div>

            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#A9824A] font-bold text-center mb-4">
              Continue with Mobile Number / Email
            </p>

            <div className="flex flex-col gap-3">
              {[
                {
                  k: "influencer",
                  num: "01",
                  label: "I'm an Influencer",
                  sub: "Build your body of work • Pitch on your terms • Get paid",
                  badge: "Influencer",
                },
                {
                  k: "owner",
                  num: "02",
                  label: "I'm a Company / Brand",
                  sub: "Post briefs • Access credentialed talent • Escrow security",
                  badge: "Company",
                },
                PUBLIC_AGENT_ENABLED && {
                  k: "agent",
                  num: "03",
                  label: "I'm an Agent",
                  sub: "Represent talent • Manage roster • Close brand deals",
                  badge: "Agent",
                },
              ].filter(Boolean).map((r) => (
                <Link
                  key={r.k}
                  to={`/register/${r.k}`}
                  state={googleState || undefined}
                  data-testid={`splash-door-${r.k}`}
                  className="group relative overflow-hidden flex items-center justify-between p-5 md:p-6 bg-[#F6F0E6] border border-[#D9CBB3] hover:border-[#A9824A] transition-all duration-300 rounded-2xl"
                >
                  <div className="pr-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#A9824A] font-bold">
                        Door {r.num}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-widest px-2 py-0.5 bg-[#FBF7F0] border border-[#D9CBB3] text-[#6B5D50] rounded-full font-semibold">
                        {r.badge}
                      </span>
                    </div>
                    <div className="font-editorial text-[22px] md:text-[26px] mt-1.5 font-medium text-[#2A201A] group-hover:text-[#A9824A] transition-colors">
                      {r.label}
                    </div>
                    <div className="font-sans text-[12px] text-[#6B5D50] mt-1 leading-relaxed">{r.sub}</div>
                  </div>
                  <ArrowRight className="w-5 h-5 opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0 text-[#A9824A]" />
                </Link>
              ))}
            </div>
          </div>

          <p className="mt-10 font-mono text-[11px] tracking-[0.18em] uppercase text-[#6B5D50] text-center font-semibold">
            Already inside the studio?{" "}
            <Link to="/login" className="underline text-[#A9824A] font-bold hover:text-[#2A201A] transition-colors">
              Sign in ↗
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
