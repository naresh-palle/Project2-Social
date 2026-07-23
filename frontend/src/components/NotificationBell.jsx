import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function NotificationBell() {
  const { user } = useAuth();
  const [data, setData] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get("/notifications");
      setData(data && Array.isArray(data.items) ? data : { items: [], unread: 0 });
    } catch {
      setData({ items: [], unread: 0 });
    }
  };
  useEffect(() => {
    if (!user) return;
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [user]);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markAll = async () => {
    await api.post("/notifications/read");
    load();
  };

  const linkFor = (n) => {
    if (n.meta?.campaign_id) return `/campaigns/${n.meta.campaign_id}`;
    if (n.meta?.contract_id) return `/campaigns/${n.meta.campaign_id}`;
    if (n.kind === "invitation") return "/invitations";
    return "/dashboard";
  };

  if (!user) return null;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        data-testid="notif-bell"
        className="relative w-9 h-9 rounded-full hairline-t hairline-b hairline-l hairline-r flex items-center justify-center hover:bg-white/5 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {data.unread > 0 && (
          <span data-testid="notif-badge" className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF3B30] text-[#F4F4F0] text-[10px] font-mono flex items-center justify-center">
            {data.unread > 9 ? "9+" : data.unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 mt-3 w-[360px] max-h-[70vh] overflow-y-auto bg-[#0A0A0A]/95 backdrop-blur-xl hairline-t hairline-b hairline-l hairline-r z-50"
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
                {data.items.map(n => (
                  <Link
                    key={n.id}
                    to={linkFor(n)}
                    onClick={() => setOpen(false)}
                    data-testid={`notif-${n.id}`}
                    className={`block p-4 hairline-b hover:bg-white/5 transition-colors ${n.read ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="font-mono text-[9px] tracking-[0.28em] uppercase text-[#FF3B30]">{n.kind.replace(/_/g, " ")}</span>
                      <span className="font-mono text-[9px] tracking-[0.22em] uppercase opacity-50">
                        {new Date(n.created_at).toLocaleDateString()}
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
