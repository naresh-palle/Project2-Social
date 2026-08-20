import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { IconTip } from "@/components/IconTip";
import { AiIcon } from "@/components/AiIcon";

function isUnread(n) {
  return !(n && (n.read === true || n.read === "true" || n.read === 1));
}

export function NotificationBell() {
  const { user } = useAuth();
  const [data, setData] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      // Bell only shows unread; Recent Activity still lists full history.
      const { data: res } = await api.get("/notifications", { params: { unread_only: true } });
      const items = Array.isArray(res?.items) ? res.items.filter(isUnread) : [];
      const unread = typeof res?.unread === "number" ? res.unread : items.length;
      setData({ items, unread });
    } catch {
      setData({ items: [], unread: 0 });
    }
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [user, load]);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAll = async () => {
    try {
      await api.post("/notifications/read");
    } catch {
      /* ignore */
    }
    setData({ items: [], unread: 0 });
  };

  const markOne = async (n) => {
    if (!n?.id) return;
    // Optimistic: remove from panel and drop the badge immediately
    setData((prev) => {
      const items = prev.items.filter((x) => x.id !== n.id);
      const unread = Math.max(0, (prev.unread || 0) - (isUnread(n) ? 1 : 0));
      return { items, unread };
    });
    setOpen(false);
    try {
      const { data: res } = await api.post(`/notifications/${n.id}/read`);
      if (typeof res?.unread === "number") {
        setData((prev) => ({ ...prev, unread: res.unread, items: prev.items.filter((x) => x.id !== n.id) }));
      }
    } catch {
      // Refresh from server if mark-read failed
      load();
    }
  };

  const linkFor = (n) => {
    if (n.meta?.link) return n.meta.link;
    if (n.kind === "support" || n.meta?.ticket_id) return "/support/ops?tab=tickets";
    if (n.meta?.campaign_id) return `/campaigns/${n.meta.campaign_id}`;
    if (n.meta?.contract_id) return `/campaigns/${n.meta.campaign_id}`;
    if (n.kind === "invitation") return "/invitations";
    return "/dashboard";
  };

  if (!user) return null;
  return (
    <div ref={ref} className="relative">
      <IconTip label="Notifications">
        <button
          onClick={() => setOpen((v) => !v)}
          data-testid="notif-bell"
          title="Notifications"
          aria-label="Notifications"
          className="relative w-9 h-9 rounded-full border border-white/25 bg-white/10 hover:bg-[#FF3B30]/15 hover:border-[#FF3B30] flex items-center justify-center transition-colors"
        >
          <AiIcon name="bell" className="w-5 h-5" />
          {data.unread > 0 && (
            <span data-testid="notif-badge" className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF3B30] text-[#F4F4F0] text-[10px] font-mono flex items-center justify-center">
              {data.unread > 9 ? "9+" : data.unread}
            </span>
          )}
        </button>
      </IconTip>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-3 w-[min(360px,calc(100vw-1.5rem))] max-w-[calc(100vw-1rem)] max-h-[min(70vh,28rem)] overflow-y-auto bg-[#121212] border border-white/15 rounded-2xl shadow-2xl shadow-black/50 z-[90] left-auto"
            style={{ maxWidth: "min(360px, calc(100vw - 1rem))" }}
            data-testid="notif-panel"
          >
            <div className="p-4 hairline-b flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.28em] uppercase opacity-60">§ Correspondence</span>
              {data.unread > 0 && (
                <button onClick={markAll} data-testid="notif-mark-all"
                  className="font-mono text-[10px] tracking-[0.28em] uppercase text-[#FF3B30] kinetic-underline">
                  Mark all read
                </button>
              )}
            </div>
            {data.items.length === 0 ? (
              <div className="p-8 text-center font-editorial italic text-lg opacity-50">Nothing on file.</div>
            ) : (
              <div>
                {data.items.map((n) => (
                  <Link
                    key={n.id}
                    to={linkFor(n)}
                    onClick={() => { markOne(n); }}
                    data-testid={`notif-${n.id}`}
                    className="block p-4 hairline-b hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="font-mono text-[9px] tracking-[0.28em] uppercase text-[#FF3B30]">{String(n.kind || "update").replace(/_/g, " ")}</span>
                      <span className="font-mono text-[9px] tracking-[0.22em] uppercase opacity-50">
                        {n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                    <div className="text-sm leading-snug">{n.text}</div>
                  </Link>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
