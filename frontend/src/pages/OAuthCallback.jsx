import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { postLoginDestination } from "@/lib/onboarding";
import { toast } from "sonner";
import { BrandLogo } from "@/components/BrandLogo";

/**
 * Lands after backend OAuth redirect.
 * Query: ok, token, provider, created | error, error_description
 */
export default function OAuthCallback() {
  const nav = useNavigate();
  const location = useLocation();
  const { refresh } = useAuth();
  const [message, setMessage] = useState("Finishing secure sign-in…");

  useEffect(() => {
    const params = new URLSearchParams(location.search || window.location.hash.split("?")[1] || "");
    const error = params.get("error");
    const desc = params.get("error_description");
    const token = params.get("token");
    const created = params.get("created") === "1";
    const linked = params.get("linked");
    const provider = params.get("provider") || "social";

    const run = async () => {
      if (error) {
        setMessage(desc || "Authorization was cancelled or failed.");
        toast.error(desc || "Social sign-in failed");
        setTimeout(() => nav("/login", { replace: true }), 1600);
        return;
      }

      if (linked) {
        toast.success(`${linked} connected to your CR8 account`);
        await refresh();
        nav("/settings", { replace: true });
        return;
      }

      if (!token) {
        setMessage("Missing authentication token from provider.");
        toast.error("Social sign-in did not return a session");
        setTimeout(() => nav("/login", { replace: true }), 1600);
        return;
      }

      localStorage.setItem("cr8_token", token);
      try {
        const { data } = await api.get("/auth/me");
        localStorage.setItem("cr8_user", JSON.stringify(data));
        await refresh();
        if (created) {
          toast.success("Your CR8 account has been created successfully. Complete your profile to access all features.");
        } else {
          toast.success(`Signed in with ${provider}`);
        }
        nav(postLoginDestination(data), { replace: true });
      } catch (e) {
        setMessage("Could not load your CR8 profile.");
        toast.error("Session restore failed");
        setTimeout(() => nav("/login", { replace: true }), 1600);
      }
    };

    run();
  }, [location.search, nav, refresh]);

  return (
    <div className="min-h-screen bg-[#F6F0E6] text-[#2A201A] flex flex-col items-center justify-center gap-4 px-6">
      <BrandLogo variant="wordmark" height={36} />
      <Loader2 className="w-6 h-6 animate-spin text-[#A9824A]" />
      <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[#6B5D50] text-center font-semibold">
        {message}
      </p>
    </div>
  );
}
