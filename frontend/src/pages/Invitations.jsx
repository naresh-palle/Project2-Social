import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, X, Send } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { formatUsername } from "@/lib/username";
import { toast, Toaster } from "sonner";

export default function Invitations() {
  const { user } = useAuth();
  const [invs, setInvs] = useState([]);
  const [counterId, setCounterId] = useState(null);
  const [counter, setCounter] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  const isCreator = user?.role === "influencer";
  const isCompany = user?.role === "owner";
  const title = isCreator
    ? "Campaign invitations"
    : isCompany
      ? "Creator invitations"
      : "Invitations";
  const subtitle = isCreator
    ? "Brand briefs that named you"
    : isCompany
      ? "Offers you extended to creators"
      : "Collaboration desk";

  const load = async () => {
    setLoading(true);
    try {
      let { data } = await api.get("/invitations/mine");
      if ((!data || data.length === 0) && (isCreator || isCompany)) {
        try {
          await api.post("/seed/mock-comms");
          ({ data } = await api.get("/invitations/mine"));
        } catch {}
      }
      setInvs(Array.isArray(data) ? data : []);
    } catch {
      setInvs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const act = async (id, action, payload = {}) => {
    try {
      await api.post(`/invitations/${id}/action/${action}`, payload);
      toast.success(`Invitation ${action}ed.`);
      setCounterId(null);
      setCounter("");
      setNote("");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0]">
      <Nav />
      <Toaster theme="dark" position="top-center" />
      <div className="pt-28 max-w-[1400px] mx-auto px-6 md:px-10 pb-20">
        <div className="hairline-b pb-6 flex items-baseline justify-between gap-4 flex-wrap">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ {subtitle}</p>
            <h1 className="font-sans text-5xl md:text-7xl font-bold tracking-tight leading-[1.15] mt-2">
              {title}<span className="tick text-[#FF3B30]">.</span>
            </h1>
          </div>
          <Link to="/dashboard" className="font-mono text-[11px] tracking-[0.28em] uppercase kinetic-underline">
            ← Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4 mt-8 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="hairline-t hairline-b hairline-l hairline-r p-6 h-36 bg-white/[0.02]" />
            ))}
          </div>
        ) : invs.length === 0 ? (
          <div className="py-24 text-center space-y-3">
            <div className="font-sans text-2xl font-semibold tracking-tight opacity-60">
              {isCreator ? "No campaign invitations yet." : isCompany ? "No creator invitations yet." : "No invitations on file."}
            </div>
            <p className="font-mono text-xs opacity-40 uppercase tracking-widest">
              {isCompany ? "Invite creators from a campaign brief" : "Brands will appear here when they invite you"}
            </p>
          </div>
        ) : (
          <div className="space-y-6 mt-8">
            {invs.map((i, idx) => (
              <motion.div
                key={i.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.04 }}
                data-testid={`inv-${i.id}`}
                className="hairline-t hairline-b hairline-l hairline-r p-6 grid grid-cols-12 gap-6"
              >
                <div className="col-span-12 md:col-span-2 font-mono text-[10px] tracking-[0.28em] uppercase opacity-60">
                  #{String(idx + 1).padStart(2, "0")}
                  {i.mock ? <div className="mt-2 text-[#FF3B30] normal-case tracking-widest">Demo</div> : null}
                </div>
                <div className="col-span-12 md:col-span-5">
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">{i.campaign_brand}</div>
                  <div className="font-editorial text-3xl leading-tight mt-1">{i.campaign_title}</div>
                  <div className="mt-2 font-mono text-[10px] tracking-[0.22em] uppercase opacity-70">
                    {isCompany ? "→ Creator " : "→ "}
                    {i.creator_name}{" "}
                    {formatUsername(i.creator_handle, i.creator_name)}
                  </div>
                  <p className="mt-3 italic opacity-80">&ldquo;{i.message}&rdquo;</p>
                </div>
                <div className="col-span-6 md:col-span-2 font-editorial">
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">Offer</div>
                  <div className="text-3xl italic text-[#FF3B30]">₹{Number(i.offer || i.budget || 15000).toLocaleString()}</div>
                  {i.counter_offer && (
                    <>
                      <div className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-60 mt-2">Counter Offer</div>
                      <div className="text-2xl font-editorial italic text-white">₹{Number(i.counter_offer).toLocaleString()}</div>
                    </>
                  )}
                </div>
                <div className="col-span-6 md:col-span-3 flex flex-col items-end justify-between">
                  <div
                    className={`font-mono text-[10px] tracking-[0.3em] uppercase ${
                      i.status === "accepted" ? "text-[#34C759]" : i.status === "rejected" ? "opacity-40" : "opacity-80"
                    }`}
                  >
                    {i.status}
                  </div>
                  {isCreator && i.status === "pending" && (
                    <div className="flex gap-2 mt-4">
                      <button data-testid={`inv-accept-${i.id}`} onClick={() => act(i.id, "accept")} className="btn-solid text-xs">
                        <Check className="w-3 h-3" /> Accept
                      </button>
                      <button data-testid={`inv-reject-${i.id}`} onClick={() => act(i.id, "reject")} className="btn-pill text-xs">
                        <X className="w-3 h-3" /> Decline
                      </button>
                    </div>
                  )}
                </div>
                {isCreator && i.status === "pending" && (
                  <div className="col-span-12">
                    {counterId === i.id ? (
                      <div className="hairline-t pt-4 grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-3">
                          <label className="font-mono text-[10px] tracking-[0.28em] uppercase opacity-60">Counter offer</label>
                          <input
                            type="number"
                            data-testid={`inv-counter-input-${i.id}`}
                            className="w-full bg-transparent border-b border-white/20 focus:border-[#FF3B30] outline-none py-2"
                            value={counter}
                            onChange={(e) => setCounter(e.target.value)}
                          />
                        </div>
                        <div className="col-span-7">
                          <label className="font-mono text-[10px] tracking-[0.28em] uppercase opacity-60">Note</label>
                          <input
                            data-testid={`inv-note-${i.id}`}
                            className="w-full bg-transparent border-b border-white/20 focus:border-[#FF3B30] outline-none py-2"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                          />
                        </div>
                        <div className="col-span-2 flex gap-2">
                          <button
                            onClick={() => act(i.id, "counter", { counter_offer: Number(counter), note })}
                            data-testid={`inv-send-counter-${i.id}`}
                            className="btn-solid text-xs"
                          >
                            <Send className="w-3 h-3" /> Send
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="mt-2 font-mono text-[11px] tracking-[0.28em] uppercase kinetic-underline text-[#FF3B30]"
                        data-testid={`inv-counter-btn-${i.id}`}
                        onClick={() => setCounterId(i.id)}
                      >
                        Counter →
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
