import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MessageCircle, UserPlus, UserMinus, Ban, Flag, Loader2, ArrowLeft, User } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { formatUsername, displayAccountName } from "@/lib/username";
import { toast } from "sonner";
import { ThemeToaster } from "@/components/ThemeToaster";

export default function PublicProfile() {
  const { userId } = useParams();
  const { user: me } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportReason, setReportReason] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [actionBusy, setActionBusy] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/users/${userId}/public`);
      setProfile(data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Profile not found");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const follow = async () => {
    setActionBusy("follow");
    try {
      const { data } = await api.post("/follow", { user_id: userId });
      toast.success(data.status === "pending" ? "Follow request sent" : "Following");
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed");
    } finally {
      setActionBusy(null);
    }
  };

  const unfollow = async () => {
    setActionBusy("unfollow");
    try {
      await api.post("/unfollow", { user_id: userId });
      toast.success(profile?.follow_pending ? "Request cancelled" : "Unfollowed");
      await load();
    } catch {
      toast.error("Failed to unfollow");
    } finally {
      setActionBusy(null);
    }
  };

  const block = async () => {
    if (!window.confirm("Block this user?")) return;
    setActionBusy("block");
    try {
      await api.post("/privacy/block", { user_id: userId });
      toast.success("User blocked");
      nav(-1);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Block failed");
    } finally {
      setActionBusy(null);
    }
  };

  const report = async () => {
    if (!reportReason.trim()) return;
    setActionBusy("report");
    try {
      await api.post("/reports", { target_type: "user", target_id: userId, reason: reportReason });
      toast.success("Report submitted");
      setShowReport(false);
      setReportReason("");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Report failed");
    } finally {
      setActionBusy(null);
    }
  };

  const dm = async () => {
    setActionBusy("dm");
    try {
      const { data } = await api.post("/conversations/dm", { user_id: userId });
      nav(`/messages?id=${data.id}`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Could not open DM");
    } finally {
      setActionBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
        <Nav />
        <ThemeToaster />
        <div className="pt-24 px-6 md:px-10">
          <button onClick={() => nav(-1)} className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-white/50 hover:text-[#FF3B30] mb-8">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
        <Nav />
        <ThemeToaster />
        <div className="pt-24 px-6 md:px-10">
          <button onClick={() => nav(-1)} className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-white/50 hover:text-[#FF3B30] mb-8">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center font-sans text-2xl font-medium opacity-40">User not found</div>
      </div>
    );
  }

  const isMe = String(me?.id || "") === String(userId || "");
  const displayName = displayAccountName(profile, "Profile");
  const busy = !!actionBusy;

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
      <Nav />
      <ThemeToaster />
      <div className="pt-24 flex-1">
        {profile.cover_photo && (
          <div className="h-48 md:h-64 w-full overflow-hidden">
            <img src={profile.cover_photo} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="max-w-3xl mx-auto px-6 md:px-10 pb-24 -mt-16 relative">
          <div className="absolute -top-12 left-6 md:left-10 z-10">
            <button onClick={() => nav(-1)} className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] uppercase text-white/50 hover:text-[#FF3B30] bg-[#0B0B0E]/50 px-3 py-1.5 rounded-sm backdrop-blur-md border border-white/10">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          </div>
          <div className="flex items-end gap-6">
            {profile.avatar ? (
              <img src={profile.avatar} alt="" className="w-28 h-28 rounded-full object-cover border-4 border-[#0B0B0E] z-10 relative bg-[#0B0B0E]" />
            ) : (
              <div className="w-28 h-28 rounded-full bg-[#121212] border-4 border-[#0B0B0E] flex items-center justify-center z-10 relative text-white/50">
                <User className="w-12 h-12" />
              </div>
            )}
            <div className="flex-1 pb-2">
              <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight">{displayName}</h1>
              {(profile.role === "owner" || profile.role === "agent") && profile.company && (
                <p className="font-sans text-sm text-white/70 mt-1">{profile.company}</p>
              )}
            </div>
          </div>

          {profile.bio && <p className="mt-6 font-mono text-sm leading-relaxed text-white/80">{profile.bio}</p>}

          <div className="mt-4 flex gap-6 font-mono text-xs uppercase tracking-widest">
            <span><strong className="text-white">{profile.followers_count ?? 0}</strong> Followers</span>
            <span><strong className="text-white">{profile.following_count ?? 0}</strong> Following</span>
            {profile.is_private && <span className="text-orange-400">Private</span>}
          </div>

          {!isMe && (
            <div className="mt-8 flex flex-wrap gap-3">
              {profile.is_following ? (
                <button type="button" onClick={unfollow} disabled={busy} className="btn-action bg-white/10 disabled:opacity-50">
                  {actionBusy === "unfollow" ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                  Unfollow
                </button>
              ) : profile.follow_pending ? (
                <button type="button" onClick={unfollow} disabled={busy} className="btn-action bg-white/10 disabled:opacity-50" title="Cancel follow request">
                  {actionBusy === "unfollow" ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />}
                  Cancel request
                </button>
              ) : (
                <button type="button" onClick={follow} disabled={busy} className="btn-action bg-[#FF3B30] disabled:opacity-50">
                  {actionBusy === "follow" ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Follow
                </button>
              )}
              <button type="button" onClick={dm} disabled={busy} className="btn-action bg-white/10 disabled:opacity-50">
                {actionBusy === "dm" ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                Message
              </button>
              <button type="button" onClick={() => setShowReport(true)} disabled={busy} className="btn-action bg-white/10 disabled:opacity-50">
                <Flag className="w-4 h-4" /> Report
              </button>
              <button type="button" onClick={block} disabled={busy} className="btn-action border border-[#FF3B30]/40 text-[#FF3B30] disabled:opacity-50">
                <Ban className="w-4 h-4" /> Block
              </button>
            </div>
          )}

          {isMe && (
            <Link to="/profile/edit" className="inline-block mt-8 btn-action bg-[#FF3B30]">Edit Profile</Link>
          )}
        </div>
      </div>

      {showReport && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-white/20 p-6 max-w-md w-full rounded-sm space-y-4">
            <h3 className="font-editorial text-2xl">Report User</h3>
            <textarea
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="Reason for report…"
              className="w-full bg-black/60 border border-white/20 p-3 font-mono text-sm h-24 rounded-xs"
            />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowReport(false)} className="font-mono text-xs uppercase px-4 py-2 border border-white/20">Cancel</button>
              <button type="button" onClick={report} disabled={busy} className="font-mono text-xs uppercase px-4 py-2 bg-[#FF3B30] font-bold disabled:opacity-50">Submit</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
      <style>{`.btn-action { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.65rem 1.25rem; font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.15em; font-weight: bold; cursor: pointer; }`}</style>
    </div>
  );
}
