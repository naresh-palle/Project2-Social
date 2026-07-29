import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Heart, MessageSquare, Share2, Plus, Image, Send, ArrowRight } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth";
import { toast, Toaster } from "sonner";

const INITIAL_COMMUNITY_FEED = [
  {
    id: "post-1",
    author: "Zara India Official",
    handle: "@zara_india",
    role: "Verified Brand",
    time: "15 mins ago",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400",
    title: "🚀 Urgent Brief Drop: Summer Fest Festival Collection 2026",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=1200",
    budget: "₹1,80,000",
    category: "Fashion & Style",
    desc: "We are seeking 5 fashion creators to showcase our new sustainable linen collection for upcoming summer drops. Guaranteed 100% upfront escrow payout.",
    likes: 42,
    comments: 14
  },
  {
    id: "post-2",
    author: "Kai Monroe",
    handle: "@kai_monroe",
    role: "Featured Creator",
    time: "2 hours ago",
    avatar: "https://images.unsplash.com/photo-1700748910941-44f7577b0ba2?auto=format&fit=crop&q=80&w=400",
    title: "💡 Creator Case Study: How we delivered 5.2M reach with Upfront Escrow",
    image: "https://images.unsplash.com/photo-1700748909753-3d4f58eb8273?auto=format&fit=crop&q=80&w=1200",
    budget: "5.2M Reach",
    category: "Editorial & Lifestyle",
    desc: "Working with CR8 Studio ensured 100% upfront escrow locking before camera rolling. Zero delayed payouts and 100% Escrow Protection!",
    likes: 88,
    comments: 29
  },
  {
    id: "post-3",
    author: "HyperTech AI Labs",
    handle: "@hypertech_ai",
    role: "Tech Brand Partner",
    time: "4 hours ago",
    avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&q=80&w=400",
    title: "⚡ Tech Review Series: Looking for 3 AI & Gadget Creators",
    image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=1200",
    budget: "₹2,50,000",
    category: "Technology & SaaS",
    desc: "Demonstrate our new GPU workstation benchmarks. Free hardware provided + guaranteed instant escrow payment.",
    likes: 65,
    comments: 21
  }
];

export default function Feed() {
  const { user } = useAuth();
  const [feedItems, setFeedItems] = useState(INITIAL_COMMUNITY_FEED);
  const [postTitle, setPostTitle] = useState("");
  const [postDesc, setPostDesc] = useState("");
  const [postImg, setPostImg] = useState("");
  const [category, setCategory] = useState("Fashion & Style");
  const [showUploadModal, setShowUploadModal] = useState(false);

  const handleCreatePost = (e) => {
    e.preventDefault();
    if (!postTitle || !postDesc) {
      toast.error("Please fill in title and description");
      return;
    }

    const newPost = {
      id: `post-${Date.now()}`,
      author: user?.name || "Creator Partner",
      handle: user?.handle || `@${(user?.name || "creator").toLowerCase().replace(/\s+/g, '')}`,
      role: user?.role === "owner" ? "Brand Partner" : "Verified Creator",
      time: "Just now",
      avatar: user?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400",
      title: postTitle,
      image: postImg || "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=1200",
      budget: "Live Post",
      category: category,
      desc: postDesc,
      likes: 1,
      comments: 0
    };

    setFeedItems([newPost, ...feedItems]);
    setPostTitle("");
    setPostDesc("");
    setPostImg("");
    setShowUploadModal(false);
    toast.success("🎉 Published Live to Community Feed!");
  };

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] relative overflow-hidden flex flex-col justify-between" data-testid="feed-page">
      <Nav />
      <Toaster theme="dark" position="top-center" />

      <div className="pt-28 max-w-[1600px] mx-auto px-6 md:px-10 pb-24 w-full flex-1">
        {/* Header Stream Banner */}
        <div className="border-b border-white/10 pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> § Live Community Feed
            </p>
            <h1 className="font-editorial text-4xl md:text-6xl leading-[1.15] mt-2">
              Community <span className="italic text-[#FF3B30]">Feed.</span>
            </h1>
            <p className="font-mono text-xs opacity-60 mt-1 uppercase tracking-widest">
              Share work, discover brand campaign drops, and connect with verified creators
            </p>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="px-6 py-3 bg-[#FF3B30] hover:bg-[#e03126] text-white font-mono text-xs font-bold uppercase tracking-widest rounded-xs shadow-xl flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Create Feed Post 📸
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Feed Column */}
          <div className="lg:col-span-2 space-y-6">
            {feedItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 border border-white/15 bg-[#121212] rounded-xs space-y-4 shadow-2xl hover:border-[#FF3B30]/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={item.avatar} alt={item.author} className="w-11 h-11 rounded-full object-cover border border-white/20" />
                    <div>
                      <div className="font-editorial text-lg text-white font-bold">{item.author}</div>
                      <div className="font-mono text-[10px] text-[#FF3B30] uppercase tracking-wider">{item.handle} · {item.role} · {item.time}</div>
                    </div>
                  </div>
                  <span className="font-mono text-xs text-[#34C759] bg-[#34C759]/10 border border-[#34C759]/30 px-3 py-1 font-bold rounded-xs">{item.budget}</span>
                </div>

                {item.image && (
                  <div className="relative overflow-hidden rounded-xs aspect-video border border-white/10">
                    <img src={item.image} alt={item.title} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
                    <span className="absolute top-2 left-2 font-mono text-[9px] uppercase tracking-widest bg-black/80 px-2.5 py-1 text-white border border-white/10 font-bold">
                      {item.category}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="font-editorial text-2xl text-white font-bold">{item.title}</h3>
                  <p className="font-mono text-xs text-white/70 leading-relaxed">{item.desc}</p>
                </div>

                <div className="pt-4 border-t border-white/10 flex items-center justify-between font-mono text-xs">
                  <div className="flex gap-5 text-white/60">
                    <button onClick={() => toast.success("Liked post!")} className="hover:text-[#FF3B30] flex items-center gap-1.5">
                      <Heart className="w-4 h-4 text-[#FF3B30]" /> {item.likes} Likes
                    </button>
                    <button onClick={() => toast.info("Opening comments...")} className="hover:text-white flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4" /> {item.comments} Comments
                    </button>
                  </div>
                  <button onClick={() => toast.success("Shared post link to clipboard!")} className="px-3 py-1.5 border border-white/20 text-white/70 hover:text-white rounded-xs text-[10px] uppercase flex items-center gap-1">
                    <Share2 className="w-3.5 h-3.5" /> Share ↗
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Right Sidebar Stream Widgets */}
          <div className="space-y-6">
            <div className="p-6 border border-white/15 bg-[#121212] rounded-xs space-y-4">
              <h3 className="font-mono text-xs tracking-widest uppercase text-[#FF3B30] font-bold">🚀 Quick Actions</h3>
              <button
                onClick={() => setShowUploadModal(true)}
                className="w-full py-3 bg-[#FF3B30] text-white font-mono text-xs font-bold uppercase rounded-xs hover:bg-[#e03126] transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Upload New Feed Post
              </button>
              <Link to="/marketplace" className="w-full py-3 border border-white/20 text-white font-mono text-xs font-bold uppercase rounded-xs hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                Browse Marketplace Briefs →
              </Link>
            </div>

            <div className="p-6 border border-white/15 bg-[#121212] rounded-xs space-y-4">
              <h3 className="font-mono text-xs tracking-widest uppercase text-[#FF3B30] font-bold">🔥 Trending Creator Topics</h3>
              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-white/5 border border-white/10 rounded-xs">
                  <div className="text-white font-bold">#EscrowProtection</div>
                  <div className="text-[10px] text-white/50">100% Upfront Payout Guarantee</div>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-xs">
                  <div className="text-white font-bold">#EscrowProtection</div>
                  <div className="text-[10px] text-white/50">100% Guaranteed Upfront Lock</div>
                </div>
                <div className="p-3 bg-white/5 border border-white/10 rounded-xs">
                  <div className="text-white font-bold">#AIBriefMatching</div>
                  <div className="text-[10px] text-white/50">94% Instant Signal Score</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* UPLOAD FEED MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.form
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onSubmit={handleCreatePost}
            className="bg-[#121212] border border-white/20 p-6 md:p-8 max-w-lg w-full rounded-sm shadow-2xl space-y-6"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#FF3B30] font-bold">📸 Create Community Post</span>
                <h3 className="font-editorial text-2xl mt-1 text-white font-bold">Publish to Feed</h3>
              </div>
              <button type="button" onClick={() => setShowUploadModal(false)} className="text-white/60 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div>
                <label className="text-white/70 block mb-1">Post Title / Reel Headline</label>
                <input
                  type="text"
                  required
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder=""
                  className="w-full bg-black/60 border border-white/20 p-3 text-white rounded-xs focus:border-[#FF3B30] outline-none"
                />
              </div>

              <div>
                <label className="text-white/70 block mb-1">Image / Thumbnail URL (Optional)</label>
                <input
                  type="url"
                  value={postImg}
                  onChange={(e) => setPostImg(e.target.value)}
                  placeholder=""
                  className="w-full bg-black/60 border border-white/20 p-3 text-white rounded-xs focus:border-[#FF3B30] outline-none"
                />
              </div>

              <div>
                <label className="text-white/70 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-black/60 border border-white/20 p-3 text-white rounded-xs focus:border-[#FF3B30] outline-none"
                >
                  <option value="Fashion & Style">Fashion &amp; Style</option>
                  <option value="Technology & SaaS">Technology &amp; SaaS</option>
                  <option value="Beauty & Cosmetics">Beauty &amp; Cosmetics</option>
                  <option value="Fitness & Wellness">Fitness &amp; Wellness</option>
                  <option value="Lifestyle & Travel">Lifestyle &amp; Travel</option>
                </select>
              </div>

              <div>
                <label className="text-white/70 block mb-1">Post Caption &amp; Description</label>
                <textarea
                  required
                  value={postDesc}
                  onChange={(e) => setPostDesc(e.target.value)}
                  placeholder=""
                  className="w-full bg-black/60 border border-white/20 p-3 text-white rounded-xs h-28 focus:border-[#FF3B30] outline-none"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-end gap-3 font-mono text-xs">
              <button type="button" onClick={() => setShowUploadModal(false)} className="px-4 py-2 border border-white/20 hover:bg-white/5 text-white/70">Cancel</button>
              <button type="submit" className="px-6 py-2.5 bg-[#FF3B30] text-white font-bold uppercase rounded-xs hover:bg-[#e03126] shadow-lg">Publish Post 🚀</button>
            </div>
          </motion.form>
        </div>
      )}

      <Footer />
    </div>
  );
}
