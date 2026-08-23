import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MessageCircle, UserPlus, UserMinus, Ban, Flag, Loader2, Sparkles } from "lucide-react";
import { AiIcon } from "@/components/AiIcon";

import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { displayAccountName } from "@/lib/username";
import { toast } from "sonner";

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

  const targetId = profile?.id || userId;

  const follow = async () => {
    if (!targetId) return;
    setActionBusy("follow");
    try {
      const { data } = await api.post("/follow", { user_id: targetId });
      toast.success(data.status === "pending" ? "Follow request sent" : "Following");
      await load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed");
    } finally {
      setActionBusy(null);
    }
  };

  const unfollow = async () => {
    if (!targetId) return;
    setActionBusy("unfollow");
    try {
      await api.post("/unfollow", { user_id: targetId });
      toast.success(profile?.follow_pending ? "Request cancelled" : "Unfollowed");
      await load();
    } catch {
      toast.error("Failed to unfollow");
    } finally {
      setActionBusy(null);
    }
  };

  const block = async () => {
    if (!targetId) return;
    toast("Block this user?", {
      action: {
        label: "Block",
        onClick: async () => {
          setActionBusy("block");
          try {
            await api.post("/privacy/block", { user_id: targetId });
            toast.success("User blocked");
            nav(-1);
          } catch (e) {
            toast.error(formatApiError(e.response?.data?.detail) || "Block failed");
          } finally {
            setActionBusy(null);
          }
        }
      },
      cancel: {
        label: "Cancel"
      }
    });
  };

  const report = async () => {
    if (!reportReason.trim() || !targetId) return;
    setActionBusy("report");
    try {
      await api.post("/reports", { target_type: "user", target_id: targetId, reason: reportReason });
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
    if (!targetId) return;
    setActionBusy("dm");
    try {
      const { data } = await api.post("/conversations/dm", { user_id: targetId });
      nav(`/messages?id=${data.id}`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Could not open DM");
    } finally {
      setActionBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0]">
        
        
        <div className="pt-4 px-0 sm:px-2 max-w-4xl mx-auto flex flex-col items-start gap-8">
          <button onClick={() => nav(-1)} className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors font-sans text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m15 18-6-6 6-6"/></svg> Back
          </button>
          <div className="text-center font-sans text-2xl font-medium opacity-40 w-full">User not found</div>
        </div>
      </div>
    );
  }

  const param = String(userId || "").toLowerCase().replace(/^@/, "");
  const meHandle = String(me?.handle || "").toLowerCase().replace(/^@/, "");
  const meUsername = String(me?.username || "").toLowerCase().replace(/^@/, "");
  const profileHandle = String(profile?.handle || "").toLowerCase().replace(/^@/, "");
  const profileUsername = String(profile?.username || "").toLowerCase().replace(/^@/, "");
  const isMe = Boolean(
    me?.id && (
      String(me.id) === String(profile.id || "") ||
      String(me.id) === String(userId || "") ||
      (param && (param === meHandle || param === meUsername || param === profileHandle || param === profileUsername))
    )
  );
  const displayName = displayAccountName(profile, "Profile");
  const busy = !!actionBusy;

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
      
      
      <div className="pt-2 flex-1">
        <div className="max-w-4xl mx-auto px-0 sm:px-2 mb-6 flex flex-col items-start gap-4">
          <button onClick={() => nav(-1)} className="inline-flex items-center gap-2 text-white/50 hover:text-white transition-colors font-sans text-sm shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="m15 18-6-6 6-6"/></svg> Back
          </button>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6 mb-8 w-full">
              <div>
                <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
                  <AiIcon name="sparkles" className="w-3.5 h-3.5" /> ⚡ Public Profile
                </p>
                <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight mt-2">Profile</h1>
              </div>
            </div>
        </div>
        <div className="h-48 md:h-64 w-full overflow-hidden max-w-6xl mx-auto rounded-t-xl">
            {profile.cover_photo ? (
              <img src={profile.cover_photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full"
                style={{
                  background: "linear-gradient(135deg, #0B0B0E 0%, #1a0a0a 30%, #2d0505 55%, #1a0505 75%, #0B0B0E 100%)",
                }}
              >
                <div className="w-full h-full flex items-center justify-center opacity-20">
                  <img
                    src={`${process.env.PUBLIC_URL}/flugr-logo.png`}
                    alt=""
                    className="h-16 md:h-24 w-auto object-contain select-none"
                  />
                </div>
              </div>
            )}
          </div>
        <div className="max-w-3xl mx-auto px-0 sm:px-2 pb-8 -mt-10 sm:-mt-16 relative">
          <div className="flex items-end gap-6">
            <div className="relative w-28 h-28 shrink-0">
              {profile.avatar && (
                <img src={profile.avatar} alt="" className="w-full h-full rounded-full object-cover border-4 border-[#0B0B0E] relative z-10" onError={(e) => e.currentTarget.style.display = 'none'} />
              )}
              <div
                className="w-full h-full absolute inset-0 z-0 rounded-full border-4 border-[#0B0B0E] flex items-center justify-center font-sans text-4xl font-bold"
                style={{ backgroundColor: `hsl(${((displayName || "flugr").charCodeAt(0) * 47) % 360}, 60%, 32%)` }}
              >
                {(displayName || "?")[0]?.toUpperCase()}
              </div>
            </div>
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
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <span className="font-mono text-[10px] tracking-widest uppercase text-white/40 px-3 py-2 border border-white/10 rounded-full">
                This is you
              </span>
              <Link to="/profile/edit" className="inline-block btn-action bg-[#FF3B30]">Edit Profile</Link>
              <Link to="/profile" className="inline-block btn-action bg-white/10">Back to Profile</Link>
            </div>
          )}
        </div>
      </div>

      {showReport && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#121212] border border-white/20 p-6 max-w-md w-full rounded-3xl space-y-4">
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


      <style>{`.btn-action { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.65rem 1.25rem; font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.15em; font-weight: bold; cursor: pointer; }`}</style>
    </div>
  );
}
