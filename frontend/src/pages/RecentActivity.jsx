import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Banknote, CheckCircle2, Megaphone, MessageSquare, Zap, Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

function activityMeta(item) {
  const kind = String(item.kind || item.type || "").toLowerCase();
  if (kind.includes("invite") || kind.includes("invitation")) {
    return { icon: Megaphone, tone: "text-[#D97706] bg-[#D97706]/10", label: "Brand invite" };
  }
  if (kind.includes("pay") || kind.includes("wallet") || kind.includes("payout")) {
    return { icon: Banknote, tone: "text-[#14B8A6] bg-[#14B8A6]/10", label: "Payment" };
  }
  if (kind.includes("approv") || kind.includes("accept") || kind.includes("campaign") || kind.includes("application")) {
    return { icon: CheckCircle2, tone: "text-[#14B8A6] bg-[#14B8A6]/10", label: "Campaign" };
  }
  if (kind.includes("message") || kind.includes("dm") || kind.includes("chat")) {
    return { icon: MessageSquare, tone: "text-[#0A84FF] bg-[#0A84FF]/10", label: "Message" };
  }
  return { icon: Zap, tone: "text-[#FF2D55] bg-[#FF2D55]/10", label: "Update" };
}

function linkFor(n) {
  if (n.meta?.link) return n.meta.link;
  if (n.kind === "support" || n.meta?.ticket_id) return "/support/ops?tab=tickets";
  if (n.meta?.campaign_id) return `/campaigns/${n.meta.campaign_id}`;
  if (n.kind === "invitation") return "/invitations";
  return "/dashboard";
}

export default function RecentActivity() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/notifications");
        if (!cancelled) setItems(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!cancelled) {
          setItems([]);
          setError("Could not load recent activity.");
          toast.error("Could not load recent activity.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="w-full pb-8" data-testid="recent-activity-page">
      <div className="border-b border-white/10 pb-3 mb-4">
        <Link to="/dashboard" className="font-mono text-[10px] uppercase tracking-widest text-[#94A3B8] hover:text-[#1E1B4B]">
          ← Dashboard
        </Link>
        <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight mt-1">Recent activity</h1>
        <p className="text-xs text-[#64748B] mt-1">All updates from your studio account.</p>
      </div>

      {items === null ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[#94A3B8]" />
        </div>
      ) : error && items.length === 0 ? (
        <p className="text-sm text-[#64748B] py-10 text-center">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#64748B] py-10 text-center">No recent activity yet.</p>
      ) : (
        <ul className="space-y-2.5 max-w-2xl">
          {items.map((item) => {
            const meta = activityMeta(item);
            const Icon = meta.icon;
            return (
              <li key={item.id || `${item.created_at}-${item.text}`}>
                <Link
                  to={linkFor(item)}
                  onClick={() => {
                    if (item?.id && !(item.read === true || item.read === "true")) {
                      api.post(`/notifications/${item.id}/read`).catch(() => {});
                      setItems((prev) =>
                        Array.isArray(prev)
                          ? prev.map((x) => (x.id === item.id ? { ...x, read: true } : x))
                          : prev
                      );
                    }
                  }}
                  className="flex items-start gap-3 min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 hover:border-[#FF2D55]/35 transition-colors"
                >
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.tone}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">{meta.label}</p>
                      {item.created_at ? (
                        <span className="font-mono text-[9px] uppercase tracking-wider text-[#94A3B8] shrink-0">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                    <p className="font-sans text-sm leading-snug text-[#1E1B4B]/90 break-words mt-0.5">
                      {item.text || item.title}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
