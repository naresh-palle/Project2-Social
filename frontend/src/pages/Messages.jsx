import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, Search, Pin, Archive, Edit3, Trash2, X } from "lucide-react";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { uploadMedia } from "@/lib/upload";
import { toast } from "sonner";

export default function Messages() {
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const [convos, setConvos] = useState([]);
  const [active, setActive] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [typingUser, setTypingUser] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState("");
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const typingTimer = useRef(null);

  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);

  const loadConvos = async () => {
    setLoadingConvos(true);
    try {
      const { data } = await api.get("/conversations");
      setConvos(data);
      const openId = sp.get("id");
      if (openId) {
        const c = data.find((c) => c.id === openId);
        if (c) setActive(c);
      } else if (data.length && !active) {
        setActive(data[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConvos(false);
    }
  };

  useEffect(() => {
    if (user) loadConvos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!active) return;
    setLoadingMsgs(true);
    api.get(`/conversations/${active.id}/messages`).then((r) => setMsgs(r.data)).finally(() => setLoadingMsgs(false));
    api.post(`/conversations/${active.id}/read`).catch(() => {});

    const otherId = active.participant_ids?.find((id) => id !== user?.id) || active.creator_id;
    if (otherId) {
      api.get(`/users/${otherId}/public`).then((r) => setOtherOnline(!!r.data?.online)).catch(() => {});
    }

    const token = localStorage.getItem("cr8_token");
    const base = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_API_URL || "";
    const es = new EventSource(
      `${base}/api/conversations/${active.id}/stream?token=${encodeURIComponent(token || "")}`
    );
    es.addEventListener("message", (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload.type === "typing") {
          if (payload.data?.user_id !== user?.id) {
            setTypingUser(payload.data?.typing ? payload.data?.name : null);
          }
          return;
        }
        if (payload.type === "message_edit") {
          setMsgs((prev) => prev.map((m) => (m.id === payload.data?.id ? payload.data : m)));
          return;
        }
        if (payload.type === "message_delete") {
          setMsgs((prev) => prev.filter((m) => m.id !== payload.data?.id));
          return;
        }
        const data = payload.data || payload;
        if (data.id) {
          setMsgs((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
        }
      } catch {}
    });
    es.onerror = () => {};
    return () => es.close();
  }, [active, user?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  const sendTyping = useCallback(() => {
    if (!active) return;
    api.post(`/conversations/${active.id}/typing`, { typing: true }).catch(() => {});
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      api.post(`/conversations/${active.id}/typing`, { typing: false }).catch(() => {});
    }, 2000);
  }, [active]);

  const send = async (e, mediaPayload = null) => {
    if (e) e.preventDefault();
    if ((!text.trim() && !mediaPayload) || !active) return;
    try {
      const body = mediaPayload || { content: text };
      let data;
      try {
        ({ data } = await api.post(`/conversations/${active.id}/messages-ex`, body));
      } catch {
        ({ data } = await api.post(`/conversations/${active.id}/messages`, body));
      }
      setMsgs((prev) => [...prev, data]);
      setText("");
      loadConvos();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Failed");
    }
  };

  const onAttach = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadMedia(file);
    if (result) {
      await send(null, {
        content: text || "",
        media_url: result.url,
        media_type: result.media_type === "audio" ? "voice" : result.media_type,
      });
      setText("");
    }
    e.target.value = "";
  };

  const searchMessages = async () => {
    if (!searchQ.trim()) return;
    try {
      const { data } = await api.get("/messages/search", { params: { q: searchQ } });
      setSearchResults(data || []);
    } catch {
      toast.error("Search failed");
    }
  };

  const pinConvo = async () => {
    if (!active) return;
    try {
      const { data } = await api.post(`/conversations/${active.id}/pin`);
      toast.success(data.pinned ? "Pinned" : "Unpinned");
      loadConvos();
    } catch {
      toast.error("Pin failed");
    }
  };

  const archiveConvo = async () => {
    if (!active) return;
    try {
      const { data } = await api.post(`/conversations/${active.id}/archive`);
      toast.success(data.archived ? "Archived" : "Unarchived");
      loadConvos();
    } catch {
      toast.error("Archive failed");
    }
  };

  const saveEdit = async (msgId) => {
    try {
      const { data } = await api.patch(`/messages/${msgId}`, { content: editText });
      setMsgs((prev) => prev.map((m) => (m.id === msgId ? data : m)));
      setEditingMsg(null);
      setEditText("");
    } catch {
      toast.error("Edit failed");
    }
  };

  const deleteMsg = async (msgId) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await api.delete(`/messages/${msgId}`);
      setMsgs((prev) => prev.filter((m) => m.id !== msgId));
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0]">
      <Nav />
      <div className="pt-24 max-w-[1600px] mx-auto px-6 md:px-10 pb-8">
        <div className="hairline-b pb-4 flex items-baseline justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ Correspondence</p>
            <h1 className="font-sans text-4xl md:text-6xl font-bold tracking-tight leading-[1.15] mt-1">Messages<span className="tick">.</span></h1>
          </div>
          <Link to="/dashboard" className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60 kinetic-underline">
            ← Dashboard
          </Link>
        </div>

        <div className="mt-4 flex gap-2 max-w-md">
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchMessages()}
            placeholder="Search messages…"
            className="flex-1 bg-transparent border border-white/20 px-3 py-2 font-mono text-xs rounded-xs"
          />
          <button type="button" onClick={searchMessages} className="px-3 py-2 border border-white/20"><Search className="w-4 h-4" /></button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-2 p-3 border border-white/10 bg-white/[0.02] max-w-md rounded-xs space-y-2">
            {searchResults.map((m) => (
              <div key={m.id} className="font-mono text-xs opacity-80 truncate">{m.content}</div>
            ))}
            <button type="button" onClick={() => setSearchResults([])} className="font-mono text-[10px] text-[#FF3B30] uppercase">Clear</button>
          </div>
        )}

        <div className="mt-6 grid grid-cols-12 gap-0 min-h-[560px]">
          <aside className="col-span-12 md:col-span-4 lg:col-span-3 hairline-t hairline-b hairline-l hairline-r max-h-[70vh] overflow-y-auto">
            {loadingConvos ? (
              <div className="p-4 space-y-3 animate-pulse">
                {[1, 2, 3].map((n) => <div key={n} className="h-20 bg-white/[0.03] border border-white/5 rounded-xs" />)}
              </div>
            ) : convos.length === 0 ? (
              <div className="p-10 font-sans text-xl font-medium tracking-tight opacity-60">No conversations yet.</div>
            ) : (
              convos.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActive(c)}
                  data-testid={`convo-${c.id}`}
                  className={`w-full text-left p-4 hairline-b hover:bg-white/5 transition-colors ${active?.id === c.id ? "bg-white/[0.04]" : ""}`}
                >
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">{c.campaign_brand}</div>
                  <div className="font-editorial text-xl leading-tight mt-1 truncate">{c.other_name}</div>
                  {c.last_message && <div className="text-xs opacity-70 mt-2 truncate">{c.last_message}</div>}
                </button>
              ))
            )}
          </aside>

          <section className="col-span-12 md:col-span-8 lg:col-span-9 hairline-t hairline-b hairline-r flex flex-col min-h-[70vh]">
            {active ? (
              <>
                <div className="p-6 hairline-b flex items-baseline justify-between">
                  <div>
                    <div className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">
                      {active.campaign_brand} · {active.campaign_title}
                    </div>
                    <div className="font-editorial text-3xl mt-1 flex items-center gap-2">
                      {active.other_name}
                      {otherOnline && <span className="font-mono text-[9px] text-[#34C759] uppercase">● Online</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={pinConvo} title="Pin" className="p-2 opacity-60 hover:opacity-100"><Pin className="w-4 h-4" /></button>
                    <button type="button" onClick={archiveConvo} title="Archive" className="p-2 opacity-60 hover:opacity-100"><Archive className="w-4 h-4" /></button>
                    {active.campaign_id && (
                      <Link
                        to={`/campaigns/${active.campaign_id}?from=messages&convoId=${active.id}`}
                        className="font-mono text-[11px] tracking-[0.28em] uppercase kinetic-underline text-[#FF3B30]"
                      >
                        View brief →
                      </Link>
                    )}
                  </div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4" data-testid="thread">
                  {loadingMsgs && <div className="text-center opacity-40 font-mono text-xs">Loading…</div>}
                  <AnimatePresence>
                    {msgs.filter((m) => !m.deleted).map((m) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[68%] p-4 group relative ${
                          m.sender_id === user?.id ? "bg-[#FF3B30] text-[#F4F4F0]" : "bg-white/5"
                        }`}>
                          <div className="font-mono text-[10px] tracking-[0.22em] uppercase opacity-70 mb-1">
                            {m.sender_name} · {m.sender_role}
                          </div>
                          {m.media_url && (
                            m.media_type === "video" ? (
                              <video src={m.media_url} controls className="max-w-full rounded-xs mb-2" />
                            ) : m.media_type === "voice" || m.media_type === "audio" ? (
                              <audio src={m.media_url} controls className="w-full mb-2" />
                            ) : (
                              <img src={m.media_url} alt="" className="max-w-full rounded-xs mb-2" />
                            )
                          )}
                          {editingMsg === m.id ? (
                            <div className="space-y-2">
                              <input value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full bg-black/40 border border-white/20 p-2 font-mono text-sm" />
                              <div className="flex gap-2">
                                <button type="button" onClick={() => saveEdit(m.id)} className="font-mono text-[9px] uppercase">Save</button>
                                <button type="button" onClick={() => setEditingMsg(null)} className="font-mono text-[9px] uppercase opacity-60">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-base leading-relaxed whitespace-pre-wrap">
                              {m.content}
                              {m.edited && <span className="text-[10px] opacity-50 ml-1">(edited)</span>}
                            </div>
                          )}
                          {m.sender_id === user?.id && editingMsg !== m.id && (
                            <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button type="button" onClick={() => { setEditingMsg(m.id); setEditText(m.content || ""); }} className="font-mono text-[9px] uppercase"><Edit3 className="w-3 h-3 inline" /></button>
                              <button type="button" onClick={() => deleteMsg(m.id)} className="font-mono text-[9px] uppercase"><Trash2 className="w-3 h-3 inline" /></button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {typingUser && (
                    <div className="font-mono text-[10px] opacity-50 italic">{typingUser} is typing…</div>
                  )}
                </div>
                <form onSubmit={send} className="hairline-t p-4 flex gap-3 items-center">
                  <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" hidden onChange={onAttach} />
                  <button type="button" onClick={() => fileRef.current?.click()} className="p-2 opacity-60 hover:opacity-100">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <input
                    value={text}
                    onChange={(e) => { setText(e.target.value); sendTyping(); }}
                    data-testid="msg-input"
                    className="flex-1 bg-transparent border-b border-white/20 focus:border-[#FF3B30] outline-none py-2"
                    placeholder="Type a message…"
                  />
                  <button data-testid="msg-send" type="submit" className="btn-solid">
                    <Send className="w-4 h-4" /> Send
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center font-sans text-2xl font-semibold tracking-tight opacity-40">
                Select a conversation
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
