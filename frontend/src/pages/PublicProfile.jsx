import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { MessageCircle, UserPlus, UserMinus, Ban, Flag, Loader2 } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function PublicProfile() {
  const { userId } = useParams();
  const { user: me } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportReason, setReportReason] = useState("");
  const [showReport, setShowReport] = useState(false);

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
  }, [userId]);

  const follow = async () => {
    try {
      const { data } = await api.post("/follow", { user_id: userId });
      toast.success(data.status === "pending" ? "Follow request sent" : "Following");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed");
    }
  };

  const unfollow = async () => {
    try {
      await api.post("/unfollow", { user_id: userId });
      toast.success("Unfollowed");
      load();
    } catch {
      toast.error("Failed to unfollow");
    }
  };

  const block = async () => {
    if (!window.confirm("Block this user?")) return;
    try {
      await api.post("/privacy/block", { user_id: userId });
      toast.success("User blocked");
      nav(-1);
    } catch {
      toast.error("Block failed");
    }
  };

  const report = async () => {
    if (!reportReason.trim()) return;
    try {
      await api.post("/reports", { target_type: "user", target_id: userId, reason: reportReason });
      toast.success("Report submitted");
      setShowReport(false);
      setReportReason("");
    } catch {
      toast.error("Report failed");
    }
  };

  const dm = async () => {
    try {
      const { data } = await api.post("/conversations/dm", { user_id: userId });
      nav(`/messages?id=${data.id}`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Could not open DM");
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
        <Nav />
        <div className="pt-32 text-center font-editorial text-3xl opacity-40">User not found</div>
      </div>
    );
  }

  const isMe = me?.id === userId;

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] flex flex-col">
      <Nav />
      <div className="pt-24 flex-1">
        {profile.cover_photo && (
          <div className="h-48 md:h-64 w-full overflow-hidden">
            <img src={profile.cover_photo} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="max-w-3xl mx-auto px-6 md:px-10 pb-24 -mt-16 relative">
          <div className="flex items-end gap-6">
            {profile.avatar ? (
              <img src={profile.avatar} alt="" className="w-28 h-28 rounded-full object-cover border-4 border-[#0B0B0E]" />
            ) : (
              <div className="w-28 h-28 rounded-full bg-white/10 border-4 border-[#0B0B0E] flex items-center justify-center font-editorial text-4xl">
                {(profile.username || profile.name || "?")[0]?.toUpperCase()}
              </div>
            )}
            <div className="flex-1 pb-2">
              <h1 className="font-editorial text-2xl md:text-3xl">
                {profile.username
                  ? `@${String(profile.username).replace(/^@/, "")}`
                  : (profile.handle
                      ? (String(profile.handle).startsWith("@") ? profile.handle : `@${profile.handle}`)
                      : (profile.name || "Profile"))}
              </h1>
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
                <button type="button" onClick={unfollow} className="btn-action bg-white/10">
                  <UserMinus className="w-4 h-4" /> Unfollow
                </button>
              ) : profile.follow_pending ? (
                <button type="button" disabled className="btn-action bg-white/5 opacity-60">Request Pending</button>
              ) : (
                <button type="button" onClick={follow} className="btn-action bg-[#FF3B30]">
                  <UserPlus className="w-4 h-4" /> Follow
                </button>
              )}
              <button type="button" onClick={dm} className="btn-action bg-white/10">
                <MessageCircle className="w-4 h-4" /> Message
              </button>
              <button type="button" onClick={() => setShowReport(true)} className="btn-action bg-white/10">
                <Flag className="w-4 h-4" /> Report
              </button>
              <button type="button" onClick={block} className="btn-action border border-[#FF3B30]/40 text-[#FF3B30]">
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
              <button type="button" onClick={report} className="font-mono text-xs uppercase px-4 py-2 bg-[#FF3B30] font-bold">Submit</button>
            </div>
          </div>
        </div>
      )}

      <Footer />
      <style>{`.btn-action { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.65rem 1.25rem; font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.15em; font-weight: bold; }`}</style>
    </div>
  );
}
