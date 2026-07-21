import { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { toast, Toaster } from "sonner";

export default function Messages() {
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const [convos, setConvos] = useState([]);
  const [active, setActive] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const scrollRef = useRef(null);

  const loadConvos = async () => {
    const { data } = await api.get("/conversations");
    setConvos(data);
    const openId = sp.get("id");
    if (openId) {
      const c = data.find(c => c.id === openId);
      if (c) setActive(c);
    } else if (data.length && !active) {
      setActive(data[0]);
    }
  };

  useEffect(() => {
    if (user) loadConvos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!active) return;
    // Initial load
    api.get(`/conversations/${active.id}/messages`).then(r => setMsgs(r.data));
    // Real-time SSE stream — token in querystring since EventSource can't set headers
    const token = localStorage.getItem("cr8_token");
    const base = process.env.REACT_APP_BACKEND_URL;
    const es = new EventSource(
      `${base}/api/conversations/${active.id}/stream?token=${encodeURIComponent(token || "")}`
    );
    es.addEventListener("message", (evt) => {
      try {
        const data = JSON.parse(evt.data);
        setMsgs((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
      } catch {}
    });
    es.onerror = () => { /* auto-retries */ };
    return () => es.close();
  }, [active]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || !active) return;
    try {
      const { data } = await api.post(`/conversations/${active.id}/messages`, { content: text });
      setMsgs([...msgs, data]);
      setText("");
      loadConvos();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      <Toaster theme="dark" position="top-center" />
      <div className="pt-24 max-w-[1600px] mx-auto px-6 md:px-10 pb-8">
        <div className="hairline-b pb-4 flex items-baseline justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ Correspondence</p>
            <h1 className="font-editorial text-5xl md:text-6xl leading-[1.15] mt-1">Messages<span className="tick">.</span></h1>
          </div>
          <Link to="/dashboard" className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60 kinetic-underline">
            ← Dashboard
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-12 gap-0 min-h-[560px]">
          {/* List */}
          <aside className="col-span-12 md:col-span-4 lg:col-span-3 hairline-t hairline-b hairline-l hairline-r max-h-[70vh] overflow-y-auto">
            {convos.length === 0 ? (
              <div className="p-10 font-editorial italic text-2xl opacity-60">No conversations yet.</div>
            ) : convos.map(c => (
              <button key={c.id} onClick={() => setActive(c)}
                data-testid={`convo-${c.id}`}
                className={`w-full text-left p-4 hairline-b hover:bg-white/5 transition-colors ${
                  active?.id === c.id ? "bg-white/[0.04]" : ""}`}>
                <div className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">{c.campaign_brand}</div>
                <div className="font-editorial text-xl leading-tight mt-1 truncate">{c.other_name}</div>
                <div className="font-mono text-[10px] tracking-[0.2em] opacity-50 mt-1 truncate">{c.campaign_title}</div>
                {c.last_message && (
                  <div className="text-xs opacity-70 mt-2 truncate">{c.last_message}</div>
                )}
              </button>
            ))}
          </aside>

          {/* Thread */}
          <section className="col-span-12 md:col-span-8 lg:col-span-9 hairline-t hairline-b hairline-r flex flex-col min-h-[70vh]">
            {active ? (
              <>
                <div className="p-6 hairline-b flex items-baseline justify-between">
                  <div>
                    <div className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">
                      {active.campaign_brand} · {active.campaign_title}
                    </div>
                    <div className="font-editorial text-3xl mt-1">{active.other_name}</div>
                  </div>
                  <Link to={`/campaigns/${active.campaign_id}`} className="font-mono text-[11px] tracking-[0.28em] uppercase kinetic-underline text-[#FF3B30]">
                    View brief →
                  </Link>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4" data-testid="thread">
                  <AnimatePresence>
                    {msgs.map(m => (
                      <motion.div key={m.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                        className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[68%] p-4 ${
                          m.sender_id === user?.id
                            ? "bg-[#FF3B30] text-[#F4F4F0]"
                            : "bg-white/5"
                        }`}>
                          <div className="font-mono text-[10px] tracking-[0.22em] uppercase opacity-70 mb-1">
                            {m.sender_name} · {m.sender_role}
                          </div>
                          <div className="text-base leading-relaxed whitespace-pre-wrap">{m.content}</div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <form onSubmit={send} className="hairline-t p-4 flex gap-3">
                  <input value={text} onChange={e => setText(e.target.value)}
                    data-testid="msg-input"
                    className="flex-1 bg-transparent border-b border-white/20 focus:border-[#FF3B30] outline-none py-2" />
                  <button data-testid="msg-send" className="btn-solid">
                    <Send className="w-4 h-4" /> Send
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center font-editorial italic text-3xl opacity-40">
                Select a conversation
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
