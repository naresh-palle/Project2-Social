import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { 
  Users, IndianRupee, Activity, Bell, Search, Download, Calendar, 
  ArrowUpRight, ArrowDownRight, Loader2, CheckCircle2, XCircle, Filter, 
  Trash2, Lock, ShieldCheck, Zap, FileText, Check, ShieldAlert, Sparkles,
  LayoutGrid, List
} from "lucide-react";
import { AiIcon } from "@/components/AiIcon";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { PLATFORM_CATEGORIES, matchesCategoryFilter } from "@/lib/categories";
import { EXPORT_FORMATS, runExport } from "@/lib/exportFormats";
import { formatUsername } from "@/lib/username";
import { ApifyLookupPanel } from "@/components/ApifyLookupPanel";
import { AdminProduction } from "@/components/AdminProduction";

const USER_ROLE_OPTIONS = ["Influencers", "Brands", "Agencies", "Hire / Production"];
const USER_STATUS_OPTIONS = ["Active", "Pending"];
const PRODUCTION_CATEGORY_OPTIONS = [
  "camera",
  "editing",
  "voiceover",
  "script",
  "Camera Team",
  "Video Editing Team",
  "Voice Over Artists",
  "Script Writers",
];
const ADMIN_CATEGORY_OPTIONS = [...PLATFORM_CATEGORIES, ...PRODUCTION_CATEGORY_OPTIONS];
const ROLE_API_MAP = {
  Influencers: "creator",
  Brands: "brand",
  Agencies: "agency",
  "Hire / Production": "production",
};
const ROLE_DB_MAP = {
  Influencers: "influencer",
  Brands: "owner",
  Agencies: "agent",
  "Hire / Production": "production",
};

const TAB_EXPORT_LABELS = {
  reports: "Reports",
  categories: "Categories",
  audit: "Audit Logs",
  treasury: "Treasury",
  briefs: "Briefs",
};

/** Tabs with exportable datasets. */
const EXPORTABLE_TABS = new Set(["reports", "users", "categories", "audit", "treasury", "briefs"]);

const ROLE_DISPLAY = {
  influencer: "Creator",
  owner: "Brand",
  agent: "Agency",
  admin: "Admin",
  production: "Hire / Production",
  support: "Support",
  support_agent: "Support Agent",
  support_lead: "Support Lead",
  support_admin: "Support Admin",
};

function roleLabel(role) {
  return ROLE_DISPLAY[role] || String(role || "—");
}

function userStatusLabel(u) {
  if (u?.banned === true || u?.status === "banned" || u?.is_banned === true) return "Banned";
  if (u?.onboarding_status === "declined") return "Declined";
  if (u?.onboarding_status === "pending" || (u?.role === "agent" && u?.agent_approved === false)) return "Pending";
  return "Active";
}

const INTERNAL_EXPORT_ROLES = new Set([
  "admin",
  "support",
  "support_agent",
  "support_lead",
  "support_admin",
]);

/** Curated columns so PDF/CSV/Excel stay readable (not a raw DB dump). */
function shapeExportRows(tab, rows) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (tab === "users") {
    return list
      .filter((u) => !INTERNAL_EXPORT_ROLES.has(u.role))
      .map((u) => ({
        Username: formatUsername(u.username, u.handle) || u.username || "—",
        Name: u.name || "—",
        Email: u.email || "—",
        Mobile: u.mobile
          ? String(u.mobile).startsWith("+")
            ? u.mobile
            : `+91 ${String(u.mobile).replace(/\D/g, "").slice(-10)}`
          : "—",
        Role: roleLabel(u.role),
        Category: userCategoryText(u) || "—",
        Status: userStatusLabel(u),
        City: u.city || "—",
        State: u.state || "—",
        Joined: u.created_at ? String(u.created_at).slice(0, 10) : "—",
      }));
  }
  if (tab === "reports") {
    return list.map((r) => ({
      Type: r.target_type || "—",
      Target: r.target_label || r.target_username || r.target_id || "—",
      Reason: r.reason || "—",
      Status: r.status || "—",
      Created: r.created_at ? String(r.created_at).slice(0, 10) : "—",
    }));
  }
  if (tab === "audit") {
    return list.map((a) => ({
      Time: (a.time || a.created_at)
        ? String(a.time || a.created_at).slice(0, 19).replace("T", " ")
        : "—",
      User: formatUsername(a.username, a.handle || a.user) || a.user || "—",
      Action: a.type || a.action || "—",
      Details: a.details || "—",
      Status: a.status || "—",
    }));
  }
  if (tab === "categories") {
    return list.map((c) => {
      if (typeof c === "string") return { Category: c };
      return {
        Category: c.name || c.title || "—",
        Count: c.count != null ? c.count : "—",
      };
    });
  }
  if (tab === "treasury") {
    return list.map((e) => ({
      "Escrow ID": e.id || "—",
      Campaign: e.campaign || "—",
      Brand: e.brand || "—",
      Influencer: e.creator || "—",
      Amount: e.amount != null ? `₹${Number(e.amount).toLocaleString("en-IN")}` : "—",
      "Escrow Fee": e.fee != null ? `₹${Number(e.fee).toLocaleString("en-IN")}` : "—",
      Status: e.status || "—",
      Gateway: e.gateway || "—",
    }));
  }
  if (tab === "briefs") {
    return list.map((b) => ({
      "Brief ID": b.id || "—",
      Brand: b.brand || "—",
      Title: b.title || "—",
      Category: b.category || "—",
      Budget: b.budget != null ? `₹${Number(b.budget).toLocaleString("en-IN")}` : "—",
      Deliverables: b.deliverables || "—",
      Timeline: b.timeline || "—",
      "AI Safety": b.aiSafety || "—",
      Status: b.status || "—",
    }));
  }
  // Fallback: flatten but drop noisy keys
  const drop = new Set([
    "password_hash", "password", "token", "avatar", "id", "_id",
    "platform_metrics", "notification_prefs", "sessions",
  ]);
  return list.map((row) => {
    const out = {};
    Object.entries(row || {}).forEach(([k, v]) => {
      if (drop.has(k) || k.startsWith("password")) return;
      if (v != null && typeof v === "object" && !Array.isArray(v)) {
        Object.entries(v).forEach(([sk, sv]) => {
          if (drop.has(sk)) return;
          out[`${k}.${sk}`] = Array.isArray(sv) ? sv.join("; ") : sv;
        });
      } else if (Array.isArray(v)) {
        out[k] = v.join("; ");
      } else {
        out[k] = v;
      }
    });
    return out;
  });
}

function userCategoryText(u) {
  const prodBits = [];
  if (u?.role === "production") {
    if (u.production_category_label) prodBits.push(u.production_category_label);
    else if (u.production_category) prodBits.push(String(u.production_category));
    if (u.production_role) prodBits.push(String(u.production_role));
    if (u.in_house) prodBits.push("In-House");
  }
  return []
    .concat(prodBits)
    .concat(u?.category || [])
    .concat(u?.niches || [])
    .concat(u?.industry || [])
    .concat(u?.services || [])
    .flatMap((x) => (Array.isArray(x) ? x : String(x).split(",")))
    .map((x) => String(x).trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i)
    .join(", ");
}

function userMatchesCategories(u, selected = []) {
  if (!selected?.length) return true;
  const cats = []
    .concat(u?.category || [])
    .concat(u?.niches || [])
    .concat(u?.industry || [])
    .concat(u?.production_category || [])
    .concat(u?.production_category_label || [])
    .concat(u?.production_role || [])
    .concat(u?.services || []);
  return matchesCategoryFilter(cats, selected);
}

const DEFAULT_ESCROWS = [
  { id: "ESC-901", campaign: "Silk & Midnight Launch", brand: "Studio Noir Apparel", creator: "Aarav Sharma", amount: 250000, fee: 32500, status: "Locked in Escrow", gateway: "Razorpay PCI-DSS" },
  { id: "ESC-902", campaign: "AI Video Editing Suite", brand: "HyperTech AI", creator: "Priya Varma", amount: 350000, fee: 45500, status: "Locked in Escrow", gateway: "Razorpay PCI-DSS" },
  { id: "ESC-903", campaign: "Hydra Glow Serum", brand: "Veda Organics", creator: "Rohan Kapoor", amount: 180000, fee: 23400, status: "Released to Wallet", gateway: "Razorpay PCI-DSS" },
  { id: "ESC-904", campaign: "PulseFit Activewear Series", brand: "PulseFit Global", creator: "Neha Gupta", amount: 200000, fee: 26000, status: "Locked in Escrow", gateway: "Razorpay PCI-DSS" },
  { id: "ESC-905", campaign: "Rockerz 550 Wireless Campaign", brand: "boAt Lifestyle", creator: "Arjun Sharma", amount: 400000, fee: 52000, status: "Released to Wallet", gateway: "Razorpay PCI-DSS" },
  { id: "ESC-906", campaign: "Air Flex Eyewear Launch", brand: "Lenskart India", creator: "Sneha Reddy", amount: 150000, fee: 19500, status: "Released to Wallet", gateway: "Razorpay PCI-DSS" },
  { id: "ESC-907", campaign: "Gourmet Food Delivery Promo", brand: "Zomato Ltd.", creator: "Karthik Iyer", amount: 280000, fee: 36400, status: "Dispute Under Review", gateway: "Razorpay PCI-DSS" },
  { id: "ESC-908", campaign: "Pro Fitness Pass Festival", brand: "Cult.fit", creator: "Anya Singh", amount: 220000, fee: 28600, status: "Pending Verification", gateway: "Razorpay PCI-DSS" },
];

const DEFAULT_BRIEFS = [
  { id: "BRF-101", brand: "Studio Noir Apparel", title: "Cyberpunk Streetwear Editorial Launch", budget: 250000, category: "Fashion & Style", aiSafety: "99% Clean", status: "Approved & Live", deliverables: "1x Reel + 3x Stories", timeline: "14 Days" },
  { id: "BRF-102", brand: "HyperTech AI", title: "AI Influencer Workstation Pro Review", budget: 350000, category: "Technology & SaaS", aiSafety: "98% Clean", status: "Approved & Live", deliverables: "1x Long-form Video + 2x Posts", timeline: "21 Days" },
  { id: "BRF-103", brand: "Veda Organics", title: "Organic Hydra Glow Serum Series", budget: 180000, category: "Beauty & Makeup", aiSafety: "100% Clean", status: "Pending Review", deliverables: "2x Reels + Before/After Story", timeline: "10 Days" },
  { id: "BRF-104", brand: "PulseFit Global", title: "Pro Performance Seamless Activewear", budget: 200000, category: "Fitness & Health", aiSafety: "97% Clean", status: "Pending Review", deliverables: "1x Fitness Workout Reel", timeline: "7 Days" },
  { id: "BRF-105", brand: "boAt Lifestyle", title: "Rockerz 550 ANC Wireless Audio", budget: 400000, category: "Technology & Gadgets", aiSafety: "99% Clean", status: "Approved & Live", deliverables: "3x Unboxing Reels + Giveaway", timeline: "30 Days" },
  { id: "BRF-106", brand: "Lenskart India", title: "Air Flex Ultralight Eyewear Shoot", budget: 150000, category: "Fashion & Lifestyle", aiSafety: "96% Clean", status: "Pending Review", deliverables: "2x Style Reels", timeline: "12 Days" },
];

function StatCard({ title, value, sub, icon, trend, pos }) {
    return (
        <div className="p-4 xl:p-5 relative overflow-hidden group min-w-0 rounded-3xl border border-white/10 bg-[#121212] shadow-none">
            <div className="flex justify-between items-start gap-2">
                <div className="font-sans text-[10px] tracking-[0.16em] uppercase opacity-60 font-medium leading-snug">{title}</div>
                <div className="p-2 bg-white/5 rounded-3xl shrink-0">{icon}</div>
            </div>
            <div className="font-sans font-bold text-2xl xl:text-3xl mt-3 mb-1 tracking-tight tabular-nums text-white truncate">{value}</div>
            <div className="flex justify-between items-center mt-3 gap-2">
                <div className="font-sans text-[10px] tracking-wider uppercase opacity-50 leading-snug min-w-0">{sub}</div>
                <div className={`flex items-center gap-1 font-sans text-[10px] shrink-0 ${pos ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                    {pos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {trend}
                </div>
            </div>
        </div>
    );
}

function DiscoveryOps() {
  const [stats, setStats] = useState(null);
  const [jobs, setJobs] = useState([]);
  useEffect(() => {
    api.get("/admin/discovery-stats").then(({ data }) => setStats(data)).catch(() => setStats({ error: true }));
    api.get("/admin/discovery-jobs").then(({ data }) => setJobs(data.items || [])).catch(() => {});
  }, []);
  if (!stats) return <div className="font-mono text-xs tracking-widest uppercase opacity-50">Loading discovery ops…</div>;
  if (stats.error) return <div className="text-sm text-white/50">Could not load discovery stats.</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Total creators", stats.total_creators],
          ["Synced today", stats.synced_today],
          ["Successful syncs", stats.successful_syncs],
          ["Failed syncs", stats.failed_syncs],
          ["Stale creators", stats.stale_creators],
          ["Pending research", stats.pending_research_jobs],
          ["Apify", stats.apify_configured ? "Configured" : "Data source not configured"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-white/10 bg-[#121212] p-4">
            <div className="font-mono text-[9px] uppercase tracking-widest text-white/40">{k}</div>
            <div className="font-sans text-xl font-bold mt-1">{v}</div>
          </div>
        ))}
      </div>
      <ApifyLookupPanel />
      <div className="rounded-2xl border border-white/10 overflow-auto">
        <table className="w-full text-xs">
          <thead className="font-mono uppercase tracking-widest text-white/40">
            <tr><th className="p-3 text-left">Job</th><th className="p-3">Status</th><th className="p-3">Provider</th><th className="p-3">Error</th></tr>
          </thead>
          <tbody>
            {jobs.slice(0, 20).map((j) => (
              <tr key={j.id} className="border-t border-white/10">
                <td className="p-3">{j.kind}</td>
                <td className="p-3">{j.status}</td>
                <td className="p-3">{j.provider}</td>
                <td className="p-3 text-white/50">{j.error_message || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminPanel() {
  const [tab, setTab] = useState("overview");
  const [exportModal, setExportModal] = useState(false);
  const [exportRange, setExportRange] = useState("monthly");
  const [exportFormat, setExportFormat] = useState("csv");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [payments, setPayments] = useState([]);
  
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  
  const [loading, setLoading] = useState(true);
  
  const [roleFilter, setRoleFilter] = useState([]); // [] = All
  const [categoryFilter, setCategoryFilter] = useState([]); // [] = All
  const [statusFilter, setStatusFilter] = useState([]); // [] = All
  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [reports, setReports] = useState([]);
  const [categories, setCategories] = useState([]);
  const [platformCategoryFilter, setPlatformCategoryFilter] = useState([]); // [] = All
  const [categoryUsers, setCategoryUsers] = useState([]);
  const [categoryUsersLoading, setCategoryUsersLoading] = useState(false);
  const [platformStats, setPlatformStats] = useState(null);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastRole, setBroadcastRole] = useState("");
  const [broadcastState, setBroadcastState] = useState("");
  const [broadcastCity, setBroadcastCity] = useState("");
  const [broadcastLanguage, setBroadcastLanguage] = useState("");
  const [userToDelete, setUserToDelete] = useState(null);
  const [alertFilter, setAlertFilter] = useState("all");
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditTypeFilter, setAuditTypeFilter] = useState([]);
  const [auditStatusFilter, setAuditStatusFilter] = useState([]);
  const [reportStatusFilter, setReportStatusFilter] = useState("all");
  const [reportsLoading, setReportsLoading] = useState(false);
  const [treasuryEscrows, setTreasuryEscrows] = useState(DEFAULT_ESCROWS);
  const [campaignBriefs, setCampaignBriefs] = useState(DEFAULT_BRIEFS);

  // Live system alerts from recent activity (no hardcoded demo rows)
  const notifications = (Array.isArray(activity) ? activity : []).slice(0, 20).map((a, i) => {
    const status = String(a.status || "").toLowerCase();
    let type = "success";
    if (status.includes("fail") || status.includes("error")) type = "error";
    else if (status.includes("warn") || status.includes("pending")) type = "warning";
    const who = formatUsername(a.username, a.user) || a.user || "System";
    const text = a.details || a.type || "Platform activity";
    return {
      id: a.id || `act-${i}-${a.time || a.created_at || i}`,
      text: `${who}: ${text}`,
      time: a.time || a.created_at || "",
      type,
      title: a.type || "Activity",
      source: "Audit · live",
      details: a.details || text,
      issues: [],
      logs: [],
      errors: type === "error" ? [a.details || text] : [],
    };
  });

  const alertFilters = [
    { id: "all", label: "All" },
    { id: "success", label: "Success" },
    { id: "warning", label: "Warning" },
    { id: "error", label: "Error" },
  ];
  const filteredAlerts = alertFilter === "all"
    ? notifications
    : notifications.filter((n) => n.type === alertFilter);

  useEffect(() => {
    async function load() {
      try {
        const [stRes, actRes, payRes, platRes] = await Promise.all([
          api.get("/admin/dashboard-stats"),
          api.get("/admin/recent-activity"),
          api.get("/admin/payments"),
          api.get("/analytics/platform").catch(() => ({ data: null }))
        ]);
        setStats(stRes.data);
        setActivity(actRes.data);
        setPayments(payRes.data);
        if (platRes.data) setPlatformStats(platRes.data);
      } catch (e) {
        toast.error("Failed to load platform data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const fetchUsers = useCallback(async () => {
      setUsersLoading(true);
      try {
          const params = new URLSearchParams();
          if (roleFilter?.length === 1) params.append("role", ROLE_API_MAP[roleFilter[0]] || roleFilter[0]);
          if (categoryFilter?.length === 1) params.append("category", categoryFilter[0]);
          if (statusFilter?.length === 1 && statusFilter[0] === "Pending") params.append("status", "pending");
          if (searchQuery) params.append("q", searchQuery);
          if (stateFilter) params.append("state", stateFilter);
          if (cityFilter) params.append("city", cityFilter);
          if (languageFilter) params.append("language", languageFilter);
          
          const { data } = await api.get(`/admin/users?${params.toString()}`);
          // Admins are never listed — prevents ban/delete access from User Management.
          let list = (Array.isArray(data) ? data : []).filter((u) => u?.role !== "admin");

          if (roleFilter?.length > 1) {
            const allowed = new Set(roleFilter.map((r) => ROLE_DB_MAP[r] || r.toLowerCase()));
            list = list.filter((u) => allowed.has(u.role));
          }

          if (categoryFilter?.length > 1) {
            const set = new Set(categoryFilter.map((c) => c.toLowerCase()));
            list = list.filter((u) => {
              const cats = []
                .concat(u.category || [])
                .concat(u.niches || [])
                .concat(u.industry || [])
                .concat(u.production_category || [])
                .concat(u.production_category_label || [])
                .concat(u.production_role || [])
                .concat(u.services || [])
                .flatMap((x) => (Array.isArray(x) ? x : String(x).split(",")))
                .map((x) => String(x).trim().toLowerCase())
                .filter(Boolean);
              return cats.some((c) => set.has(c) || [...set].some((s) => c.includes(s)));
            });
          }

          if (statusFilter?.length) {
            const wantActive = statusFilter.includes("Active");
            const wantPending = statusFilter.includes("Pending");
            list = list.filter((u) => {
              const label = userStatusLabel(u);
              if (wantPending && label === "Pending") return true;
              if (wantActive && label === "Active") return true;
              return false;
            });
          }

          setUsersList(list);
      } catch (e) {
          toast.error("Failed to load users");
      } finally {
          setUsersLoading(false);
      }
  }, [roleFilter, categoryFilter, statusFilter, searchQuery, stateFilter, cityFilter, languageFilter]);

  const fetchReports = useCallback(async (status = reportStatusFilter) => {
      setReportsLoading(true);
      try {
          const q = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "?status=all";
          const { data } = await api.get(`/admin/reports${q}`);
          setReports(Array.isArray(data) ? data : []);
      } catch {
          toast.error("Failed to load reports");
          setReports([]);
      } finally {
          setReportsLoading(false);
      }
  }, [reportStatusFilter]);

  useEffect(() => {
      if (tab === "users") fetchUsers();
      if (tab === "reports") fetchReports(reportStatusFilter);
      if (tab === "categories") {
        api.get("/admin/categories").then(r => setCategories(r.data || [])).catch(() => {});
        setCategoryUsersLoading(true);
        api.get("/admin/users")
          .then((r) => {
            const list = (Array.isArray(r.data) ? r.data : []).filter((u) => u?.role !== "admin");
            setCategoryUsers(list);
          })
          .catch(() => toast.error("Failed to load category results"))
          .finally(() => setCategoryUsersLoading(false));
      }
      if (tab === "audit") {
        api.get("/admin/recent-activity").then(r => setActivity(r.data || [])).catch(() => toast.error("Failed to load audit logs"));
      }
  }, [tab, fetchUsers, fetchReports, reportStatusFilter]);

  // Keep Audit Logs fresh while the tab is open
  useEffect(() => {
      if (tab !== "audit") return undefined;
      const tick = () => {
        api.get("/admin/recent-activity").then(r => setActivity(r.data || [])).catch(() => {});
      };
      const id = setInterval(tick, 12000);
      return () => clearInterval(id);
  }, [tab]);

  const confirmDeleteUser = async () => {
      if (!userToDelete) return;
      const { id: userId } = userToDelete;
      try {
          await api.delete(`/admin/users/${userId}`);
          toast.success("User deleted successfully");
          fetchUsers();
          api.get("/admin/dashboard-stats").then(r => setStats(r.data));
          if (tab === "audit") {
              api.get("/admin/recent-activity").then(r => setActivity(r.data || []));
          }
      } catch (e) {
          toast.error(e?.response?.data?.detail || "Failed to delete user");
      } finally {
          setUserToDelete(null);
      }
  };


  const handleApproveUser = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/approve`);
      toast.success("User approved successfully");
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to approve user");
    }
  };

  const handleDeclineUser = async (userId) => {
    try {
      const reason = window.prompt("Reason for declining:", "Account credentials require further verification.");
      if (reason === null) return;
      await api.post(`/admin/users/${userId}/decline`, { reason });
      toast.success("User declined");
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to decline user");
    }
  };

  const deleteUser = async (userId, role) => {
      if (role === "admin") {
          toast.error("Admin users cannot be deleted");
          return;
      }
      setUserToDelete({ id: userId, role });
  };

  const banUser = async (userId, role) => {
      if (role === "admin") {
          toast.error("Admin users cannot be banned");
          return;
      }
      const reason = window.prompt("Ban reason (optional):") || "Policy violation";
      toast("Ban this user?", {
        action: {
          label: "Ban",
          onClick: async () => {
            try {
                await api.post(`/admin/users/${userId}/ban`, { reason });
                toast.success("User banned");
                fetchUsers();
            } catch (e) {
                toast.error(e?.response?.data?.detail || "Ban failed");
            }
          }
        },
        cancel: {
          label: "Cancel"
        }
      });
  };


  const exportAIReport = async () => {
    try {
        toast.info("Generating report...");
        const rows = [stats].filter(Boolean);
        let aiSummary = "";
        try {
          const res = await api.post("/admin/reports/ai-summary", { rows, tab: "overview" });
          aiSummary = res.data?.summary || "";
        } catch {
          /* local fallback below */
        }
        const { exportAiReportPdf, buildLocalExportSummary } = await import("@/lib/exportFormats");
        await exportAiReportPdf({
          rows,
          filename: `flugr_ai_report_${new Date().toISOString().slice(0, 10)}`,
          title: "Platform Report",
          meta: "AI / analytics snapshot",
          aiSummary: aiSummary || buildLocalExportSummary(rows, "overview"),
          tab: "overview",
        });
        toast.success("Report exported");
    } catch(err) {
        toast.error("Report generation failed.");
    }
  };

  const handleReportAction = async (reportId, status) => {
      try {
          await api.post(`/admin/reports/${reportId}`, { status, note: `Marked ${status}` });
          toast.success(`Report ${status}`);
          await fetchReports(reportStatusFilter);
      } catch {
          toast.error("Action failed");
      }
  };

  const sendBroadcast = async () => {
      if (!broadcastText.trim()) return;
      try {
          const { data } = await api.post("/admin/notifications/broadcast", {
              text: broadcastText,
              role: broadcastRole || undefined,
              state: broadcastState || undefined,
              city: broadcastCity || undefined,
              language: broadcastLanguage || undefined,
          });
          toast.success(`Broadcast sent to ${data.sent} users`);
          setBroadcastText("");
      } catch {
          toast.error("Broadcast failed");
      }
  };

    const promoteToAdmin = async (userId) => {
        if (!confirm("Are you sure you want to promote this user to Admin?")) return;
        try {
            await api.post(`/admin/users/${userId}/promote-admin`);
            toast.success("User promoted to Admin successfully");
            fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed to promote user");
        }
    };

    const assignCreatorLevel = async (userId, level) => {
        try {
            await api.patch(`/admin/users/${userId}/level`, { level });
            toast.success("Creator level updated");
            fetchUsers();
        } catch (err) {
            toast.error(err.response?.data?.detail || "Failed to update level");
        }
    };

    const exportData = async () => {
      if (!EXPORTABLE_TABS.has(tab)) {
        toast.error("Export is only available on Reports, Users, Categories, Audit, Treasury, and Briefs");
        return;
      }
      let raw = [];
      if (tab === "users") raw = usersList;
      else if (tab === "reports") raw = reports;
      else if (tab === "categories") raw = categories;
      else if (tab === "audit") raw = activity;
      else if (tab === "treasury") raw = treasuryEscrows;
      else if (tab === "briefs") raw = campaignBriefs;
      else {
        toast.error("Nothing to export on this tab");
        return;
      }
      
      // Filter by Date
      const now = new Date();
      let filterStart = null;
      let filterEnd = null;
      if (exportRange === "weekly") filterStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else if (exportRange === "monthly") filterStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      else if (exportRange === "6months") filterStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      else if (exportRange === "1year") filterStart = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      else if (exportRange === "custom") {
          if (startDate) filterStart = new Date(startDate);
          if (endDate) { filterEnd = new Date(endDate); filterEnd.setHours(23, 59, 59, 999); }
      }
      
      if (filterStart || filterEnd) {
          raw = raw.filter(item => {
              if (!item.created_at) return true; // If no date, include it
              const itemDate = new Date(item.created_at);
              if (filterStart && itemDate < filterStart) return false;
              if (filterEnd && itemDate > filterEnd) return false;
              return true;
          });
      }

      if (!raw || !raw.length) {
        toast.error("Nothing to export on this tab");
        return;
      }

      const data = shapeExportRows(tab, raw);
      if (!data.length) {
        toast.error(tab === "users" ? "No member accounts to export (internal roles excluded)" : "Nothing to export on this tab");
        return;
      }

      const meta = `Export Timeframe: ${exportRange.toUpperCase()}${exportRange === "custom" ? ` (${startDate} to ${endDate || "Unlimited"})` : ""} · Tab: ${tab}`;
      const base = `flugr_export_${tab}_${exportRange}_${new Date().toISOString().slice(0, 10)}`;
      
      try {
        setExportBusy(true);
        const { buildLocalExportSummary } = await import("@/lib/exportFormats");
        // Always start with a local summary so PDF (Report) never depends on the LLM.
        let aiSummary = buildLocalExportSummary(data, tab);

        if (exportFormat === "pdf_report") {
          toast.info("Building report…");
          // Optional polish — race with a short timeout; ignore failures.
          try {
            const aiPromise = api
              .post("/admin/reports/ai-summary", { rows: data.slice(0, 50), tab })
              .catch(() => null);
            const res = await Promise.race([
              aiPromise,
              new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
            ]);
            const remote = res?.data?.summary;
            if (remote && String(remote).trim() && !/AI analysis failed/i.test(remote)) {
              aiSummary = String(remote).trim();
            }
          } catch {
            /* keep local summary */
          }
        }

        const tabLabel =
          tab === "users"
            ? (roleFilter.length > 0 ? roleFilter[0] : "Users")
            : tab === "agent_approvals"
              ? "Approvals"
              : tab === "overview"
                ? "Platform"
                : tab.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

        await runExport(exportFormat, {
          rows: data,
          filename: base,
          title: `${tabLabel} Report`,
          meta,
          aiSummary,
          tab,
          sheetName: tab === "users" ? "Users" : "Stats",
        });
        setExportModal(false);
        toast.success(`Export ready (${EXPORT_FORMATS.find((f) => f.id === exportFormat)?.label || exportFormat} · ${exportRange})`);
      } catch (e) {
        console.error(e);
        toast.error(e?.message || "Export failed");
      } finally {
        setExportBusy(false);
      }
  };

  if (loading) return (
      <div className="flex items-center justify-center py-20 text-[#F4F4F0]">
        <div className="animate-pulse font-sans tracking-widest text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading admin…
        </div>
      </div>
  );

  if (!stats) {
      return (
          <div className="flex flex-col items-center justify-center text-[#F4F4F0] py-20 text-center">
              <div className="font-sans text-3xl text-[#FF3B30] mb-2">Studio Offline</div>
              <div className="font-sans text-xs opacity-60 max-w-md">The admin console could not retrieve secure data from the server. Please ensure the backend is running.</div>
              <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 border border-white/20 text-xs font-sans uppercase tracking-widest hover:bg-white/5 transition">Hard Refresh</button>
          </div>
      );
  }

  const revenueData = [
      { name: 'Jan', revenue: 10000, payments: 66000 },
      { name: 'Feb', revenue: 15000, payments: 100000 },
      { name: 'Mar', revenue: 22000, payments: 146000 },
      { name: 'Apr', revenue: 35000, payments: 233000 },
      { name: 'May', revenue: 42000, payments: 280000 },
      { name: 'Jun', revenue: stats?.financial?.revenue || 630500, payments: stats?.financial?.total_payments || 4850000 }
  ];

  const platformData = [
      { name: 'Active', value: stats?.platform?.active_users || 18 },
      { name: 'Inactive', value: ((stats?.users?.creators || 22) + (stats?.users?.brands || 5)) - (stats?.platform?.active_users || 18) }
  ];
  const COLORS = ['#34C759', '#FF3B30'];

  return (
    <div className="w-full flex flex-col">
        <div className="shrink-0 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-6">
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold flex items-center gap-2">
                <AiIcon name="sparkles" className="w-3.5 h-3.5" /> Admin
              </p>
              <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight leading-none mt-2">Admin</h1>
                <div className="flex gap-4 mt-6 font-sans text-[11px] uppercase tracking-widest overflow-x-auto whitespace-nowrap custom-scrollbar pb-1">
                    <button onClick={() => setTab("overview")} className={`pb-2 border-b-2 transition-colors ${tab === "overview" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>Overview</button>
                    <button onClick={() => setTab("agent_approvals")} className={`pb-2 border-b-2 transition-colors ${tab === "agent_approvals" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>
                      Approvals
                    </button>
                    <button onClick={() => setTab("treasury")} className={`pb-2 border-b-2 transition-colors ${tab === "treasury" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>
                      Treasury
                    </button>
                    <button onClick={() => setTab("briefs")} className={`pb-2 border-b-2 transition-colors ${tab === "briefs" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>
                      Briefs
                    </button>
                    <button onClick={() => setTab("users")} className={`pb-2 border-b-2 transition-colors ${tab === "users" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>Users</button>
                    <button onClick={() => setTab("reports")} className={`pb-2 border-b-2 transition-colors ${tab === "reports" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>Reports</button>
                    <button onClick={() => setTab("categories")} className={`pb-2 border-b-2 transition-colors ${tab === "categories" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>Categories</button>
                    <button onClick={() => setTab("broadcast")} className={`pb-2 border-b-2 transition-colors ${tab === "broadcast" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>Broadcast</button>
                    <button onClick={() => setTab("audit")} className={`pb-2 border-b-2 transition-colors ${tab === "audit" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>Audit</button>
                    <button onClick={() => setTab("algorithm")} className={`pb-2 border-b-2 transition-colors ${tab === "algorithm" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>Match</button>
                    <button onClick={() => setTab("discovery")} className={`pb-2 border-b-2 transition-colors ${tab === "discovery" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>Discovery</button>
                    <button onClick={() => setTab("production")} className={`pb-2 border-b-2 transition-colors ${tab === "production" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>Production</button>
                    <button onClick={() => setTab("referrals")} className={`pb-2 border-b-2 transition-colors ${tab === "referrals" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>Referrals</button>
                </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                {EXPORTABLE_TABS.has(tab) && (
                <button onClick={() => setExportModal(true)} className="btn-outline border-[#FF3B30] text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white px-4 py-2 flex items-center gap-2 font-bold shadow-lg transition-all">
                    <Download className="w-4 h-4" /> Export {tab === "users" ? (
                        [
                            categoryFilter.length > 0 ? categoryFilter[0] : "",
                            roleFilter.length > 0
                              ? (roleFilter[0] === "Influencers" ? "Influencers"
                                : roleFilter[0] === "Brands" ? "Brands"
                                : roleFilter[0] === "Agencies" ? "Agencies"
                                : roleFilter[0] === "Hire / Production" ? "Production"
                                : "Users")
                              : "Users"
                        ].filter(Boolean).join(" ")
                    ) : (TAB_EXPORT_LABELS[tab] || "Data")}
                </button>
                )}
            </div>
        </div>

        <div className="pb-10 pr-1">
        {/* TAB 1: OVERVIEW */}
        {tab === "overview" && (
            <div className="mt-8 space-y-10">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <StatCard title="Total Users" value={(stats?.users?.creators || 0) + (stats?.users?.brands || 0) + (stats?.users?.agencies || 0) + (stats?.users?.production || 0)} sub={`${stats?.users?.creators || 0} Influencers · ${stats?.users?.brands || 0} Brands · ${stats?.users?.production || 0} Production`} icon={<Users className="w-5 h-5 text-blue-400" />} trend={stats?.users?.total != null ? `${stats.users.total} total` : "—"} pos={true} />
                    <StatCard title="DAU / MAU" value={platformStats ? `${platformStats.dau} / ${platformStats.mau}` : "—"} sub="Daily & Monthly Active Users" icon={<Activity className="w-5 h-5 text-cyan-400" />} trend={platformStats ? `${platformStats.posts} posts` : "—"} pos={true} />
                    <StatCard title="Revenue" value={stats?.financial?.revenue != null ? `₹${Number(stats.financial.revenue).toLocaleString("en-IN")}` : "—"} sub="Tracked platform revenue" icon={<IndianRupee className="w-5 h-5 text-green-400" />} trend={stats?.financial?.total_payments != null ? `${stats.financial.total_payments} payments` : "—"} pos={true} />
                    <StatCard title="Active Campaigns" value={stats?.campaigns?.active ?? 0} sub={`Out of ${stats?.campaigns?.total ?? 0} total`} icon={<Activity className="w-5 h-5 text-purple-400" />} trend={stats?.campaigns?.completed != null ? `${stats.campaigns.completed} done` : "—"} pos={true} />
                    <StatCard title="Pending Verifications" value={(stats?.requests?.verification_requests || 0) + (stats?.requests?.creator_requests || 0) + (stats?.requests?.hire_requests_pending || 0)} sub={`${stats?.requests?.verification_requests || 0} agencies · ${stats?.requests?.hire_requests_pending || 0} hire reqs`} icon={<Bell className="w-5 h-5 text-orange-400" />} trend={stats?.approvals?.pending != null ? `${stats.approvals.pending} approvals` : "—"} pos={false} />
                </div>

                <section className="p-6 rounded-3xl border border-white/10 bg-[#121212]">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                      <h3 className="font-sans text-[10px] tracking-[0.16em] uppercase opacity-60 font-medium flex items-center gap-2 mb-0">
                        <Bell className="w-3 h-3 text-[#FF3B30]" /> System Alerts
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {alertFilters.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setAlertFilter(f.id)}
                            className={`px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest border rounded-full transition-colors ${
                              alertFilter === f.id
                                ? "bg-[#FF3B30] border-[#FF3B30] text-white"
                                : "border-white/15 text-white/55 hover:border-white/35"
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                        {filteredAlerts.length === 0 ? (
                          <p className="font-sans text-sm opacity-40 py-4 text-center">No alerts for this filter.</p>
                        ) : (
                          filteredAlerts.map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => setSelectedAlert(n)}
                              className="w-full text-left flex items-start gap-3 p-3 rounded-2xl border border-transparent hover:border-white/10 hover:bg-white/[0.03] transition-colors"
                            >
                                {n.type === "success" && <CheckCircle2 className="w-4 h-4 text-[#34C759] shrink-0 mt-0.5" />}
                                {n.type === "error" && <XCircle className="w-4 h-4 text-[#FF3B30] shrink-0 mt-0.5" />}
                                {n.type === "warning" && <Activity className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />}
                                <div className="min-w-0 flex-1">
                                    <p className="font-sans text-sm opacity-90 leading-snug">{n.text}</p>
                                    <p className="font-sans text-[9px] uppercase tracking-widest opacity-50 mt-1">{n.time} · Tap for details</p>
                                </div>
                            </button>
                          ))
                        )}
                    </div>
                </section>
            </div>
        )}

        {/* TAB 2: AGENT APPROVALS */}
        {tab === "agent_approvals" && (
            <AgentApprovalDesk fetchUsers={fetchUsers} setStats={setStats} />
        )}

        {/* TAB 3: ESCROW TREASURY DESK */}
        {tab === "treasury" && (
            <EscrowTreasuryDesk escrows={treasuryEscrows} setEscrows={setTreasuryEscrows} />
        )}

        {/* TAB 4: BRIEF MODERATION DESK */}
        {tab === "briefs" && (
            <BriefModerationDesk briefs={campaignBriefs} setBriefs={setCampaignBriefs} />
        )}

        {/* TAB 5: USER MANAGEMENT */}
        {tab === "users" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-8">
                <div className="relative z-30 flex flex-col gap-3 mb-6 p-4 rounded-3xl border border-white/10 bg-[#121212] overflow-visible">
                    <div className="flex items-center gap-2 w-full max-w-md border border-white/10 rounded-full px-3 py-2 bg-white/[0.03]">
                        <Search className="w-4 h-4 opacity-50 shrink-0" />
                        <input type="text" placeholder="Search username, email, mobile…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-transparent border-none outline-none text-sm placeholder:opacity-50 font-sans" />
                    </div>
                    <div className="relative z-30 flex flex-wrap items-end gap-3 font-sans text-[10px] uppercase tracking-wider">
                        <div className="flex items-center gap-2 shrink-0 pb-2">
                            <Filter className="w-3 h-3 opacity-50" />
                        </div>
                        <div className="w-full sm:w-[140px] min-w-0">
                          <MultiSelectDropdown
                            options={USER_ROLE_OPTIONS}
                            selected={roleFilter}
                            onChange={setRoleFilter}
                            placeholder="All"
                            allowAll
                            compact
                            label="Role"
                          />
                        </div>
                        <div className="w-full sm:w-[180px] min-w-0">
                          <MultiSelectDropdown
                            options={ADMIN_CATEGORY_OPTIONS}
                            selected={categoryFilter}
                            onChange={setCategoryFilter}
                            placeholder="All"
                            allowAll
                            compact
                            label="Category"
                          />
                        </div>
                        <div className="w-full sm:w-[140px] min-w-0">
                          <MultiSelectDropdown
                            options={USER_STATUS_OPTIONS}
                            selected={statusFilter}
                            onChange={setStatusFilter}
                            placeholder="All"
                            allowAll
                            compact
                            label="Status"
                          />
                        </div>
                        <input type="text" placeholder="State" value={stateFilter} onChange={e => setStateFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-full px-3 py-2 text-xs text-white w-full sm:w-[110px] min-w-0" />
                        <input type="text" placeholder="City" value={cityFilter} onChange={e => setCityFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-full px-3 py-2 text-xs text-white w-full sm:w-[110px] min-w-0" />
                        <input type="text" placeholder="Language" value={languageFilter} onChange={e => setLanguageFilter(e.target.value)} className="bg-white/5 border border-white/10 rounded-full px-3 py-2 text-xs text-white w-full sm:w-[110px] min-w-0" />
                    </div>
                </div>
                <div className="glass-panel overflow-x-auto">
                    {usersLoading ? (
                        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin opacity-50" /></div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 font-sans text-[9px] tracking-widest uppercase opacity-50">
                                    <th className="p-4 font-normal">Username</th>
                                    <th className="p-4 font-normal">Email</th>
                                    <th className="p-4 font-normal">Mobile</th>
                                    <th className="p-4 font-normal">Role / Category</th>
                                    <th className="p-4 font-normal">Joined</th>
                                    <th className="p-4 font-normal">Status</th>
                                    <th className="p-4 font-normal text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usersList.length === 0 ? (
                                    <tr><td colSpan={7} className="p-12 text-center font-sans italic text-2xl opacity-40">No users found</td></tr>
                                ) : (
                                    usersList.map((u) => (
                                        <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                            <td className="p-4">
                                              <div className="font-sans text-xl">
                                                {formatUsername(u.username, u.handle) || "—"}
                                              </div>
                                            </td>
                                            <td className="p-4 font-sans text-sm break-all">
                                              {u.email || "—"}
                                            </td>
                                            <td className="p-4 font-sans text-sm whitespace-nowrap">
                                              {u.mobile
                                                ? (String(u.mobile).startsWith("+")
                                                    ? u.mobile
                                                    : `+91 ${String(u.mobile).replace(/\D/g, "").slice(-10)}`)
                                                : "—"}
                                            </td>
                                            <td className="p-4">
                                              <div className="font-sans text-[10px] uppercase tracking-widest text-[#FF3B30]">{roleLabel(u.role)}</div>
                                              <div className="text-xs opacity-60 mt-1">{userCategoryText(u) || "—"}</div>
                                              {u.role === 'influencer' && (
                                                <select
                                                  className="mt-2 bg-white/5 border border-white/10 text-xs px-2 py-1 rounded outline-none text-[var(--fg)]"
                                                  value={u.creator_level || "Beginner"}
                                                  onChange={(e) => assignCreatorLevel(u.id, e.target.value)}
                                                >
                                                  <option value="Beginner">Beginner</option>
                                                  <option value="Pro">Pro</option>
                                                  <option value="Elite">Elite</option>
                                                </select>
                                              )}
                                            </td>
                                            <td className="p-4 font-sans text-[10px] uppercase tracking-widest opacity-60">{new Date(u.created_at).toLocaleDateString()}</td>
                                            <td className="p-4">
                                                {(() => {
                                                  const st = userStatusLabel(u);
                                                  const cls =
                                                    st === "Active" ? "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20" :
                                                    st === "Pending" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                                                    st === "Banned" ? "bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20" :
                                                    "bg-white/5 text-white/60 border-white/15";
                                                  return (
                                                    <span className={`px-2 py-1 text-[9px] uppercase tracking-widest font-sans border rounded-3xl ${cls}`}>{st}</span>
                                                  );
                                                })()}
                                            </td>
                                            <td className="p-4 text-right">
                                              {u.role === "admin" ? (
                                                <span className="font-sans text-[9px] uppercase tracking-widest opacity-40">Protected</span>
                                              ) : (
                                                <div className="flex items-center justify-end gap-1">
                                                  {(!u.agent_approved || u.onboarding_status === "pending") && u.onboarding_status !== "declined" && (
                                                    <>
                                                        <button onClick={() => handleApproveUser(u.id)} className="p-2 opacity-50 hover:opacity-100 hover:text-green-400 transition-colors" title="Approve User">
                                                            <CheckCircle2 className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDeclineUser(u.id)} className="p-2 opacity-50 hover:opacity-100 hover:text-orange-400 transition-colors" title="Decline User">
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                  )}
                                                  <button onClick={() => banUser(u.id, u.role)} className="p-2 opacity-50 hover:opacity-100 hover:text-orange-400 transition-colors" title="Ban User"><Lock className="w-4 h-4" /></button>
                                                  <button onClick={() => deleteUser(u.id, u.role)} className="p-2 opacity-50 hover:opacity-100 hover:text-[#FF3B30] transition-colors" title="Delete User"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                              )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </motion.div>
        )}

        {/* TAB: REPORTS */}
        {tab === "reports" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-4">
                <div className="flex flex-wrap items-center gap-2 p-4 rounded-3xl border border-white/10 bg-[#121212]">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-white/45 mr-1">Status</span>
                  {[
                    { id: "all", label: "All" },
                    { id: "open", label: "Open" },
                    { id: "resolved", label: "Resolved" },
                    { id: "dismissed", label: "Dismissed" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setReportStatusFilter(f.id)}
                      className={`px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest border rounded-full transition-colors ${
                        reportStatusFilter === f.id
                          ? "bg-[#FF3B30] border-[#FF3B30] text-white"
                          : "border-white/15 text-white/55 hover:border-white/35"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  <span className="font-sans text-[10px] uppercase tracking-wider opacity-40 ml-auto">
                    {reports.length} report{reports.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="glass-panel overflow-x-auto">
                {reportsLoading ? (
                  <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin opacity-50" /></div>
                ) : (
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 font-sans text-[9px] tracking-[0.16em] uppercase opacity-50">
                            <th className="p-4">Type</th><th className="p-4">Target</th><th className="p-4">Reason</th><th className="p-4">Status</th><th className="p-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.length === 0 ? (
                            <tr><td colSpan={5} className="p-12 text-center font-sans italic text-2xl opacity-40">No {reportStatusFilter === "all" ? "" : `${reportStatusFilter} `}reports</td></tr>
                        ) : reports.map((r) => (
                            <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                <td className="p-4 font-sans text-xs uppercase">{r.target_type || "—"}</td>
                                <td className="p-4 font-sans text-xs">
                                  {r.target_label || r.target_username || r.target_id || "—"}
                                </td>
                                <td className="p-4 text-sm">{r.reason || "—"}</td>
                                <td className="p-4">
                                  <span className={`px-2 py-1 text-[9px] uppercase font-sans border rounded-xs ${
                                    r.status === "open" ? "bg-orange-400/10 text-orange-400 border-orange-400/20" :
                                    r.status === "resolved" ? "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20" :
                                    "bg-white/5 text-white/50 border-white/15"
                                  }`}>{r.status || "—"}</span>
                                </td>
                                <td className="p-4 text-right space-x-2">
                                    {r.status === "open" ? (
                                      <>
                                        <button onClick={() => handleReportAction(r.id, "resolved")} className="font-sans text-[10px] text-[#34C759] uppercase">Resolve</button>
                                        <button onClick={() => handleReportAction(r.id, "dismissed")} className="font-sans text-[10px] opacity-50 uppercase">Dismiss</button>
                                      </>
                                    ) : (
                                      <span className="font-sans text-[9px] uppercase tracking-widest opacity-40">Closed</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                )}
                </div>
            </motion.div>
        )}

        {/* TAB: CATEGORIES */}
        {tab === "categories" && (() => {
            const catalog = (categories.length
              ? categories.map((c) => c.name || c).filter(Boolean)
              : PLATFORM_CATEGORIES);
            const filteredUsers = categoryUsers.filter((u) => userMatchesCategories(u, platformCategoryFilter));
            const counts = Object.fromEntries(
              catalog.map((name) => [
                name,
                categoryUsers.filter((u) => userMatchesCategories(u, [name])).length,
              ])
            );
            const visibleCats = platformCategoryFilter.length
              ? catalog.filter((c) => platformCategoryFilter.includes(c))
              : catalog;

            return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-6">
                <div className="p-4 glass-panel flex flex-wrap items-end gap-4">
                  <div className="min-w-[240px] max-w-md flex-1">
                    <MultiSelectDropdown
                      options={catalog}
                      selected={platformCategoryFilter}
                      onChange={setPlatformCategoryFilter}
                      placeholder="All"
                      allowAll
                      compact
                      label="Platform Categories"
                    />
                  </div>
                  <div className="font-sans text-[10px] uppercase tracking-wider opacity-50 pb-2">
                    {platformCategoryFilter.length === 0
                      ? `All · ${filteredUsers.length} users`
                      : `${platformCategoryFilter.length} selected · ${filteredUsers.length} users`}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {visibleCats.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        if (platformCategoryFilter.includes(name)) {
                          setPlatformCategoryFilter(platformCategoryFilter.filter((c) => c !== name));
                        } else if (platformCategoryFilter.length === 0) {
                          setPlatformCategoryFilter([name]);
                        } else {
                          setPlatformCategoryFilter([...platformCategoryFilter, name]);
                        }
                      }}
                      className={`p-3 border text-left transition-colors ${
                        platformCategoryFilter.length === 0 || platformCategoryFilter.includes(name)
                          ? "border-[#FF3B30]/40 bg-[#FF3B30]/5"
                          : "border-white/10 bg-white/[0.02] opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div className="font-sans text-[10px] uppercase tracking-wider opacity-60 leading-snug">{name}</div>
                      <div className="font-sans text-2xl font-bold tabular-nums mt-2">{counts[name] || 0}</div>
                      <div className="font-sans text-[9px] uppercase tracking-wider opacity-40 mt-1">Users</div>
                    </button>
                  ))}
                </div>

                <div className="glass-panel overflow-x-auto">
                  {categoryUsersLoading ? (
                    <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin opacity-50" /></div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 font-sans text-[9px] tracking-widest uppercase opacity-50">
                          <th className="p-4 font-normal">Username</th>
                          <th className="p-4 font-normal">Role</th>
                          <th className="p-4 font-normal">Categories</th>
                          <th className="p-4 font-normal">Email</th>
                          <th className="p-4 font-normal">Status</th>
                          <th className="p-4 font-normal text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-12 text-center font-sans italic text-2xl opacity-40">
                              No users found for selected categories
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((u) => (
                            <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                              <td className="p-4 font-sans text-sm font-medium">
                                {formatUsername(u.username, u.handle) || "—"}
                              </td>
                              <td className="p-4 font-sans text-[10px] uppercase tracking-widest text-[#FF3B30]">{roleLabel(u.role)}</td>
                              <td className="p-4 font-sans text-sm opacity-80">{userCategoryText(u) || "—"}</td>
                              <td className="p-4 font-sans text-sm break-all opacity-80">{u.email || "—"}</td>
                              <td className="p-4">
                                {(() => {
                                  const st = userStatusLabel(u);
                                  const cls =
                                    st === "Active" ? "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20" :
                                    st === "Pending" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                                    st === "Banned" ? "bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20" :
                                    "bg-white/5 text-white/60 border-white/15";
                                  return (
                                    <span className={`px-2 py-1 text-[9px] uppercase tracking-widest font-sans border rounded-3xl ${cls}`}>{st}</span>
                                  );
                                })()}
                              </td>
                              <td className="p-4">
                                {u.role !== "admin" && (
                                  <button onClick={() => promoteToAdmin(u.id)} className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors rounded-xs whitespace-nowrap">
                                    Promote Admin
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
            </motion.div>
            );
        })()}

        {/* TAB: BROADCAST */}
        {tab === "broadcast" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 p-6 glass-panel max-w-xl space-y-4">
                <h3 className="font-sans text-xs uppercase tracking-widest text-[#FF3B30]">Broadcast Notification</h3>
                <textarea value={broadcastText} onChange={(e) => setBroadcastText(e.target.value)} placeholder="Announcement message…" className="w-full bg-black/60 border border-white/20 p-3 font-sans text-sm h-28 rounded-xs" />
                <select value={broadcastRole} onChange={(e) => setBroadcastRole(e.target.value)} className="w-full bg-black/60 border border-white/20 p-2 font-sans text-xs rounded-xs text-[var(--fg)]">
                    <option value="">All Users</option>
                    <option value="influencer">Influencers Only</option>
                    <option value="owner">Brands Only</option>
                    <option value="agent">Agencies Only</option>
                    <option value="production">Hire / Production Only</option>
                </select>
                <div className="flex gap-2">
                    <input type="text" placeholder="State (optional)" value={broadcastState} onChange={e => setBroadcastState(e.target.value)} className="w-full bg-black/60 border border-white/20 p-2 font-sans text-xs rounded-xs" />
                    <input type="text" placeholder="City (optional)" value={broadcastCity} onChange={e => setBroadcastCity(e.target.value)} className="w-full bg-black/60 border border-white/20 p-2 font-sans text-xs rounded-xs" />
                    <input type="text" placeholder="Language (optional)" value={broadcastLanguage} onChange={e => setBroadcastLanguage(e.target.value)} className="w-full bg-black/60 border border-white/20 p-2 font-sans text-xs rounded-xs" />
                </div>
                <button onClick={sendBroadcast} className="btn-solid bg-[#FF3B30] text-white px-6 py-2 font-sans text-xs uppercase">Send Broadcast</button>
            </motion.div>
        )}

        {/* TAB 6: AUDIT LOGS */}
        {tab === "audit" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-8 space-y-4">
                <div className="relative z-30 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-end gap-3 p-4 rounded-3xl border border-white/10 bg-[#121212] overflow-visible">
                    <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md border border-white/10 rounded-full px-3 py-2 bg-white/[0.03]">
                        <Search className="w-4 h-4 opacity-50 shrink-0" />
                        <input
                          type="text"
                          placeholder="Search user, action, details…"
                          value={auditSearch}
                          onChange={(e) => setAuditSearch(e.target.value)}
                          className="w-full bg-transparent border-none outline-none text-sm placeholder:opacity-50 font-sans"
                        />
                    </div>
                    <div className="w-full sm:w-[180px] min-w-0">
                      <MultiSelectDropdown
                        options={[...new Set(activity.map((a) => a.type).filter(Boolean))]}
                        selected={auditTypeFilter}
                        onChange={setAuditTypeFilter}
                        placeholder="All types"
                        allowAll
                        compact
                        label="Action Type"
                      />
                    </div>
                    <div className="w-full sm:w-[160px] min-w-0">
                      <MultiSelectDropdown
                        options={[...new Set([
                          "Completed", "Pending", "Failed", "Info", "Warning",
                          ...activity.map((a) => a.status).filter(Boolean),
                        ])]}
                        selected={auditStatusFilter}
                        onChange={setAuditStatusFilter}
                        placeholder="All statuses"
                        allowAll
                        compact
                        label="Status"
                      />
                    </div>
                </div>
                <div className="glass-panel overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 font-sans text-[9px] tracking-widest uppercase opacity-50">
                                <th className="p-4 font-normal">Timestamp</th>
                                <th className="p-4 font-normal">User</th>
                                <th className="p-4 font-normal">Action Type</th>
                                <th className="p-4 font-normal">Details</th>
                                <th className="p-4 font-normal">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                              const filtered = activity.filter((a) => {
                                if (auditTypeFilter.length && !auditTypeFilter.includes(a.type)) return false;
                                if (auditStatusFilter.length && !auditStatusFilter.includes(a.status)) return false;
                                if (auditSearch.trim()) {
                                  const q = auditSearch.trim().toLowerCase();
                                  const hay = [
                                    a.username,
                                    a.user,
                                    a.type,
                                    a.details,
                                    a.status,
                                  ].filter(Boolean).join(" ").toLowerCase();
                                  if (!hay.includes(q)) return false;
                                }
                                return true;
                              });
                              if (filtered.length === 0) {
                                return (
                                  <tr><td colSpan={5} className="p-12 text-center font-sans italic text-2xl opacity-40">No matching activity</td></tr>
                                );
                              }
                              return filtered.map((a, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 font-sans text-[10px] uppercase tracking-widest opacity-60">
                                            {new Date(a.time).toLocaleString()}
                                        </td>
                                        <td className="p-4 text-sm opacity-90">
                                          {formatUsername(a.username, a.handle || a.user) || "—"}
                                        </td>
                                        <td className="p-4 font-sans text-xs">{a.type}</td>
                                        <td className="p-4 font-sans text-xs opacity-70">{a.details || "-"}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 text-[9px] uppercase tracking-widest font-bold border rounded-xs ${
                                                a.status === "Completed" ? "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/30" :
                                                a.status === "Pending" ? "bg-amber-500/10 text-amber-500 border-amber-500/30" :
                                                "bg-white/5 text-white/50 border-white/10"
                                            }`}>
                                                {a.status}
                                            </span>
                                        </td>
                                    </tr>
                              ));
                            })()}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        )}

        {/* TAB 7: MATCH ALGORITHM CONFIG */}
        {tab === "algorithm" && (
            <MatchAlgorithmConfig />
        )}

        {tab === "discovery" && (
            <DiscoveryOps />
        )}

        {tab === "production" && (
            <AdminProduction />
        )}

        {/* TAB 8: REFERRAL CONFIG */}
        {tab === "referrals" && (
            <ReferralConfig />
        )}
        </div>

      {/* EXPORT TIMEFRAME MODAL (Weekly, Monthly, 6 Months, 1 Year, Custom No Limit) */}
      {exportModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0B0E]/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#121212] border border-white/20 p-5 sm:p-6 md:p-8 max-w-lg w-full max-h-[min(90dvh,40rem)] overflow-y-auto rounded-3xl shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="font-sans text-[10px] tracking-[0.25em] uppercase text-[#FF3B30] font-bold">⚡ Data Export Engine</span>
                <h3 className="font-sans text-2xl mt-1 text-white">Select Export Timeframe</h3>
              </div>
              <button onClick={() => setExportModal(false)} className="text-white/60 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <label className="font-sans text-xs text-white/70 block uppercase tracking-wider">New Format</label>
              <div className="grid grid-cols-2 gap-2 font-sans text-xs">
                {EXPORT_FORMATS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setExportFormat(opt.id)}
                    className={`p-3 text-left border rounded-xs transition-all ${
                      exportFormat === opt.id
                        ? "bg-[#FF3B30] border-[#FF3B30] text-white font-bold shadow-md"
                        : "bg-white/5 border-white/10 text-white/70 hover:border-white/30"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <label className="font-sans text-xs text-white/70 block uppercase tracking-wider pt-2">Timeframe Preset</label>
              <div className="grid grid-cols-2 gap-2 font-sans text-xs">
                {[
                  { id: "weekly", label: "Weekly (7 Days)" },
                  { id: "monthly", label: "Monthly (30 Days)" },
                  { id: "6months", label: "6 Months (180 Days)" },
                  { id: "1year", label: "1 Year (365 Days)" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setExportRange(opt.id)}
                    className={`p-3 text-left border rounded-xs transition-all ${
                      exportRange === opt.id
                        ? "bg-[#FF3B30] border-[#FF3B30] text-white font-bold shadow-md"
                        : "bg-white/5 border-white/10 text-white/70 hover:border-white/30"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setExportRange("custom")}
                className={`w-full p-3 text-left border rounded-xs font-sans text-xs transition-all ${
                  exportRange === "custom"
                    ? "bg-[#FF3B30] border-[#FF3B30] text-white font-bold shadow-md"
                    : "bg-white/5 border-white/10 text-white/70 hover:border-white/30"
                }`}
              >
                Customized (No Limit - Custom Range)
              </button>

              {exportRange === "custom" && (
                <div className="grid grid-cols-2 gap-3 pt-2 font-sans text-xs">
                  <div>
                    <label className="text-white/50 block mb-1">Start Date (From)</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (endDate && e.target.value > endDate) {
                          setEndDate(e.target.value);
                        }
                      }}
                      className="w-full bg-[#0B0B0E]/60 border border-white/20 p-2 text-white rounded-xs focus:border-[#FF3B30] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-white/50 block mb-1">End Date (To)</label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-[#0B0B0E]/60 border border-white/20 p-2 text-white rounded-xs focus:border-[#FF3B30] outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-end gap-3 font-sans text-xs">
              <button type="button" onClick={() => setExportModal(false)} className="px-4 py-2 border border-white/20 hover:bg-white/5 text-white/70">Cancel</button>
              <button
                type="button"
                disabled={exportBusy}
                onClick={exportData}
                className="px-6 py-2 bg-[#FF3B30] text-white font-bold hover:bg-[#e03126] disabled:opacity-50"
              >
                {exportBusy ? "Generating…" : `Generate ${EXPORT_FORMATS.find((f) => f.id === exportFormat)?.label || "Export"}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Alert detail modal */}
      <AnimatePresence>
          {selectedAlert && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedAlert(null)}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#121212] border border-white/10 p-6 md:p-8 rounded-3xl w-full max-w-lg shadow-2xl relative max-h-[85vh] overflow-y-auto"
                  >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <p className={`font-mono text-[9px] uppercase tracking-widest mb-2 ${
                            selectedAlert.type === "error" ? "text-[#FF3B30]" :
                            selectedAlert.type === "warning" ? "text-orange-400" : "text-[#34C759]"
                          }`}>
                            {selectedAlert.type} · {selectedAlert.time}
                          </p>
                          <h3 className="font-editorial text-2xl md:text-3xl leading-tight">{selectedAlert.title || selectedAlert.text}</h3>
                          {selectedAlert.source && (
                            <p className="font-mono text-[10px] uppercase tracking-widest opacity-50 mt-2">{selectedAlert.source}</p>
                          )}
                        </div>
                        <button type="button" onClick={() => setSelectedAlert(null)} className="p-2 rounded-full hover:bg-white/5 opacity-60 hover:opacity-100">
                          <XCircle className="w-5 h-5" />
                        </button>
                      </div>

                      <section className="mb-5">
                        <h4 className="font-mono text-[9px] uppercase tracking-widest opacity-50 mb-2">Details</h4>
                        <p className="font-sans text-sm opacity-85 leading-relaxed">{selectedAlert.details || selectedAlert.text}</p>
                      </section>

                      {(selectedAlert.issues?.length > 0) && (
                        <section className="mb-5">
                          <h4 className="font-mono text-[9px] uppercase tracking-widest opacity-50 mb-2">Issues</h4>
                          <ul className="space-y-1.5">
                            {selectedAlert.issues.map((issue, i) => (
                              <li key={i} className="font-sans text-sm opacity-80 flex gap-2">
                                <span className="text-orange-400 shrink-0">•</span>
                                <span>{issue}</span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}

                      {(selectedAlert.errors?.length > 0) && (
                        <section className="mb-5">
                          <h4 className="font-mono text-[9px] uppercase tracking-widest text-[#FF3B30]/80 mb-2">Errors</h4>
                          <div className="space-y-2">
                            {selectedAlert.errors.map((err, i) => (
                              <pre key={i} className="font-mono text-[11px] leading-relaxed p-3 rounded-xl bg-[#FF3B30]/10 border border-[#FF3B30]/25 text-[#ffb4ae] whitespace-pre-wrap break-words">{err}</pre>
                            ))}
                          </div>
                        </section>
                      )}

                      {(selectedAlert.logs?.length > 0) && (
                        <section className="mb-2">
                          <h4 className="font-mono text-[9px] uppercase tracking-widest opacity-50 mb-2">Logs</h4>
                          <div className="rounded-xl bg-black/50 border border-white/10 p-3 space-y-1 max-h-48 overflow-y-auto">
                            {selectedAlert.logs.map((line, i) => (
                              <pre key={i} className="font-mono text-[11px] text-white/70 whitespace-pre-wrap break-words">{line}</pre>
                            ))}
                          </div>
                        </section>
                      )}

                      <div className="flex justify-end mt-6 pt-4 border-t border-white/10">
                          <button type="button" onClick={() => setSelectedAlert(null)} className="px-5 py-2 font-mono text-xs uppercase tracking-widest border border-white/15 hover:bg-white/5 rounded-full">
                              Close
                          </button>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

      {/* User Delete Confirmation Modal */}
      <AnimatePresence>
          {userToDelete && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-[#121212] border border-white/10 p-6 md:p-8 rounded-3xl w-full max-w-md shadow-2xl relative">
                      <h3 className="font-editorial text-3xl mb-2 text-[#FF3B30]">Delete User?</h3>
                      <p className="font-mono text-xs opacity-60 mb-8">
                          Are you sure you want to permanently delete this user? This action cannot be undone and will erase all their campaigns, applications, and data.
                      </p>
                      <div className="flex justify-end gap-4">
                          <button onClick={() => setUserToDelete(null)} className="px-4 py-2 font-mono text-xs text-white/60 hover:text-white transition-colors">
                              Cancel
                          </button>
                          <button onClick={confirmDeleteUser} className="btn-solid py-2 px-6 bg-[#FF3B30] text-white hover:bg-[#e03126]">
                              Delete Permanently
                          </button>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>

    </div>
  );
}

const FALLBACK_AGENTS = [
  {
    id: "ag-101",
    name: "Vikram Mehta",
    company: "Apex Talent Management",
    email: "vikram@apextalent.in",
    role: "agency",
    agent_type: "influencer_agent",
    industry: "Luxury Fashion & Lifestyle",
    city: "Mumbai, India",
    website: "https://apextalent.in",
    bio: "Representing top 25 lifestyle and fashion influencers across India with over 15M combined reach.",
    agent_approved: false,
    onboarding_status: "pending"
  },
  {
    id: "ag-102",
    name: "Ananya Roy",
    company: "Pulse Media Agency",
    email: "ananya@pulsemedia.io",
    role: "agency",
    agent_type: "company_agent",
    industry: "Tech & Consumer Electronics",
    city: "Bangalore, India",
    website: "https://pulsemedia.io",
    bio: "Full-service influencer management agency for high-growth tech brands and SaaS startups.",
    agent_approved: false,
    onboarding_status: "pending"
  },
  {
    id: "ag-103",
    name: "Karan Johar",
    company: "Starlet Influencer Studio",
    email: "karan@starletstudio.com",
    role: "agency",
    agent_type: "influencer_agent",
    industry: "Entertainment & Gaming",
    city: "Delhi NCR, India",
    website: "https://starletstudio.com",
    bio: "Managing gaming and esports talent, lifestyle vloggers, and short-form video specialists.",
    agent_approved: true,
    onboarding_status: "active"
  },
  {
    id: "ag-104",
    name: "Rohan Kapoor",
    company: "Vogue Influencer Collective",
    email: "rohan@voguecollective.in",
    role: "agency",
    agent_type: "company_agent",
    industry: "Beauty & Cosmetics",
    city: "Mumbai, India",
    website: "https://voguecollective.in",
    bio: "Connecting cosmetic brands with micro and macro beauty influencers across Asia.",
    agent_approved: false,
    onboarding_status: "pending"
  }
];

/* =========================================================================
   AGENT APPROVAL DESK
   ========================================================================= */
function AgentApprovalDesk({ fetchUsers, setStats }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [declineModal, setDeclineModal] = useState(null);
  const [declineReason, setDeclineReason] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // "grid" (4 in a row thumbnail) or "list"

  const loadAgents = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users?role=agency");
      const list = Array.isArray(data) ? data : (data?.users || []);
      if (list && list.length > 0) {
        setAgents(list);
      } else {
        setAgents(FALLBACK_AGENTS);
      }
    } catch (e) {
      setAgents(FALLBACK_AGENTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleApprove = async (agent) => {
    try {
      await api.post(`/admin/approve-agent/${agent.id}`);
      toast.success(`🎉 Approved ${agent.company || agent.name || "Agency"}! Access granted.`);
      loadAgents();
      if (fetchUsers) fetchUsers();
    } catch (e) {
      toast.error("Failed to approve agent");
    }
  };

  const handleDeclineSubmit = async (e) => {
    e.preventDefault();
    if (!declineModal) return;
    try {
      await api.post(`/admin/decline-agent/${declineModal.id}`, { reason: declineReason || "Agency credentials require further verification." });
      toast.info(`⚠️ Application declined for ${declineModal.company || declineModal.name || "Agency"}. Feedback sent.`);
      setDeclineModal(null);
      setDeclineReason("");
      loadAgents();
      if (fetchUsers) fetchUsers();
    } catch (e) {
      toast.error("Failed to decline application");
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin opacity-50 text-[#FF3B30]" /></div>;

  const displayAgents = (agents && agents.length > 0) ? agents : FALLBACK_AGENTS;

  return (
    <div className="mt-8 space-y-8">
      <div className="border-b border-white/10 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-sans text-3xl font-bold tracking-tight">Agent Verification &amp; Approval Desk</h2>
          <p className="font-sans text-xs opacity-60 mt-1 uppercase tracking-widest">
            Review agency credentials, website portfolios, and grant or decline studio access
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* VIEW MODE TOGGLE SWITCHER (Thumbnail View 4 in a row vs List View) */}
          <div className="flex bg-white/5 border border-white/10 p-1 rounded-xs font-sans text-xs">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 flex items-center gap-1.5 rounded-xs transition-all ${
                viewMode === "grid" ? "bg-[#FF3B30] text-white font-bold shadow-md" : "text-white/60 hover:text-white"
              }`}
            >
              ▦ Thumbnail View (4 in Row)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 flex items-center gap-1.5 rounded-xs transition-all ${
                viewMode === "list" ? "bg-[#FF3B30] text-white font-bold shadow-md" : "text-white/60 hover:text-white"
              }`}
            >
              ☰ List View
            </button>
          </div>

          <button type="button" onClick={loadAgents} className="btn-outline text-xs py-1.5 px-3 border-white/20 hover:border-white">
            Refresh Applications 🔄
          </button>
        </div>
      </div>

      {viewMode === "grid" ? (
        /* THUMBNAIL VIEW (4 IN A ROW GRID) */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {displayAgents.map((ag, i) => {
            const companyName = ag.company || ag.name || "Agency Partner";
            const companyInitial = (typeof companyName === "string" && companyName.length > 0) ? companyName.charAt(0).toUpperCase() : "A";
            const isApproved = Boolean(ag.agent_approved);
            const isDeclined = ag.onboarding_status === "declined";
            const agentType = ag.agent_type === "influencer_agent" ? "⭐ Influencer Agent" : "🏢 Company Agent";

            return (
              <div key={ag.id || i} className="p-4 border border-white/15 bg-[#121212] flex flex-col justify-between rounded-xs space-y-3 shadow-xl hover:border-[#FF3B30]/50 transition-all">
                <div className="space-y-3">
                  {/* Thumbnail Avatar/Banner Box */}
                  <div className="relative w-full h-32 bg-gradient-to-br from-[#FF3B30]/20 via-purple-900/20 to-blue-900/20 border border-white/10 rounded-xs flex items-center justify-center overflow-hidden">
                    <span className="font-sans text-4xl font-bold text-white/80">{companyInitial}</span>
                    <span className={`absolute top-2 right-2 font-sans text-[8px] uppercase tracking-widest px-2 py-0.5 rounded-xs border font-bold ${
                      isApproved ? "bg-[#34C759] text-black border-[#34C759]" :
                      isDeclined ? "bg-[#FF3B30] text-white border-[#FF3B30]" :
                      "bg-orange-500 text-black border-orange-500"
                    }`}>
                      {isApproved ? "Approved" : isDeclined ? "Declined" : "Pending"}
                    </span>
                  </div>

                  <div>
                    <span className="font-sans text-[9px] uppercase tracking-widest text-[#FF3B30] font-bold block">
                      {agentType}
                    </span>
                    <h3 className="font-sans text-xl font-bold text-white mt-1 leading-snug line-clamp-1">{companyName}</h3>
                    <p className="font-sans text-[10px] text-white/60 line-clamp-1">{ag.name || "Agency Lead"} · {ag.email || "agency@cr8.studio"}</p>
                  </div>

                  <div className="pt-2 border-t border-white/5 space-y-1 font-sans text-[10px] text-white/70">
                    <div><span className="text-white/40">Industry:</span> {ag.industry || "General"}</div>
                    <div><span className="text-white/40">City:</span> {ag.city || "India"}</div>
                    {ag.website && (
                      <div className="truncate"><span className="text-white/40">Site:</span> <a href={ag.website} target="_blank" rel="noreferrer" className="text-[#007AFF] hover:underline">{ag.website}</a></div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex items-center gap-2 font-sans text-[10px]">
                  {!isApproved ? (
                    <>
                      <button type="button" onClick={() => handleApprove(ag)} className="flex-1 py-1.5 bg-[#34C759] hover:bg-[#2fb24f] text-black font-bold rounded-xs text-center transition-all">
                        Approve ⚡
                      </button>
                      <button type="button" onClick={() => setDeclineModal(ag)} className="px-2.5 py-1.5 border border-[#FF3B30]/40 text-[#FF3B30] hover:bg-[#FF3B30]/20 rounded-xs font-bold transition-all">
                        Decline ✖
                      </button>
                    </>
                  ) : (
                    <div className="w-full py-1.5 bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/30 text-center font-bold rounded-xs">
                      Verified Studio Access ✓
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="border border-white/15 bg-[#121212] rounded-xs overflow-hidden shadow-2xl font-sans text-xs">
          <div className="hidden md:grid grid-cols-12 px-4 md:px-6 py-3 border-b border-white/10 bg-white/[0.02] text-white/50 text-[10px] tracking-widest uppercase font-bold">
            <div className="col-span-4">Agency / Company</div>
            <div className="col-span-3">Contact &amp; Location</div>
            <div className="col-span-2">Type / Industry</div>
            <div className="col-span-3 text-right">Verification Status / Action</div>
          </div>
          {displayAgents.map((ag, i) => {
            const companyName = ag.company || ag.name || "Agency Partner";
            const isApproved = Boolean(ag.agent_approved);

            return (
              <div key={ag.id || i} className="flex flex-col gap-3 md:grid md:grid-cols-12 md:items-center px-4 md:px-6 py-4 border-b border-white/5 hover:bg-white/[0.02]">
                <div className="md:col-span-4 space-y-0.5 min-w-0">
                  <div className="font-sans text-lg text-white font-bold break-words">{companyName}</div>
                  <div className="text-[10px] text-white/50 line-clamp-2">{ag.bio || "Talent agency partner."}</div>
                </div>
                <div className="md:col-span-3 space-y-0.5 text-white/70 text-[11px] min-w-0">
                  <div className="break-words">{ag.name || "Agency Contact"} ({ag.email || "agency@cr8.studio"})</div>
                  <div className="text-[10px] text-white/40">{ag.city || "India"}</div>
                </div>
                <div className="md:col-span-2 space-y-0.5">
                  <span className="text-[#FF3B30] font-bold text-[10px] uppercase block">{ag.agent_type || "Agency"}</span>
                  <span className="text-white/60 text-[10px]">{ag.industry || "Media"}</span>
                </div>
                <div className="md:col-span-3 flex flex-wrap items-center md:justify-end gap-2">
                  {!isApproved ? (
                    <>
                      <button type="button" onClick={() => handleApprove(ag)} className="px-3 py-1.5 bg-[#34C759] text-black font-bold text-[10px] uppercase rounded-xs hover:bg-[#2fb24f]">Approve ⚡</button>
                      <button type="button" onClick={() => setDeclineModal(ag)} className="px-2 py-1.5 border border-[#FF3B30]/50 text-[#FF3B30] font-bold text-[10px] uppercase rounded-xs hover:bg-[#FF3B30]/10">Decline</button>
                    </>
                  ) : (
                    <span className="text-[#34C759] bg-[#34C759]/10 px-3 py-1 border border-[#34C759]/30 rounded-xs font-bold text-[10px] uppercase">Verified Agent ✓</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DECLINE MODAL */}
      {declineModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleDeclineSubmit} className="bg-[#121212] border border-white/20 p-5 sm:p-6 max-w-md w-full max-h-[min(90dvh,36rem)] overflow-y-auto rounded-3xl space-y-4 shadow-2xl">
            <h3 className="font-sans text-2xl text-white font-bold">Decline Agency Access</h3>
            <p className="font-sans text-xs opacity-60">Decline application for {declineModal.company || declineModal.name || "Agency"}:</p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder=""
              className="w-full bg-black/60 border border-white/20 p-3 text-xs font-sans text-white rounded-xs h-24 focus:outline-none focus:border-[#FF3B30]"
              required
            />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 font-sans text-xs">
              <button type="button" onClick={() => setDeclineModal(null)} className="px-4 py-2 border border-white/20 hover:bg-white/5">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-[#FF3B30] text-white font-bold hover:bg-[#e03126]">Confirm Decline</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   ESCROW TREASURY DESK
   ========================================================================= */
function EscrowTreasuryDesk({ escrows = DEFAULT_ESCROWS, setEscrows }) {
  const handleForceRelease = (id) => {
    setEscrows((prev) => prev.map((e) => (e.id === id ? { ...e, status: "Released to Wallet" } : e)));
    toast.success(`Escrow #${id} override release completed!`);
  };

  const totalVolume = escrows.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalFees = escrows.reduce((s, e) => s + (Number(e.fee) || 0), 0);
  const released = escrows
    .filter((e) => e.status === "Released to Wallet")
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const disputed = escrows
    .filter((e) => String(e.status || "").toLowerCase().includes("dispute"))
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-8 space-y-8">
      <div className="border-b border-white/10 pb-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-sans text-2xl md:text-3xl font-bold tracking-tight">Treasury</h2>
          <p className="font-sans text-xs opacity-60 mt-1 uppercase tracking-[0.16em]">
            Audit live escrow locks, Escrow verification policy, and manual override releases
          </p>
        </div>
        <span className="font-sans text-xs px-3 py-1 bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/30 rounded-xs font-bold uppercase tracking-wider">
          100% Funds Held Secure
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 glass-panel">
          <div className="font-sans text-[10px] tracking-[0.16em] uppercase opacity-60 font-medium">Total Escrow Volume</div>
          <div className="font-sans text-3xl text-white font-bold mt-3 tracking-tight tabular-nums">₹{totalVolume.toLocaleString("en-IN")}</div>
          <div className="font-sans text-[9px] text-[#34C759] uppercase tracking-wider mt-2">100% Escrow Protected</div>
        </div>
        <div className="p-5 glass-panel">
          <div className="font-sans text-[10px] tracking-[0.16em] uppercase opacity-60 font-medium">Escrow Fees</div>
          <div className="font-sans text-3xl text-[#FF3B30] font-bold mt-3 tracking-tight tabular-nums">₹{totalFees.toLocaleString("en-IN")}</div>
          <div className="font-sans text-[9px] text-white/50 uppercase tracking-wider mt-2">Platform fees</div>
        </div>
        <div className="p-5 glass-panel">
          <div className="font-sans text-[10px] tracking-[0.16em] uppercase opacity-60 font-medium">Completed Payouts</div>
          <div className="font-sans text-3xl text-[#34C759] font-bold mt-3 tracking-tight tabular-nums">₹{released.toLocaleString("en-IN")}</div>
          <div className="font-sans text-[9px] text-[#34C759] uppercase tracking-wider mt-2">Direct Wallet Transfer</div>
        </div>
        <div className="p-5 glass-panel">
          <div className="font-sans text-[10px] tracking-[0.16em] uppercase opacity-60 font-medium">Disputed Claims</div>
          <div className="font-sans text-3xl text-orange-400 font-bold mt-3 tracking-tight tabular-nums">₹{disputed.toLocaleString("en-IN")}</div>
          <div className="font-sans text-[9px] text-orange-400 uppercase tracking-wider mt-2">Under review</div>
        </div>
      </div>

      <div className="glass-panel overflow-x-auto">
        <div className="p-4 border-b border-white/10 font-sans text-[10px] uppercase tracking-[0.16em] text-[#FF3B30] font-bold">
          Live Escrow Ledger &amp; Manual Override Control
        </div>
        <table className="w-full text-left border-collapse font-sans text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[9px] tracking-widest uppercase opacity-50">
              <th className="p-4 font-normal">Escrow ID</th>
              <th className="p-4 font-normal">Campaign &amp; Brand</th>
              <th className="p-4 font-normal">Influencer</th>
              <th className="p-4 font-normal">Total Amount</th>
              <th className="p-4 font-normal">Escrow Fee</th>
              <th className="p-4 font-normal">Status</th>
              <th className="p-4 font-normal text-right">Admin Control</th>
            </tr>
          </thead>
          <tbody>
            {escrows.map((e) => (
              <tr key={e.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="p-4 font-bold text-white tabular-nums">{e.id}</td>
                <td className="p-4"><div className="font-sans text-base text-white font-medium">{e.campaign}</div><div className="opacity-50 text-xs mt-0.5">{e.brand}</div></td>
                <td className="p-4 text-white">{e.creator}</td>
                <td className="p-4 text-[#34C759] font-bold tabular-nums">₹{Number(e.amount).toLocaleString("en-IN")}</td>
                <td className="p-4 text-[#FF3B30] font-bold tabular-nums">₹{Number(e.fee).toLocaleString("en-IN")}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 text-[9px] uppercase tracking-widest border rounded-xs font-bold ${
                    e.status === "Released to Wallet" ? "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/30" : "bg-orange-400/10 text-orange-400 border-orange-400/30"
                  }`}>
                    {e.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  {e.status === "Locked in Escrow" ? (
                    <button type="button" onClick={() => handleForceRelease(e.id)} className="btn-solid py-1 px-3 text-[10px] bg-[#34C759] text-white font-sans uppercase tracking-wider">
                      Force Release
                    </button>
                  ) : (
                    <span className="opacity-50 text-[10px] font-sans uppercase tracking-wider">Payout Complete</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   BRIEF MODERATION & AI AUDIT DESK
   ========================================================================= */
function BriefModerationDesk({ briefs = DEFAULT_BRIEFS, setBriefs }) {
  const [viewMode, setViewMode] = useState("grid"); // grid | table

  const handleApproveBrief = (id) => {
    setBriefs((prev) => prev.map((b) => (b.id === id ? { ...b, status: "Approved & Live" } : b)));
    toast.success(`Campaign brief #${id} approved for Marketplace!`);
  };

  const statusClass = (status) =>
    status === "Approved & Live"
      ? "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/30"
      : "bg-orange-400/10 text-orange-400 border-orange-400/30";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-8 space-y-6">
      <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-sans text-2xl md:text-3xl font-bold tracking-tight">Campaign Brief Moderation</h2>
          <p className="font-sans text-xs opacity-60 mt-1 uppercase tracking-widest">
            Review incoming brand campaign briefs, AI logo checks, and copyright compliance
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-full border border-white/15 p-0.5 bg-white/[0.03]">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[9px] uppercase tracking-widest transition-colors ${
                viewMode === "grid" ? "bg-[#FF3B30] text-white" : "text-white/55 hover:text-white"
              }`}
              aria-pressed={viewMode === "grid"}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[9px] uppercase tracking-widest transition-colors ${
                viewMode === "table" ? "bg-[#FF3B30] text-white" : "text-white/55 hover:text-white"
              }`}
              aria-pressed={viewMode === "table"}
            >
              <List className="w-3.5 h-3.5" /> Table
            </button>
          </div>
          <span className="font-sans text-xs px-3 py-1 bg-white/5 text-white/70 border border-white/15 rounded-xs font-bold">
            AI Compliance Guard
          </span>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {briefs.map((b) => (
            <div key={b.id} className="p-5 bg-[#121212] border border-white/15 rounded-2xl space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3 gap-2">
                  <span className="font-sans text-[10px] text-[#FF3B30] uppercase font-bold truncate">{b.brand}</span>
                  <span className={`shrink-0 font-sans text-[9px] px-2 py-0.5 border rounded-xs font-bold ${statusClass(b.status)}`}>
                    {b.status}
                  </span>
                </div>
                <h3 className="font-sans text-xl font-bold mt-3 text-white leading-snug">{b.title}</h3>
                <p className="font-sans text-xs text-white/60 mt-1">Budget: ₹{Number(b.budget).toLocaleString("en-IN")} · {b.category}</p>
                <div className="mt-4 p-3 bg-white/[0.03] border border-white/10 rounded-xs space-y-1.5 font-sans text-[11px]">
                  <div className="flex justify-between text-[#34C759]">
                    <span>AI Content Audit</span>
                    <span className="font-bold">{b.aiSafety}</span>
                  </div>
                  <div className="flex justify-between text-white/70">
                    <span>Deliverables</span>
                    <span className="text-right max-w-[55%]">{b.deliverables}</span>
                  </div>
                  <div className="flex justify-between text-white/70">
                    <span>Timeline</span>
                    <span>{b.timeline}</span>
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-white/10 flex items-center justify-between font-sans text-xs">
                <span className="opacity-50">Brief #{b.id}</span>
                {b.status === "Pending Review" ? (
                  <button type="button" onClick={() => handleApproveBrief(b.id)} className="btn-solid py-1.5 px-4 text-xs bg-[#FF3B30] text-white">
                    Approve &amp; Publish
                  </button>
                ) : (
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#34C759]">Live</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-panel overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[9px] tracking-widest uppercase opacity-50">
                <th className="p-4 font-normal">Brief</th>
                <th className="p-4 font-normal">Brand</th>
                <th className="p-4 font-normal">Category</th>
                <th className="p-4 font-normal">Budget</th>
                <th className="p-4 font-normal">Deliverables</th>
                <th className="p-4 font-normal">AI Safety</th>
                <th className="p-4 font-normal">Status</th>
                <th className="p-4 font-normal text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {briefs.map((b) => (
                <tr key={b.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-white">{b.title}</div>
                    <div className="text-[10px] opacity-45 mt-0.5 font-mono uppercase tracking-wider">{b.id} · {b.timeline}</div>
                  </td>
                  <td className="p-4 text-white/85">{b.brand}</td>
                  <td className="p-4 text-white/70 text-xs">{b.category}</td>
                  <td className="p-4 text-[#34C759] font-bold tabular-nums">₹{Number(b.budget).toLocaleString("en-IN")}</td>
                  <td className="p-4 text-xs text-white/65 max-w-[180px]">{b.deliverables}</td>
                  <td className="p-4 text-xs text-[#34C759] font-medium">{b.aiSafety}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-[9px] uppercase tracking-widest border rounded-xs font-bold ${statusClass(b.status)}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {b.status === "Pending Review" ? (
                      <button type="button" onClick={() => handleApproveBrief(b.id)} className="btn-solid py-1 px-3 text-[10px] bg-[#FF3B30] text-white font-sans uppercase tracking-wider">
                        Approve
                      </button>
                    ) : (
                      <span className="opacity-45 text-[10px] font-sans uppercase tracking-wider">Published</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

function MatchAlgorithmConfig() {
  const [config, setConfig] = useState(null);
  useEffect(() => {
    api.get("/admin/match-config").then(r => setConfig(r.data)).catch(() => {});
  }, []);
  const handleSave = () => {
    api.put("/admin/match-config", config).then(() => toast.success("Config saved")).catch(() => toast.error("Failed to save config"));
  };
  if (!config) return <div className="p-8 text-center opacity-50">Loading config...</div>;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 p-6 glass-panel max-w-xl">
       <h3 className="font-sans text-xs uppercase tracking-widest text-[#FF3B30] mb-4">Match Algorithm Configuration</h3>
       <div className="space-y-4">
         {Object.entries(config).map(([key, val]) => (
           <div key={key} className="flex flex-col gap-1">
             <label className="font-sans text-[10px] uppercase opacity-70">{key.replace(/_/g, " ")}</label>
             <input type="number" step="0.1" value={val} onChange={e => setConfig({...config, [key]: parseFloat(e.target.value) || 0})} className="bg-black/60 border border-white/20 p-2 font-sans text-sm rounded-xs w-full text-white" />
           </div>
         ))}
       </div>
       <button onClick={handleSave} className="mt-6 btn-solid bg-[#FF3B30] text-white px-6 py-2 font-sans text-xs uppercase hover:bg-[#e03126]">Save Configuration</button>
    </motion.div>
  );
}

function ReferralConfig() {
  const [config, setConfig] = useState(null);
  useEffect(() => {
    api.get("/admin/referral-config").then(r => setConfig(r.data)).catch(() => {});
  }, []);
  const handleSave = () => {
    api.put("/admin/referral-config", config).then(() => toast.success("Config saved")).catch(() => toast.error("Failed to save config"));
  };
  if (!config) return <div className="p-8 text-center opacity-50">Loading config...</div>;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 p-6 glass-panel max-w-xl">
       <h3 className="font-sans text-xs uppercase tracking-widest text-[#FF3B30] mb-4">Referral Configuration</h3>
       <div className="space-y-4">
         <div className="flex flex-col gap-1">
           <label className="font-sans text-[10px] uppercase opacity-70">Referrer Reward</label>
           <input type="number" value={config.referrer_reward || 0} onChange={e => setConfig({...config, referrer_reward: parseInt(e.target.value) || 0})} className="bg-black/60 border border-white/20 p-2 font-sans text-sm rounded-xs w-full text-white" />
         </div>
         <div className="flex flex-col gap-1">
           <label className="font-sans text-[10px] uppercase opacity-70">Referee Reward</label>
           <input type="number" value={config.referee_reward || 0} onChange={e => setConfig({...config, referee_reward: parseInt(e.target.value) || 0})} className="bg-black/60 border border-white/20 p-2 font-sans text-sm rounded-xs w-full text-white" />
         </div>
       </div>
       <button onClick={handleSave} className="mt-6 btn-solid bg-[#FF3B30] text-white px-6 py-2 font-sans text-xs uppercase hover:bg-[#e03126]">Save Configuration</button>
    </motion.div>
  );
}
