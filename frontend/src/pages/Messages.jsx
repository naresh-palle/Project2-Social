import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Send, Paperclip, Search, Pin, Archive, Edit3, Trash2, Calendar, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { uploadMedia } from "@/lib/upload";
import { toast } from "sonner";
import { ThemeToaster } from "@/components/ThemeToaster";
import { displayPartnerName } from "@/lib/username";

function formatMsgTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatGroupDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0 && d.getDate() === now.getDate()) return "Today";
  if (diffDays === 1 || (diffDays === 0 && d.getDate() !== now.getDate())) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function groupMessages(messages) {
  const groups = [];
  let currentGroup = null;
  messages.forEach((m) => {
    const dateKey = formatGroupDate(m.created_at);
    if (!currentGroup || currentGroup.date !== dateKey) {
      currentGroup = { date: dateKey, msgs: [] };
      groups.push(currentGroup);
    }
    currentGroup.msgs.push(m);
  });
  return groups;
}

function upsertMsg(prev, msg) {
  if (!msg?.id) return prev;
  if (prev.some((m) => m.id === msg.id)) return prev;
  return [...prev, msg];
}

export default function Messages({ miniWidget = false }) {
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
  const [sending, setSending] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const typingTimer = useRef(null);
  const activeRef = useRef(null);

  const loadConvos = async () => {
    setLoadingConvos(true);
    try {
      let { data } = await api.get("/conversations");
      if (!data?.length) {
        try {
          await api.post("/seed/mock-comms");
          ({ data } = await api.get("/conversations"));
        } catch {}
      }
      setConvos(data || []);
      const openId = sp.get("id");
      if (openId) {
        const c = (data || []).find((c) => c.id === openId);
        if (c) setActive(c);
      } else if (data?.length && !activeRef.current && !miniWidget) {
        // Only auto-select on desktop full-page view, not on widget
        // Wait, user said: "WHen Click on message by default its showing existing chat instead of all chat messages"
        // Let's just never auto-select so they always see the list first.
        // setActive(data[0]); 
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingConvos(false);
    }
  };

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (user) loadConvos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!active) return;
    setLoadingMsgs(true);
    setMsgs([]);
    api
      .get(`/conversations/${active.id}/messages`)
      .then((r) => setMsgs(Array.isArray(r.data) ? r.data : []))
      .finally(() => setLoadingMsgs(false));
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

    const onChatMessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        // Named SSE events send the doc directly; legacy wraps {type,data}
        const data = payload?.type === "message" ? payload.data : payload?.data || payload;
        if (data?.id) setMsgs((prev) => upsertMsg(prev, data));
      } catch {}
    };
    const onTyping = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        const data = payload?.data || payload;
        if (data?.user_id !== user?.id) {
          setTypingUser(data?.typing ? data?.name : null);
        }
      } catch {}
    };
    const onEdit = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        const data = payload?.data || payload;
        if (data?.id) setMsgs((prev) => prev.map((m) => (m.id === data.id ? data : m)));
      } catch {}
    };
    const onDelete = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        const data = payload?.data || payload;
        if (data?.id) setMsgs((prev) => prev.filter((m) => m.id !== data.id));
      } catch {}
    };

    es.addEventListener("message", onChatMessage);
    es.addEventListener("typing", onTyping);
    es.addEventListener("message_edit", onEdit);
    es.addEventListener("message_delete", onDelete);
    es.onerror = () => {};
    return () => es.close();
  }, [active, user?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, typingUser]);

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
    if (sending || !active) return;
    const content = mediaPayload ? mediaPayload.content : text;
    if (!String(content || "").trim() && !mediaPayload?.media_url) return;

    const body = mediaPayload || { content: text.trim() };
    const outgoing = text;
    setText("");
    setSending(true);
    try {
      let data;
      try {
        ({ data } = await api.post(`/conversations/${active.id}/messages`, body));
      } catch {
        ({ data } = await api.post(`/conversations/${active.id}/messages-ex`, body));
      }
      setMsgs((prev) => upsertMsg(prev, data));
      loadConvos();
    } catch (err) {
      setText(outgoing);
      toast.error(formatApiError(err.response?.data?.detail) || "Failed");
    } finally {
      setSending(false);
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

  const visible = msgs.filter((m) => !m.deleted);

  return (
    <div className={miniWidget ? "h-full flex flex-col bg-[#0B0B0E] text-[#F4F4F0] overflow-hidden" : "min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col font-sans"}>
      {!miniWidget && <ThemeToaster />}
      {!miniWidget && <Nav />}
      <div className={miniWidget ? "flex-1 flex flex-col h-full min-h-0" : "pt-24 max-w-2xl mx-auto px-4 md:px-6 pb-8 flex-1 w-full"}>
        {!miniWidget && (
          <div className="mb-6">
            <Link to="/dashboard" className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors font-sans text-sm mb-2">
              <ChevronLeft className="w-4 h-4" /> Back
            </Link>
          </div>
        )}

        {!miniWidget && (
          <div className="mb-3 flex gap-2 max-w-sm shrink-0">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchMessages()}
              placeholder="Search messages…"
              className="flex-1 bg-transparent border border-white/20 px-3 py-1.5 font-sans text-sm rounded-sm"
            />
            <button type="button" onClick={searchMessages} className="px-2.5 py-1.5 border border-white/20 rounded-sm">
              <Search className="w-4 h-4" />
            </button>
          </div>
        )}
        {!miniWidget && searchResults.length > 0 && (
          <div className="mb-3 p-2.5 border border-white/10 bg-white/[0.02] max-w-sm rounded-sm space-y-1.5 shrink-0">
            {searchResults.map((m) => (
              <div key={m.id} className="font-sans text-xs opacity-80 truncate">{m.content}</div>
            ))}
            <button type="button" onClick={() => setSearchResults([])} className="font-sans text-[10px] text-[#FF3B30] uppercase">
              Clear
            </button>
          </div>
        )}

        <div className={miniWidget ? "flex-1 flex flex-col min-h-0 bg-transparent" : "flex-1 flex flex-col min-h-0 border border-white/10 rounded-sm overflow-hidden h-[min(70vh,640px)] bg-white/[0.01]"}>
          <aside className={active ? "hidden" : "flex-1 overflow-y-auto"}>
            {loadingConvos ? (
              <div className="p-3 space-y-2 animate-pulse">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-14 bg-white/[0.03] rounded-sm" />
                ))}
              </div>
            ) : convos.length === 0 ? (
              <div className="p-6">
                <div className="font-sans text-sm opacity-60">No conversations yet.</div>
              </div>
            ) : (
              convos.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActive(c)}
                  data-testid={`convo-${c.id}`}
                  className={`w-full text-left p-3 mb-2 border rounded-lg transition-all ${
                    active?.id === c.id 
                      ? "border-[#FF3B30]/50 bg-white/[0.06] shadow-[0_0_15px_rgba(255,59,48,0.1)]" 
                      : "border-white/10 bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-sans text-sm font-bold truncate text-[#F4F4F0]">{displayPartnerName(c)}</div>
                    {c.mock ? <span className="font-sans text-[9px] text-[#FF3B30] uppercase shrink-0">Demo</span> : null}
                  </div>
                  <div className="font-mono text-[9px] tracking-widest uppercase text-[#FF3B30] truncate mt-1">
                    {c.campaign_brand || c.campaign_title || "Direct"}
                  </div>
                  {c.last_message && <div className="font-sans text-xs opacity-60 mt-1.5 truncate leading-relaxed">{c.last_message}</div>}
                </button>
              ))
            )}
          </aside>

          <section className={!active ? "hidden" : "flex-1 flex flex-col min-h-0 bg-[#0B0B0E]"}>
            {active ? (
              <div className="flex flex-col h-full relative">
                <header className="p-4 border-b border-white/5 flex items-center justify-between bg-[#111116] shrink-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <button onClick={() => setActive(null)} className="p-2 -ml-2 opacity-60 hover:opacity-100">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                  <div className="min-w-0">
                    <div className="font-sans text-sm font-semibold truncate flex items-center gap-2">
                      {displayPartnerName(active)}
                      {otherOnline && <span className="font-sans text-[9px] text-[#34C759] uppercase">Online</span>}
                    </div>
                    <div className="font-sans text-[10px] opacity-50 truncate">
                      {active.campaign_brand}
                      {active.campaign_title ? ` · ${active.campaign_title}` : ""}
                    </div>
                  </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={pinConvo} title="Pin" className="p-1.5 opacity-60 hover:opacity-100">
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={archiveConvo} title="Archive" className="p-1.5 opacity-60 hover:opacity-100">
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                    {active.campaign_id && (
                      <Link
                        to={`/campaigns/${active.campaign_id}?from=messages&convoId=${active.id}`}
                        className="font-sans text-[10px] uppercase tracking-wider text-[#FF3B30] px-1"
                      >
                        Brief
                      </Link>
                    )}
                  </div>
                </header>

                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2a1a1f] via-[#0B0B0E] to-[#0B0B0E] custom-scrollbar" data-testid="thread">
                  {loadingMsgs && <div className="text-center opacity-40 font-sans text-xs py-6">Loading…</div>}
                  {groupMessages(visible).map((group, gIdx) => (
                    <div key={`group-${gIdx}`} className="space-y-4">
                      <div className="flex justify-center sticky top-0 z-10">
                        <span className="bg-[#1A1A24]/80 backdrop-blur-md border border-white/5 text-[10px] uppercase tracking-widest font-mono px-4 py-1.5 rounded-full text-white/50 shadow-xl flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          {group.date}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <AnimatePresence initial={false}>
                          {group.msgs.map((m, mIdx) => {
                            const mine = m.sender_id === user?.id;
                            const prevMsg = mIdx > 0 ? group.msgs[mIdx - 1] : null;
                            const isConsecutive = prevMsg && prevMsg.sender_id === m.sender_id;
                            return (
                              <motion.div 
                                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                key={m.id} 
                                className={`flex ${mine ? "justify-end" : "justify-start"} ${isConsecutive ? "mt-1" : "mt-4"}`}
                              >
                                <div
                                  className={`max-w-[85%] md:max-w-[70%] px-4 py-3 group relative shadow-2xl ${
                                    mine 
                                      ? "bg-gradient-to-br from-[#FF3B30] to-[#E52D27] text-white rounded-2xl rounded-tr-sm" 
                                      : "bg-white/[0.04] border border-white/5 backdrop-blur-md rounded-2xl rounded-tl-sm text-[#F4F4F0]"
                                  }`}
                                >
                                  {!mine && !isConsecutive && (
                                    <div className="font-sans text-[10px] text-[#FF3B30] font-semibold tracking-wider uppercase mb-1">
                                      {m.sender_name}
                                    </div>
                                  )}
                                  {m.media_url && (
                                    m.media_type === "video" ? (
                                      <video src={m.media_url} controls className="max-w-full rounded-xl mb-2" />
                                    ) : m.media_type === "voice" || m.media_type === "audio" ? (
                                      <audio src={m.media_url} controls className="w-full mb-2" />
                                    ) : (
                                      <img src={m.media_url} alt="" className="max-w-full rounded-xl mb-2 object-cover max-h-[300px]" />
                                    )
                                  )}
                                  {editingMsg === m.id ? (
                                    <div className="space-y-2">
                                      <input
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        className="w-full bg-black/40 border border-white/20 px-3 py-2 font-sans text-sm rounded-lg outline-none focus:border-white/50 transition-colors"
                                        autoFocus
                                      />
                                      <div className="flex gap-3 justify-end">
                                        <button type="button" onClick={() => setEditingMsg(null)} className="font-sans text-[10px] uppercase opacity-60 hover:opacity-100">
                                          Cancel
                                        </button>
                                        <button type="button" onClick={() => saveEdit(m.id)} className="font-sans text-[10px] uppercase font-bold text-white">
                                          Save
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="font-sans text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                                      {m.content}
                                      {m.edited && <span className="text-[9px] opacity-40 ml-2 italic tracking-widest uppercase">(edited)</span>}
                                    </div>
                                  )}
                                  <div className={`mt-2 flex items-center gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                                    <span className={`font-sans text-[9px] tracking-widest uppercase ${mine ? "text-white/60" : "text-white/40"}`}>
                                      {formatMsgTime(m.created_at)}
                                    </span>
                                    {mine && editingMsg !== m.id && (
                                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0 absolute -left-16 bottom-2 bg-[#1A1A24] p-1.5 rounded-full border border-white/10 shadow-xl">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingMsg(m.id);
                                            setEditText(m.content || "");
                                          }}
                                          className="text-white/50 hover:text-white"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button type="button" onClick={() => deleteMsg(m.id)} className="text-white/50 hover:text-[#FF3B30]">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </div>
                  ))}
                  {typingUser && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-white/40 px-4">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                      <span className="font-sans text-[11px] tracking-wide">{typingUser} is typing...</span>
                    </motion.div>
                  )}
                </div>

                <form onSubmit={send} className="bg-[#111116] border-t border-white/5 p-4 flex gap-3 items-center shrink-0">
                  <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" hidden onChange={onAttach} />
                  <button type="button" onClick={() => fileRef.current?.click()} className="p-2 opacity-60 hover:opacity-100">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <input
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      sendTyping();
                    }}
                    data-testid="msg-input"
                    disabled={sending}
                    className="flex-1 bg-white/5 border border-white/10 focus:border-[#FF3B30] outline-none rounded-full px-3 py-2 font-sans text-sm"
                    placeholder="Message…"
                  />
                  <button
                    data-testid="msg-send"
                    type="submit"
                    disabled={sending || !text.trim()}
                    className="inline-flex items-center justify-center gap-1.5 bg-[#FF3B30] text-white rounded-full px-3.5 py-2 font-sans text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center font-sans text-sm opacity-40">
                Select a conversation
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
