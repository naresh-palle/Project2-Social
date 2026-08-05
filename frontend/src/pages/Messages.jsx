import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Send, Paperclip, Search, Pin, Archive, Edit3, Trash2 } from "lucide-react";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { uploadMedia } from "@/lib/upload";
import { toast } from "sonner";
import { ThemeToaster } from "@/components/ThemeToaster";

function formatMsgTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function upsertMsg(prev, msg) {
  if (!msg?.id) return prev;
  if (prev.some((m) => m.id === msg.id)) return prev;
  return [...prev, msg];
}

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
      } else if (data?.length && !activeRef.current) {
        setActive(data[0]);
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
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0]">
      <ThemeToaster />
      <Nav />
      <div className="pt-24 max-w-6xl mx-auto px-4 md:px-6 pb-8">
        <div className="pb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight">Messages</h1>
            <p className="font-sans text-xs opacity-50 mt-0.5">Inbox</p>
          </div>
          <Link to="/dashboard" className="font-sans text-xs uppercase tracking-widest opacity-60 hover:opacity-100">
            ← Dashboard
          </Link>
        </div>

        <div className="mb-3 flex gap-2 max-w-sm">
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
        {searchResults.length > 0 && (
          <div className="mb-3 p-2.5 border border-white/10 bg-white/[0.02] max-w-sm rounded-sm space-y-1.5">
            {searchResults.map((m) => (
              <div key={m.id} className="font-sans text-xs opacity-80 truncate">{m.content}</div>
            ))}
            <button type="button" onClick={() => setSearchResults([])} className="font-sans text-[10px] text-[#FF3B30] uppercase">
              Clear
            </button>
          </div>
        )}

        <div className="grid grid-cols-12 border border-white/10 rounded-sm overflow-hidden h-[min(70vh,640px)] bg-white/[0.01]">
          <aside className="col-span-12 md:col-span-4 lg:col-span-3 border-b md:border-b-0 md:border-r border-white/10 overflow-y-auto max-h-[40vh] md:max-h-none">
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
                  className={`w-full text-left px-3 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors ${
                    active?.id === c.id ? "bg-white/[0.06]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-sans text-sm font-semibold truncate">{c.other_name}</div>
                    {c.mock ? <span className="font-sans text-[9px] text-[#FF3B30] uppercase shrink-0">Demo</span> : null}
                  </div>
                  <div className="font-sans text-[10px] opacity-50 truncate mt-0.5">
                    {c.campaign_brand || c.campaign_title || "Direct"}
                  </div>
                  {c.last_message && <div className="font-sans text-xs opacity-60 mt-1 truncate">{c.last_message}</div>}
                </button>
              ))
            )}
          </aside>

          <section className="col-span-12 md:col-span-8 lg:col-span-9 flex flex-col min-h-0">
            {active ? (
              <>
                <div className="px-3 py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
                  <div className="min-w-0">
                    <div className="font-sans text-sm font-semibold truncate flex items-center gap-2">
                      {active.other_name}
                      {otherOnline && <span className="font-sans text-[9px] text-[#34C759] uppercase">Online</span>}
                    </div>
                    <div className="font-sans text-[10px] opacity-50 truncate">
                      {active.campaign_brand}
                      {active.campaign_title ? ` · ${active.campaign_title}` : ""}
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
                </div>

                <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2" data-testid="thread">
                  {loadingMsgs && <div className="text-center opacity-40 font-sans text-xs py-6">Loading…</div>}
                  {visible.map((m) => {
                    const mine = m.sender_id === user?.id;
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[78%] md:max-w-[65%] px-3 py-2 rounded-2xl group relative ${
                            mine ? "bg-[#FF3B30] text-white rounded-br-md" : "bg-white/10 rounded-bl-md"
                          }`}
                        >
                          {!mine && (
                            <div className="font-sans text-[10px] opacity-60 mb-0.5 truncate">
                              {m.sender_name}
                            </div>
                          )}
                          {m.media_url && (
                            m.media_type === "video" ? (
                              <video src={m.media_url} controls className="max-w-full rounded-md mb-1.5" />
                            ) : m.media_type === "voice" || m.media_type === "audio" ? (
                              <audio src={m.media_url} controls className="w-full mb-1.5" />
                            ) : (
                              <img src={m.media_url} alt="" className="max-w-full rounded-md mb-1.5" />
                            )
                          )}
                          {editingMsg === m.id ? (
                            <div className="space-y-1.5">
                              <input
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="w-full bg-black/40 border border-white/20 px-2 py-1 font-sans text-sm rounded-sm"
                              />
                              <div className="flex gap-2">
                                <button type="button" onClick={() => saveEdit(m.id)} className="font-sans text-[10px] uppercase">
                                  Save
                                </button>
                                <button type="button" onClick={() => setEditingMsg(null)} className="font-sans text-[10px] uppercase opacity-60">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="font-sans text-sm leading-snug whitespace-pre-wrap break-words">
                              {m.content}
                              {m.edited && <span className="text-[10px] opacity-50 ml-1">(edited)</span>}
                            </div>
                          )}
                          <div className={`mt-1 flex items-center gap-2 ${mine ? "justify-between" : "justify-start"}`}>
                            <span className={`font-sans text-[10px] ${mine ? "opacity-80" : "opacity-45"}`}>
                              {formatMsgTime(m.created_at)}
                            </span>
                            {mine && editingMsg !== m.id && (
                              <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingMsg(m.id);
                                    setEditText(m.content || "");
                                  }}
                                  className="opacity-80 hover:opacity-100"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button type="button" onClick={() => deleteMsg(m.id)} className="opacity-80 hover:opacity-100">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {typingUser && (
                    <div className="font-sans text-[11px] opacity-45 italic px-1">{typingUser} is typing…</div>
                  )}
                </div>

                <form onSubmit={send} className="border-t border-white/10 px-3 py-2.5 flex gap-2 items-center shrink-0">
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
              </>
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
