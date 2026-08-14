import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Heart, MessageSquare, Share2, Plus, RefreshCw, Bookmark, Repeat2,
  Pin, Trash2, Edit3, X, Image, Link2, BarChart2, Search, ExternalLink, Flame, CheckCircle2, FileText, ArrowLeft,
  Loader2, Send, MoreHorizontal, Sparkle
} from "lucide-react";

import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { uploadMedia } from "@/lib/upload";
import { formatUsername } from "@/lib/username";
import { toast } from "sonner";

const MODES = [
  { id: "campaigns", label: "Campaigns" },
  { id: "latest", label: "Latest" },
  { id: "trending", label: "Trending" },
  { id: "personalized", label: "For You" },
];

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [mode, setMode] = useState("campaigns");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [suggested, setSuggested] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [commentPost, setCommentPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [editingComment, setEditingComment] = useState(null);
  const loadMoreRef = useRef(null);

  const fetchFeed = useCallback(async (reset = false) => {
    if (reset) setRefreshing(true);
    else if (!reset && cursor) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = { mode, limit: 20 };
      if (!reset && cursor) params.cursor = cursor;
      const { data } = await api.get("/feed", { params });
      const items = data.items || [];
      setPosts((prev) => (reset ? items : [...prev, ...items]));
      setCursor(data.next_cursor || null);
      setSuggested(data.suggested_people || []);
    } catch {
      toast.error("Failed to load feed");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [mode, cursor]);

  useEffect(() => {
    setPosts([]);
    setCursor(null);
    setLoading(true);
    api.get("/feed", { params: { mode, limit: 20 } })
      .then(({ data }) => {
        setPosts(data.items || []);
        setCursor(data.next_cursor || null);
        setSuggested(data.suggested_people || []);
      })
      .catch(() => toast.error("Failed to load feed"))
      .finally(() => setLoading(false));
  }, [mode]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !cursor) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !loadingMore && cursor) fetchFeed(false); },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [cursor, loadingMore, fetchFeed]);

  const refresh = () => {
    setCursor(null);
    fetchFeed(true);
  };

  const toggleLike = async (post) => {
    try {
      const { data } = await api.post(`/posts/${post.id}/like`);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, liked: data.liked, likes_count: (p.likes_count || 0) + (data.liked ? 1 : -1) }
            : p
        )
      );
    } catch {
      toast.error("Like failed");
    }
  };

  const toggleSave = async (post) => {
    try {
      const { data } = await api.post(`/posts/${post.id}/save`);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, saved: data.saved } : p)));
      toast.success(data.saved ? "Saved" : "Removed from saves");
    } catch {
      toast.error("Save failed");
    }
  };

  const toggleBookmark = async (post) => {
    try {
      const { data } = await api.post(`/posts/${post.id}/bookmark`);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, bookmarked: data.bookmarked } : p)));
    } catch {
      toast.error("Bookmark failed");
    }
  };

  const sharePost = async (post) => {
    try {
      const { data } = await api.post(`/posts/${post.id}/share`);
      const link = `${window.location.origin}${data.link || `/#/feed?post=${post.id}`}`;
      await navigator.clipboard.writeText(link);
      toast.success("Link copied to clipboard");
    } catch {
      const link = `${window.location.origin}/#/feed?post=${post.id}`;
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    }
  };

  const repost = async (post) => {
    try {
      await api.post(`/posts/${post.id}/repost`);
      toast.success("Reposted");
      refresh();
    } catch {
      toast.error("Repost failed");
    }
  };

  const quotePost = async (post) => {
    const text = window.prompt("Add a quote comment:");
    if (text === null) return;
    try {
      await api.post(`/posts/${post.id}/quote`, { text });
      toast.success("Quote posted");
      refresh();
    } catch {
      toast.error("Quote failed");
    }
  };

  const deletePost = async (post) => {
    toast("Delete this post?", {
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await api.delete(`/posts/${post.id}`);
            setPosts((prev) => prev.filter((p) => p.id !== post.id));
            toast.success("Post deleted");
          } catch {
            toast.error("Delete failed");
          }
        }
      },
      cancel: {
        label: "Cancel"
      }
    });
  };

  const pinPost = async (post) => {
    try {
      const { data } = await api.post(`/posts/${post.id}/pin`);
      toast.success(data.pinned ? "Pinned" : "Unpinned");
      refresh();
    } catch {
      toast.error("Pin failed");
    }
  };

  const openComments = async (post) => {
    setCommentPost(post);
    try {
      const { data } = await api.get(`/posts/${post.id}/comments`);
      setComments(data || []);
    } catch {
      setComments([]);
    }
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !commentPost) return;
    try {
      const { data } = await api.post(`/posts/${commentPost.id}/comments`, { text: commentText });
      setComments((prev) => [...prev, data]);
      setCommentText("");
      setPosts((prev) =>
        prev.map((p) => (p.id === commentPost.id ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p))
      );
    } catch {
      toast.error("Comment failed");
    }
  };

  const saveCommentEdit = async (commentId, text) => {
    try {
      await api.patch(`/comments/${commentId}`, { text });
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, text, edited: true } : c)));
      setEditingComment(null);
    } catch {
      toast.error("Edit failed");
    }
  };

  const deleteComment = async (commentId) => {
    try {
      await api.delete(`/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
      
      <div className="flex flex-col h-full overflow-y-auto w-full flex-1">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-6 mb-8">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> § Community Feed
            </p>
            <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight leading-none mt-2">Feed</h1>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={refresh} disabled={refreshing} className="p-3 border border-white/20 hover:border-[#FF3B30] rounded-xs">
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className="px-6 py-3 bg-[#FF3B30] font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create Post
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-8">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest border rounded-xs ${
                mode === m.id ? "bg-[#FF3B30] border-[#FF3B30]" : "border-white/20 text-white/60"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin opacity-50" /></div>
            ) : posts.length === 0 ? (
              <p className="font-sans text-xl font-medium tracking-tight opacity-40 text-center py-20">No posts yet. Be the first to share!</p>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  userId={user?.id}
                  onLike={() => toggleLike(post)}
                  onComment={() => openComments(post)}
                  onShare={() => sharePost(post)}
                  onSave={() => toggleSave(post)}
                  onBookmark={() => toggleBookmark(post)}
                  onRepost={() => repost(post)}
                  onQuote={() => quotePost(post)}
                  onDelete={() => deletePost(post)}
                  onPin={() => pinPost(post)}
                />
              ))
            )}
            {cursor && <div ref={loadMoreRef} className="py-8 text-center">
              {loadingMore && <Loader2 className="w-6 h-6 animate-spin mx-auto opacity-50" />}
            </div>}
          </div>

          <aside className="space-y-6">
            <div className="p-6 border border-white/15 bg-[#121212] rounded-xs">
              <h3 className="font-mono text-xs tracking-widest uppercase text-[#FF3B30] font-bold mb-4">Suggested People</h3>
              {suggested.length === 0 ? (
                <p className="font-mono text-xs opacity-40">No suggestions</p>
              ) : (
                suggested.map((u) => {
                  const label = formatUsername(u.username, u.handle) || "user";
                  return (
                    <Link
                      key={u.id}
                      to={`/u/${u.id}`}
                      className="flex items-center gap-3 py-2 hover:bg-white/5 rounded-xs px-2 -mx-2"
                    >
                      <div className="w-10 h-10 rounded-full border border-white/15 bg-white/[0.03] overflow-hidden shrink-0">
                        {u.avatar ? (
                          <img
                            src={u.avatar}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                      </div>
                      <span className="font-sans text-sm text-[#FF3B30] truncate">{label}</span>
                    </Link>
                  );
                })
              )}
            </div>
          </aside>
        </div>
      </div>

      {showCreate && <CreatePostModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); refresh(); }} />}
      {commentPost && (
        <CommentDrawer
          post={commentPost}
          comments={comments}
          text={commentText}
          setText={setCommentText}
          onSubmit={addComment}
          onClose={() => setCommentPost(null)}
          userId={user?.id}
          editingComment={editingComment}
          setEditingComment={setEditingComment}
          onSaveEdit={saveCommentEdit}
          onDeleteComment={deleteComment}
        />
      )}

    </div>
  );
}

function PostCard({ post, userId, onLike, onComment, onShare, onSave, onBookmark, onRepost, onQuote, onDelete, onPin }) {
  const [menu, setMenu] = useState(false);
  const isOwn = post.author_id === userId || post.author?.id === userId;
  const author = post.author || {};

  return (
    <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 border border-white/15 bg-[#121212] rounded-xs space-y-4">
      <div className="flex items-start justify-between">
        <Link to={`/u/${author.id}`} className="flex items-center gap-3">
          {author.avatar && <img src={author.avatar} alt="" className="w-11 h-11 rounded-full object-cover border border-white/20" />}
          <div>
            <div className="font-editorial text-lg font-bold">{author.name}</div>
            <div className="font-mono text-[10px] text-[#FF3B30] uppercase">{formatUsername(author.handle, author.username) || "user"} · {post.created_at?.slice(0, 10)}</div>
          </div>
        </Link>
        <div className="relative">
          {post.pinned && <Pin className="w-4 h-4 text-[#FF3B30] inline mr-2" />}
          <button type="button" onClick={() => setMenu(!menu)} className="p-1 opacity-60 hover:opacity-100"><MoreHorizontal className="w-4 h-4" /></button>
          {menu && isOwn && (
            <div className="absolute right-0 top-6 bg-[#0A0A0A] border border-white/20 rounded-xs z-10 min-w-[140px]">
              <button type="button" onClick={() => { onPin(); setMenu(false); }} className="block w-full text-left px-3 py-2 font-mono text-[10px] uppercase hover:bg-white/10">Pin</button>
              <button type="button" onClick={() => { onDelete(); setMenu(false); }} className="block w-full text-left px-3 py-2 font-mono text-[10px] uppercase text-[#FF3B30] hover:bg-white/10">Delete</button>
            </div>
          )}
        </div>
      </div>

      {post.title && <h3 className="font-editorial text-2xl font-bold">{post.title}</h3>}
      {post.text && <p className="font-mono text-sm text-white/80 whitespace-pre-wrap">{post.text}</p>}

      {post.media?.length > 0 && (
        <div className={`grid gap-2 ${post.media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {post.media.map((m, i) =>
            m.type === "video" || m.media_type === "video" ? (
              <video key={i} src={m.url} controls className="w-full rounded-xs border border-white/10" />
            ) : (
              <img key={i} src={m.url} alt="" className="w-full rounded-xs border border-white/10 object-cover" />
            )
          )}
        </div>
      )}
      {post.gif_url && <img src={post.gif_url} alt="" className="max-h-80 rounded-xs" />}
      {post.link_url && (
        <a href={post.link_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 font-mono text-xs text-[#007AFF]">
          <Link2 className="w-3.5 h-3.5" /> {post.link_url}
        </a>
      )}
      {post.poll && (
        <div className="p-4 border border-white/10 rounded-xs space-y-2">
          {(post.poll.options || []).map((opt, i) => (
            <div key={i} className="flex justify-between font-mono text-xs p-2 bg-white/5 rounded-xs">
              <span>{opt.text}</span>
              <span className="opacity-50">{opt.votes || 0} votes</span>
            </div>
          ))}
        </div>
      )}
      {post.hashtags?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {post.hashtags.map((t) => (
            <span key={t} className="font-mono text-[10px] text-[#FF3B30]">#{t}</span>
          ))}
        </div>
      )}

      <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-4 font-mono text-xs text-white/60">
        <button type="button" onClick={onLike} className={`flex items-center gap-1.5 hover:text-[#FF3B30] ${post.liked ? "text-[#FF3B30]" : ""}`}>
          <Heart className={`w-4 h-4 ${post.liked ? "fill-current" : ""}`} /> {post.likes_count || 0}
        </button>
        <button type="button" onClick={onComment} className="flex items-center gap-1.5 hover:text-white">
          <MessageSquare className="w-4 h-4" /> {post.comments_count || 0}
        </button>
        <button type="button" onClick={onShare} className="flex items-center gap-1.5 hover:text-white"><Share2 className="w-4 h-4" /></button>
        <button type="button" onClick={onSave} className={`flex items-center gap-1.5 ${post.saved ? "text-[#34C759]" : ""}`}><Bookmark className="w-4 h-4" /></button>
        <button type="button" onClick={onBookmark} className={post.bookmarked ? "text-yellow-400" : ""}><Bookmark className="w-4 h-4" /></button>
        <button type="button" onClick={onRepost} className="hover:text-white"><Repeat2 className="w-4 h-4" /></button>
        <button type="button" onClick={onQuote} className="hover:text-white font-mono text-[10px] uppercase">Quote</button>
      </div>
    </motion.article>
  );
}

function CreatePostModal({ onClose, onCreated }) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [media, setMedia] = useState([]);
  const [gifUrl, setGifUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [hasPoll, setHasPoll] = useState(false);
  const [status, setStatus] = useState("published");
  const [scheduledAt, setScheduledAt] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    setUploading(true);
    for (const file of files) {
      const result = await uploadMedia(file);
      if (result) setMedia((prev) => [...prev, { url: result.url, type: result.media_type }]);
    }
    setUploading(false);
    e.target.value = "";
  };

  const aiCaption = async () => {
    try {
      const { data } = await api.post("/ai/caption", { text, context: title });
      if (data.caption) setText(data.caption);
      toast.success("Caption generated");
    } catch {
      toast.error("AI caption failed");
    }
  };

  const aiHashtags = async () => {
    try {
      const { data } = await api.post("/ai/hashtags", { text });
      const tags = (data.hashtags || []).join(" ");
      setText((prev) => `${prev} ${tags}`.trim());
      toast.success("Hashtags added");
    } catch {
      toast.error("AI hashtags failed");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() && media.length === 0) {
      toast.error("Add text or media");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        text,
        title: title || undefined,
        media: media.length ? media : undefined,
        gif_url: gifUrl || undefined,
        link_url: linkUrl || undefined,
        category: category || undefined,
        status,
        scheduled_at: status === "scheduled" ? scheduledAt : undefined,
      };
      if (hasPoll) {
        const opts = pollOptions.filter(Boolean);
        if (opts.length >= 2) payload.poll = { options: opts.map((t) => ({ text: t, votes: 0 })) };
      }
      await api.post("/posts", payload);
      toast.success(status === "draft" ? "Draft saved" : status === "scheduled" ? "Post scheduled" : "Published!");
      onCreated();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Failed to create post");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <motion.form initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onSubmit={submit} className="bg-[#121212] border border-white/20 p-6 md:p-8 max-w-lg w-full rounded-3xl shadow-2xl space-y-4 my-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="font-editorial text-2xl font-bold">Create Post</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5 opacity-60" /></button>
        </div>

        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" className="w-full bg-black/60 border border-white/20 p-3 font-mono text-sm rounded-xs" />
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="What's on your mind? Use @mentions and #hashtags" rows={4} className="w-full bg-black/60 border border-white/20 p-3 font-mono text-sm rounded-xs resize-none" />

        {media.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {media.map((m, i) => (
              <div key={i} className="relative">
                {m.type === "video" ? <video src={m.url} className="h-20 rounded-xs" /> : <img src={m.url} alt="" className="h-20 rounded-xs object-cover" />}
                <button type="button" onClick={() => setMedia((prev) => prev.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 bg-[#FF3B30] rounded-full p-0.5"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" multiple hidden onChange={onFiles} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1 px-3 py-1.5 border border-white/20 font-mono text-[10px] uppercase">
            <Image className="w-3.5 h-3.5" /> {uploading ? "Uploading…" : "Media"}
          </button>
          <button type="button" onClick={aiCaption} className="flex items-center gap-1 px-3 py-1.5 border border-white/20 font-mono text-[10px] uppercase"><Sparkle className="w-3.5 h-3.5" /> AI Caption</button>
          <button type="button" onClick={aiHashtags} className="flex items-center gap-1 px-3 py-1.5 border border-white/20 font-mono text-[10px] uppercase"><BarChart2 className="w-3.5 h-3.5" /> AI Tags</button>
          <button type="button" onClick={() => setHasPoll(!hasPoll)} className="px-3 py-1.5 border border-white/20 font-mono text-[10px] uppercase">Poll</button>
        </div>

        <input value={gifUrl} onChange={(e) => setGifUrl(e.target.value)} placeholder="GIF URL (optional)" className="w-full bg-black/60 border border-white/20 p-2 font-mono text-xs rounded-xs" />
        <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Link URL (optional)" className="w-full bg-black/60 border border-white/20 p-2 font-mono text-xs rounded-xs" />
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (optional)" className="w-full bg-black/60 border border-white/20 p-2 font-mono text-xs rounded-xs" />

        {hasPoll && (
          <div className="space-y-2">
            {pollOptions.map((opt, i) => (
              <input key={i} value={opt} onChange={(e) => setPollOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))} placeholder={`Option ${i + 1}`} className="w-full bg-black/60 border border-white/20 p-2 font-mono text-xs rounded-xs" />
            ))}
            {pollOptions.length < 4 && (
              <button type="button" onClick={() => setPollOptions((prev) => [...prev, ""])} className="font-mono text-[10px] text-[#FF3B30]">+ Add option</button>
            )}
          </div>
        )}

        <div className="flex gap-3 font-mono text-xs">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="bg-black/60 border border-white/20 p-2 rounded-xs flex-1">
            <option value="published">Publish Now</option>
            <option value="draft">Save Draft</option>
            <option value="scheduled">Schedule</option>
          </select>
          {status === "scheduled" && (
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="bg-black/60 border border-white/20 p-2 rounded-xs flex-1" />
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-white/20 font-mono text-xs uppercase">Cancel</button>
          <button type="submit" disabled={busy} className="px-6 py-2 bg-[#FF3B30] font-mono text-xs uppercase font-bold">
            {busy ? "Posting…" : status === "draft" ? "Save Draft" : "Post"}
          </button>
        </div>
      </motion.form>
    </div>
  );
}

function CommentDrawer({ post, comments, text, setText, onSubmit, onClose, userId, editingComment, setEditingComment, onSaveEdit, onDeleteComment }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} className="relative w-full max-w-md bg-[#121212] border-l border-white/20 h-full flex flex-col">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-editorial text-xl">Comments</h3>
          <button type="button" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="p-3 bg-white/5 rounded-xs">
              <div className="font-mono text-[10px] opacity-60">{c.author?.name || "User"}</div>
              {editingComment === c.id ? (
                <EditCommentForm
                  initial={c.text}
                  onSave={(t) => onSaveEdit(c.id, t)}
                  onCancel={() => setEditingComment(null)}
                />
              ) : (
                <p className="font-mono text-sm mt-1">{c.text}{c.edited && <span className="text-[10px] opacity-40 ml-1">(edited)</span>}</p>
              )}
              {c.author_id === userId && editingComment !== c.id && (
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => setEditingComment(c.id)} className="font-mono text-[9px] uppercase text-[#FF3B30]"><Edit3 className="w-3 h-3 inline" /> Edit</button>
                  <button type="button" onClick={() => onDeleteComment(c.id)} className="font-mono text-[9px] uppercase opacity-50"><Trash2 className="w-3 h-3 inline" /> Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={onSubmit} className="p-4 border-t border-white/10 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="flex-1 bg-transparent border-b border-white/20 py-2 outline-none font-mono text-sm" />
          <button type="submit" className="p-2 bg-[#FF3B30]"><Send className="w-4 h-4" /></button>
        </form>
      </motion.div>
    </div>
  );
}

function EditCommentForm({ initial, onSave, onCancel }) {
  const [val, setVal] = useState(initial);
  return (
    <div className="mt-1 space-y-2">
      <input value={val} onChange={(e) => setVal(e.target.value)} className="w-full bg-black/60 border border-white/20 p-2 font-mono text-xs rounded-xs" />
      <div className="flex gap-2">
        <button type="button" onClick={() => onSave(val)} className="font-mono text-[9px] uppercase text-[#34C759]">Save</button>
        <button type="button" onClick={onCancel} className="font-mono text-[9px] uppercase opacity-50">Cancel</button>
      </div>
    </div>
  );
}
