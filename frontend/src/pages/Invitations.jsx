import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {  Check, X, Send , Sparkles } from "lucide-react";

import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { formatUsername } from "@/lib/username";
import { toast } from "sonner";

export default function Invitations() {
  const { user } = useAuth();
  const [invs, setInvs] = useState([]);
  const [counterId, setCounterId] = useState(null);
  const [counter, setCounter] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  const isInfluencer = user?.role === "influencer";
  const isCompany = user?.role === "owner";
  const title = isInfluencer
    ? "Campaign invitations"
    : isCompany
      ? "Influencer invitations"
      : "Invitations";
  const subtitle = isInfluencer
    ? "Brand briefs that named you"
    : isCompany
      ? "Offers you extended to influencers"
      : "Collaboration desk";

  const load = async () => {
    setLoading(true);
    try {
      let { data } = await api.get("/invitations/mine");
      if ((!data || data.length === 0) && (isInfluencer || isCompany)) {
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
      
      
      <div className="pt-24 max-w-4xl mx-auto px-4 md:px-6 pb-16">
        <div className="pb-4 border-b border-white/10">
          
          <div>
            <p className="font-sans text-[10px] tracking-widest uppercase opacity-50">{subtitle}</p>
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" /> ⚡ Invitations
              </p>
              <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight mt-1">{title}</h1>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 mt-5 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="border border-white/10 p-4 h-24 bg-white/[0.02] rounded-3xl" />
            ))}
          </div>
        ) : invs.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <div className="font-sans text-base font-medium opacity-60">
              {isInfluencer ? "No campaign invitations yet." : isCompany ? "No influencer invitations yet." : "No invitations on file."}
            </div>
            <p className="font-sans text-xs opacity-40">
              {isCompany ? "Invite influencers from a campaign brief" : "Brands will appear here when they invite you"}
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-5">
            {invs.map((i, idx) => (
              <div
                key={i.id}
                data-testid={`inv-${i.id}`}
                className="border border-white/10 bg-white/[0.02] rounded-3xl p-4 grid grid-cols-12 gap-3"
              >
                <div className="col-span-12 md:col-span-7 min-w-0">
                  <div className="flex items-center gap-2 font-sans text-[10px] uppercase tracking-wider opacity-50">
                    <span>#{String(idx + 1).padStart(2, "0")}</span>
                    {i.mock ? <span className="text-[#FF3B30]">Demo</span> : null}
                    <span>· {i.campaign_brand}</span>
                  </div>
                  <div className="font-sans text-base md:text-lg font-semibold mt-1 leading-snug">{i.campaign_title}</div>
                  <div className="mt-1 font-sans text-xs opacity-60">
                    {isCompany ? "Influencer: " : ""}
                    {formatUsername(i.creator_handle, i.creator_name) || i.creator_name}
                  </div>
                  {i.message ? (
                    <p className="mt-2 font-sans text-sm opacity-75 leading-snug">&ldquo;{i.message}&rdquo;</p>
                  ) : null}
                </div>
                <div className="col-span-6 md:col-span-2">
                  <div className="font-sans text-[10px] uppercase tracking-wider opacity-50">Offer</div>
                  <div className="font-sans text-lg font-semibold text-[#FF3B30] mt-0.5">
                    ₹{Number(i.offer || i.budget || 15000).toLocaleString()}
                  </div>
                  {i.counter_offer ? (
                    <>
                      <div className="font-sans text-[10px] uppercase tracking-wider opacity-50 mt-2">Counter</div>
                      <div className="font-sans text-base font-semibold mt-0.5">
                        ₹{Number(i.counter_offer).toLocaleString()}
                      </div>
                    </>
                  ) : null}
                </div>
                <div className="col-span-6 md:col-span-3 flex flex-col items-end justify-between gap-2">
                  <div
                    className={`font-sans text-[10px] tracking-wider uppercase ${
                      i.status === "accepted" ? "text-[#34C759]" : i.status === "rejected" ? "opacity-40" : "opacity-70"
                    }`}
                  >
                    {i.status}
                  </div>
                  {isInfluencer && i.status === "pending" && (
                    <div className="flex gap-2">
                      <button data-testid={`inv-accept-${i.id}`} onClick={() => act(i.id, "accept")} className="btn-solid text-xs !py-2 !px-3">
                        <Check className="w-3 h-3" /> Accept
                      </button>
                      <button data-testid={`inv-reject-${i.id}`} onClick={() => act(i.id, "reject")} className="btn-pill text-xs !py-2 !px-3">
                        <X className="w-3 h-3" /> Decline
                      </button>
                    </div>
                  )}
                </div>
                {isInfluencer && i.status === "pending" && (
                  <div className="col-span-12">
                    {counterId === i.id ? (
                      <div className="border-t border-white/10 pt-3 grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-12 sm:col-span-3">
                          <label className="font-sans text-[10px] uppercase tracking-wider opacity-50">Counter offer</label>
                          <input
                            type="number"
                            data-testid={`inv-counter-input-${i.id}`}
                            className="w-full bg-transparent border-b border-white/20 focus:border-[#FF3B30] outline-none py-1.5 font-sans text-sm"
                            value={counter}
                            onChange={(e) => setCounter(e.target.value)}
                          />
                        </div>
                        <div className="col-span-12 sm:col-span-7">
                          <label className="font-sans text-[10px] uppercase tracking-wider opacity-50">Note</label>
                          <input
                            data-testid={`inv-note-${i.id}`}
                            className="w-full bg-transparent border-b border-white/20 focus:border-[#FF3B30] outline-none py-1.5 font-sans text-sm"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                          />
                        </div>
                        <div className="col-span-12 sm:col-span-2">
                          <button
                            onClick={() => act(i.id, "counter", { counter_offer: Number(counter), note })}
                            data-testid={`inv-send-counter-${i.id}`}
                            className="btn-solid text-xs w-full justify-center !py-2"
                          >
                            <Send className="w-3 h-3" /> Send
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="mt-1 font-sans text-xs uppercase tracking-wider text-[#FF3B30]"
                        data-testid={`inv-counter-btn-${i.id}`}
                        onClick={() => setCounterId(i.id)}
                      >
                        Counter →
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
