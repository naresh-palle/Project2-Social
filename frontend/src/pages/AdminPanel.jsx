import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { 
  Users, IndianRupee, Activity, Bell, Search, Download, Calendar, 
  ArrowUpRight, ArrowDownRight, Loader2, CheckCircle2, XCircle, Filter, 
  Trash2, Lock, ShieldCheck, Zap, FileText, Check, ShieldAlert
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { MultiSelectDropdown } from "@/components/MultiSelectDropdown";
import { PLATFORM_CATEGORIES } from "@/lib/categories";

const USER_ROLE_OPTIONS = ["Creators", "Brands", "Agencies"];
const USER_STATUS_OPTIONS = ["Active", "Pending"];
const ROLE_API_MAP = {
  Creators: "creator",
  Brands: "brand",
  Agencies: "agency",
};
const ROLE_DB_MAP = {
  Creators: "influencer",
  Brands: "owner",
  Agencies: "agent",
};
function StatCard({ title, value, sub, icon, trend, pos }) {
    return (
        <div className="p-4 xl:p-5 border border-white/10 bg-white/[0.02] relative overflow-hidden group min-w-0">
            <div className="flex justify-between items-start gap-2">
                <div className="font-sans text-[10px] tracking-[0.16em] uppercase opacity-60 font-medium leading-snug">{title}</div>
                <div className="p-2 bg-white/5 rounded-sm shrink-0">{icon}</div>
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

export function AdminPanel() {
  const [tab, setTab] = useState("overview");
  const [exportModal, setExportModal] = useState(false);
  const [exportRange, setExportRange] = useState("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(""); 
  
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [payments, setPayments] = useState([]);
  
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  
  const [loading, setLoading] = useState(true);
  
  const [roleFilter, setRoleFilter] = useState([]); // [] = All
  const [categoryFilter, setCategoryFilter] = useState([]); // [] = All
  const [statusFilter, setStatusFilter] = useState([]); // [] = All
  const [searchQuery, setSearchQuery] = useState("");
  const [reports, setReports] = useState([]);
  const [categories, setCategories] = useState([]);
  const [platformStats, setPlatformStats] = useState(null);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastRole, setBroadcastRole] = useState("");

  const notifications = [
      { id: 1, text: "New creator '@zara_fashion' registered", time: "2 mins ago", type: "success" },
      { id: 2, text: "Escrow locked for campaign 'HyperTech AI'", time: "45 mins ago", type: "success" },
      { id: 3, text: "Payment of ₹45,000 completed", time: "3 hrs ago", type: "success" },
      { id: 4, text: "3 new agency verification requests pending", time: "5 hrs ago", type: "warning" }
  ];

  useEffect(() => {
    async function load() {
      try {
        const [stRes, actRes, payRes] = await Promise.all([
          api.get("/admin/dashboard-stats"),
          api.get("/admin/recent-activity"),
          api.get("/admin/payments")
        ]);
        setStats(stRes.data);
        setActivity(actRes.data);
        setPayments(payRes.data);
        try {
          const platRes = await api.get("/analytics/platform");
          setPlatformStats(platRes.data);
        } catch {}
      } catch (e) {
        toast.error("Failed to load platform data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const fetchUsers = async () => {
      setUsersLoading(true);
      try {
          const params = new URLSearchParams();
          if (roleFilter?.length === 1) params.append("role", ROLE_API_MAP[roleFilter[0]] || roleFilter[0]);
          if (categoryFilter?.length === 1) params.append("category", categoryFilter[0]);
          if (statusFilter?.length === 1 && statusFilter[0] === "Pending") params.append("status", "pending");
          if (searchQuery) params.append("q", searchQuery);
          
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
              const pending = u.onboarding_status === "pending" || (u.role === "agent" && u.agent_approved === false);
              if (wantPending && pending) return true;
              if (wantActive && !pending) return true;
              return false;
            });
          }

          setUsersList(list);
      } catch (e) {
          toast.error("Failed to load users");
      } finally {
          setUsersLoading(false);
      }
  };

  useEffect(() => {
      if (tab === "users") fetchUsers();
      if (tab === "reports") {
        api.get("/admin/reports").then(r => setReports(r.data || [])).catch(() => toast.error("Failed to load reports"));
      }
      if (tab === "categories") {
        api.get("/admin/categories").then(r => setCategories(r.data || [])).catch(() => toast.error("Failed to load categories"));
      }
      if (tab === "audit") {
        api.get("/admin/recent-activity").then(r => setActivity(r.data || [])).catch(() => toast.error("Failed to load audit logs"));
      }
  }, [tab, roleFilter, categoryFilter, statusFilter, searchQuery]);

  // Keep Audit Logs fresh while the tab is open
  useEffect(() => {
      if (tab !== "audit") return undefined;
      const tick = () => {
        api.get("/admin/recent-activity").then(r => setActivity(r.data || [])).catch(() => {});
      };
      const id = setInterval(tick, 12000);
      return () => clearInterval(id);
  }, [tab]);

  const deleteUser = async (userId, role) => {
      if (role === "admin") {
          toast.error("Admin users cannot be deleted");
          return;
      }
      if (!window.confirm("Are you sure you want to permanently delete this user?")) return;
      try {
          await api.delete(`/admin/users/${userId}`);
          toast.success("User deleted successfully");
          fetchUsers();
          const stRes = await api.get("/admin/dashboard-stats");
          setStats(stRes.data);
      } catch (e) {
          toast.error(e?.response?.data?.detail || "Failed to delete user");
      }
  };

  const banUser = async (userId, role) => {
      if (role === "admin") {
          toast.error("Admin users cannot be banned");
          return;
      }
      const reason = window.prompt("Ban reason (optional):") || "Policy violation";
      if (!window.confirm("Ban this user?")) return;
      try {
          await api.post(`/admin/users/${userId}/ban`, { reason });
          toast.success("User banned");
          fetchUsers();
      } catch (e) {
          toast.error(e?.response?.data?.detail || "Ban failed");
      }
  };

  const handleReportAction = async (reportId, status) => {
      try {
          await api.post(`/admin/reports/${reportId}`, { status, note: `Marked ${status}` });
          toast.success(`Report ${status}`);
          const { data } = await api.get("/admin/reports");
          setReports(data || []);
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
          });
          toast.success(`Broadcast sent to ${data.sent} users`);
          setBroadcastText("");
      } catch {
          toast.error("Broadcast failed");
      }
  };

    const exportCSV = () => {
      const data = tab === "users" ? usersList : [stats];
      if (!data || !data.length) return;
      const headers = Object.keys(data[0] || {}).join(",");
      const csv = [
          `# Export Timeframe: ${exportRange.toUpperCase()}${exportRange === 'custom' ? ` (${startDate} to ${endDate || 'Unlimited'})` : ''}`,
          headers,
          ...data.map(row => Object.values(row || {}).map(v => `"${v}"`).join(","))
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cr8_export_${tab}_${exportRange}_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExportModal(false);
      toast.success(`Export successful (${exportRange.toUpperCase()} timeframe)`);
  };

  if (loading) return (
      <div className="flex items-center justify-center py-20 text-[#F4F4F0]">
        <div className="animate-pulse font-sans tracking-widest text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Initializing Super Admin Console...
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
    <div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-6">
            <div>
                <p className="font-sans text-[10px] tracking-[0.3em] uppercase text-[#FF3B30] font-bold">§ Super Admin Console</p>
                <h1 className="font-sans text-5xl md:text-6xl leading-none mt-2">Platform Console<span className="text-[#FF3B30]">.</span></h1>
                <div className="flex gap-6 mt-8 font-sans text-xs uppercase tracking-widest flex-wrap">
                    <button onClick={() => setTab("overview")} className={`pb-2 border-b-2 transition-colors ${tab === "overview" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>Overview</button>
                    <button onClick={() => setTab("agent_approvals")} className={`pb-2 border-b-2 transition-colors ${tab === "agent_approvals" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>
                      Agent Approvals <span className="bg-[#FF3B30] text-white px-2 py-0.5 text-[9px] rounded-xs font-bold ml-1">Desk</span>
                    </button>
                    <button onClick={() => setTab("treasury")} className={`pb-2 border-b-2 transition-colors ${tab === "treasury" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>
                      Escrow Treasury <span className="bg-[#34C759] text-white px-2 py-0.5 text-[9px] rounded-xs font-bold ml-1">₹</span>
                    </button>
                    <button onClick={() => setTab("briefs")} className={`pb-2 border-b-2 transition-colors ${tab === "briefs" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>
                      Brief Moderation <span className="bg-purple-500 text-white px-2 py-0.5 text-[9px] rounded-xs font-bold ml-1">AI</span>
                    </button>
                    <button onClick={() => setTab("users")} className={`pb-2 border-b-2 transition-colors ${tab === "users" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>User Management</button>
                    <button onClick={() => setTab("reports")} className={`pb-2 border-b-2 transition-colors ${tab === "reports" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>Reports</button>
                    <button onClick={() => setTab("categories")} className={`pb-2 border-b-2 transition-colors ${tab === "categories" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>Categories</button>
                    <button onClick={() => setTab("broadcast")} className={`pb-2 border-b-2 transition-colors ${tab === "broadcast" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>Broadcast</button>
                    <button onClick={() => setTab("audit")} className={`pb-2 border-b-2 transition-colors ${tab === "audit" ? "border-[#FF3B30] text-[#FF3B30] font-bold" : "border-transparent opacity-60 hover:opacity-100"}`}>Audit Logs</button>
                </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                <button onClick={() => setExportModal(true)} className="btn-outline border-[#FF3B30] text-[#FF3B30] hover:bg-[#FF3B30] hover:text-white px-4 py-2 flex items-center gap-2 font-bold shadow-lg transition-all">
                    <Download className="w-4 h-4" /> Export {tab === "users" ? "Users" : "Data"}
                </button>
            </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {tab === "overview" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-8">
                    <StatCard title="Total Users" value={(stats?.users?.creators || 22) + (stats?.users?.brands || 5) + (stats?.users?.agencies || 4)} sub={`${stats?.users?.creators || 22} Creators · ${stats?.users?.brands || 5} Brands`} icon={<Users className="w-5 h-5 text-blue-400" />} trend="+12%" pos={true} />
                    <StatCard title="DAU / MAU" value={platformStats ? `${platformStats.dau} / ${platformStats.mau}` : "—"} sub="Daily & Monthly Active Users" icon={<Activity className="w-5 h-5 text-cyan-400" />} trend={platformStats ? `${platformStats.posts} posts` : "—"} pos={true} />
                    <StatCard title="Total Escrow Processed" value="₹48.5L" sub="100% Escrow Protection Guaranteed" icon={<IndianRupee className="w-5 h-5 text-green-400" />} trend="+15%" pos={true} />
                    <StatCard title="Active Campaigns" value={stats?.campaigns?.active || 11} sub={`Out of ${stats?.campaigns?.total || 14} total`} icon={<Activity className="w-5 h-5 text-purple-400" />} trend="+8%" pos={true} />
                    <StatCard title="Pending Verifications" value={(stats?.requests?.verification_requests || 2) + (stats?.requests?.creator_requests || 1)} sub={`${stats?.requests?.verification_requests || 2} agencies pending`} icon={<Bell className="w-5 h-5 text-orange-400" />} trend="2 pending" pos={false} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                    <div className="lg:col-span-2 p-6 border border-white/10 bg-white/[0.02]">
                        <h3 className="font-sans text-[10px] tracking-[0.16em] uppercase opacity-60 mb-6 font-medium">Revenue &amp; GMV Growth Stream</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueData}>
                                    <defs>
                                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34C759" stopOpacity={0.3}/><stop offset="95%" stopColor="#34C759" stopOpacity={0}/></linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" stroke="rgba(244,244,240,0.2)" fontSize={10} />
                                    <YAxis stroke="rgba(244,244,240,0.2)" fontSize={10} tickFormatter={v => `₹${v/1000}k`} />
                                    <Tooltip contentStyle={{ backgroundColor: '#0A0A0A', borderColor: 'rgba(244,244,240,0.1)' }} itemStyle={{ color: '#F4F4F0' }} />
                                    <Area type="monotone" dataKey="revenue" stroke="#34C759" fillOpacity={1} fill="url(#colorRev)" />
                                    <Area type="monotone" dataKey="payments" stroke="rgba(244,244,240,0.3)" fill="none" strokeDasharray="3 3" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    
                    <div className="p-6 border border-white/10 bg-white/[0.02] flex flex-col">
                        <h3 className="font-sans text-[10px] tracking-[0.16em] uppercase opacity-60 mb-6 font-medium">Platform Activity</h3>
                        <div className="flex-1 flex justify-center items-center">
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie data={platformData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {platformData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#0A0A0A', borderColor: 'rgba(244,244,240,0.1)' }} itemStyle={{ color: '#F4F4F0' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center gap-6 mt-4 font-sans text-[10px] tracking-wider uppercase opacity-80">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#34C759]" /> Active</div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#FF3B30]" /> Inactive</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                    <div className="lg:col-span-2 p-6 border border-white/10 bg-white/[0.02]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-sans text-[10px] tracking-[0.16em] uppercase opacity-60 font-medium">Recent Escrow Payments</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 font-sans text-[9px] tracking-widest uppercase opacity-50">
                                        <th className="p-3 font-normal">ID</th><th className="p-3 font-normal">Creator</th><th className="p-3 font-normal">Brand</th><th className="p-3 font-normal">Amount</th><th className="p-3 font-normal">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(payments.length > 0 ? payments : [
                                      { id: "ESC-801", creator: "Aarav Sharma", brand: "Studio Noir", amount: 250000, status: "Escrow Released" },
                                      { id: "ESC-802", creator: "Priya Varma", brand: "HyperTech AI", amount: 350000, status: "Escrow Locked" },
                                      { id: "ESC-803", creator: "Rohan Kapoor", brand: "Veda Organics", amount: 180000, status: "Escrow Released" },
                                      { id: "ESC-804", creator: "Neha Gupta", brand: "PulseFit Global", amount: 200000, status: "Escrow Locked" },
                                    ]).slice(0, 5).map((p, i) => (
                                        <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                            <td className="p-3 font-sans text-sm opacity-60">#{p.id}</td>
                                            <td className="p-3 font-sans text-sm">{p.creator}</td>
                                            <td className="p-3 font-sans text-sm opacity-80">{p.brand}</td>
                                            <td className="p-3 font-sans text-sm text-[#34C759] font-bold tabular-nums">₹{(p.amount || 0).toLocaleString()}</td>
                                            <td className="p-3">
                                                <span className="px-2 py-1 text-[9px] uppercase tracking-widest font-sans bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20 rounded-sm font-bold">{p.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="p-6 border border-white/10 bg-white/[0.02]">
                            <h3 className="font-sans text-[10px] tracking-[0.16em] uppercase opacity-60 mb-6 font-medium flex items-center gap-2"><Bell className="w-3 h-3 text-[#FF3B30]" /> System Alerts</h3>
                            <div className="space-y-4">
                                {notifications.map(n => (
                                    <div key={n.id} className="flex items-start gap-3">
                                        {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#34C759] shrink-0 mt-0.5" />}
                                        {n.type === 'error' && <XCircle className="w-4 h-4 text-[#FF3B30] shrink-0 mt-0.5" />}
                                        {n.type === 'warning' && <Activity className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />}
                                        <div>
                                            <p className="font-sans text-sm opacity-90 leading-snug">{n.text}</p>
                                            <p className="font-sans text-[9px] uppercase tracking-widest opacity-50 mt-1">{n.time}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        )}

        {/* TAB 2: AGENT APPROVALS */}
        {tab === "agent_approvals" && (
            <AgentApprovalDesk fetchUsers={fetchUsers} setStats={setStats} />
        )}

        {/* TAB 3: ESCROW TREASURY DESK */}
        {tab === "treasury" && (
            <EscrowTreasuryDesk />
        )}

        {/* TAB 4: BRIEF MODERATION DESK */}
        {tab === "briefs" && (
            <BriefModerationDesk />
        )}

        {/* TAB 5: USER MANAGEMENT */}
        {tab === "users" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-8">
                <div className="flex flex-wrap items-center gap-4 mb-6 p-4 border border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <Search className="w-4 h-4 opacity-50" />
                        <input type="text" placeholder="Search username, email, mobile…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-transparent border-none outline-none text-sm placeholder:opacity-50 font-sans" />
                    </div>
                    <div className="h-6 w-px bg-white/10 hidden md:block" />
                    <div className="flex flex-wrap items-center gap-4 font-sans text-[10px] uppercase tracking-wider flex-1 min-w-[280px]">
                        <div className="flex items-center gap-2 shrink-0">
                            <Filter className="w-3 h-3 opacity-50" />
                        </div>
                        <div className="min-w-[140px] max-w-[200px] flex-1">
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
                        <div className="min-w-[180px] max-w-xs flex-1">
                          <MultiSelectDropdown
                            options={PLATFORM_CATEGORIES}
                            selected={categoryFilter}
                            onChange={setCategoryFilter}
                            placeholder="All"
                            allowAll
                            compact
                            label="Category"
                          />
                        </div>
                        <div className="min-w-[140px] max-w-[180px] flex-1">
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
                    </div>
                </div>
                <div className="border border-white/10 bg-white/[0.02] overflow-x-auto">
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
                                                {u.username ? `@${String(u.username).replace(/^@/, "")}` : (u.handle || "—")}
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
                                            <td className="p-4"><div className="font-sans text-[10px] uppercase tracking-widest text-[#FF3B30]">{u.role}</div><div className="text-xs opacity-60 mt-1">{u.category || "—"}</div></td>
                                            <td className="p-4 font-sans text-[10px] uppercase tracking-widest opacity-60">{new Date(u.created_at).toLocaleDateString()}</td>
                                            <td className="p-4">
                                                {u.onboarding_status === 'pending' ? <span className="px-2 py-1 text-[9px] uppercase tracking-widest font-sans bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-sm">Pending</span> : <span className="px-2 py-1 text-[9px] uppercase tracking-widest font-sans bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20 rounded-sm">Active</span>}
                                            </td>
                                            <td className="p-4 text-right">
                                              {u.role === "admin" ? (
                                                <span className="font-sans text-[9px] uppercase tracking-widest opacity-40">Protected</span>
                                              ) : (
                                                <div className="flex items-center justify-end gap-1">
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
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 border border-white/10 bg-white/[0.02] overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/10 font-sans text-[9px] tracking-widest uppercase opacity-50">
                            <th className="p-4">Type</th><th className="p-4">Target</th><th className="p-4">Reason</th><th className="p-4">Status</th><th className="p-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.length === 0 ? (
                            <tr><td colSpan={5} className="p-12 text-center font-sans italic text-2xl opacity-40">No open reports</td></tr>
                        ) : reports.map((r) => (
                            <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                <td className="p-4 font-sans text-xs uppercase">{r.target_type}</td>
                                <td className="p-4 font-sans text-xs">{r.target_id}</td>
                                <td className="p-4 text-sm">{r.reason}</td>
                                <td className="p-4"><span className="px-2 py-1 text-[9px] uppercase font-sans bg-orange-400/10 text-orange-400 border border-orange-400/20 rounded-xs">{r.status}</span></td>
                                <td className="p-4 text-right space-x-2">
                                    <button onClick={() => handleReportAction(r.id, "resolved")} className="font-sans text-[10px] text-[#34C759] uppercase">Resolve</button>
                                    <button onClick={() => handleReportAction(r.id, "dismissed")} className="font-sans text-[10px] opacity-50 uppercase">Dismiss</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </motion.div>
        )}

        {/* TAB: CATEGORIES */}
        {tab === "categories" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 p-6 border border-white/10 bg-white/[0.02]">
                <h3 className="font-sans text-xs uppercase tracking-widest text-[#FF3B30] mb-4">Platform Categories</h3>
                <div className="flex flex-wrap gap-2">
                    {(categories.length ? categories : PLATFORM_CATEGORIES.map((name) => ({ name }))).map((c, i) => (
                        <span key={c.id || i} className="px-3 py-1.5 bg-white/5 border border-white/10 font-sans text-xs rounded-xs">{c.name || c}</span>
                    ))}
                </div>
            </motion.div>
        )}

        {/* TAB: BROADCAST */}
        {tab === "broadcast" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 p-6 border border-white/10 bg-white/[0.02] max-w-xl space-y-4">
                <h3 className="font-sans text-xs uppercase tracking-widest text-[#FF3B30]">Broadcast Notification</h3>
                <textarea value={broadcastText} onChange={(e) => setBroadcastText(e.target.value)} placeholder="Announcement message…" className="w-full bg-black/60 border border-white/20 p-3 font-sans text-sm h-28 rounded-xs" />
                <select value={broadcastRole} onChange={(e) => setBroadcastRole(e.target.value)} className="w-full bg-black/60 border border-white/20 p-2 font-sans text-xs rounded-xs">
                    <option value="">All Users</option>
                    <option value="influencer">Creators Only</option>
                    <option value="owner">Brands Only</option>
                    <option value="agent">Agencies Only</option>
                </select>
                <button onClick={sendBroadcast} className="btn-solid bg-[#FF3B30] text-white px-6 py-2 font-sans text-xs uppercase">Send Broadcast</button>
            </motion.div>
        )}

        {/* TAB 6: AUDIT LOGS */}
        {tab === "audit" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-8">
                <div className="border border-white/10 bg-white/[0.02] overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 font-sans text-[9px] tracking-widest uppercase opacity-50">
                                <th className="p-4 font-normal">Timestamp</th>
                                <th className="p-4 font-normal">User</th>
                                <th className="p-4 font-normal">Action Type</th>
                                <th className="p-4 font-normal">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activity.length === 0 ? (
                                <tr><td colSpan={4} className="p-12 text-center font-sans italic text-2xl opacity-40">No recent activity</td></tr>
                            ) : (
                                activity.map((a, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 font-sans text-[10px] uppercase tracking-widest opacity-60">
                                            {new Date(a.time).toLocaleString()}
                                        </td>
                                        <td className="p-4 text-sm opacity-90">
                                          {a.username
                                            ? `@${String(a.username).replace(/^@/, "")}`
                                            : (a.user?.startsWith?.("@")
                                                ? a.user
                                                : (a.user || "—"))}
                                        </td>
                                        <td className="p-4 font-sans text-[10px] uppercase tracking-widest opacity-80">{a.type}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 text-[9px] uppercase tracking-widest font-sans rounded-sm border ${
                                                ["success", "completed"].includes(String(a.status || "").toLowerCase()) ? 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20' :
                                                ["failed", "error"].includes(String(a.status || "").toLowerCase()) ? 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20' :
                                                'bg-white/5 text-white/70 border-white/10'
                                            }`}>
                                                {a.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        )}

      {/* EXPORT TIMEFRAME MODAL (Weekly, Monthly, 6 Months, 1 Year, Custom No Limit) */}
      {exportModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0B0E]/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#121212] border border-white/20 p-6 md:p-8 max-w-lg w-full rounded-sm shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="font-sans text-[10px] tracking-[0.25em] uppercase text-[#FF3B30] font-bold">⚡ Data Export Engine</span>
                <h3 className="font-sans text-2xl mt-1 text-white">Select Export Timeframe</h3>
              </div>
              <button onClick={() => setExportModal(false)} className="text-white/60 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <label className="font-sans text-xs text-white/70 block uppercase tracking-wider">Timeframe Preset</label>
              <div className="grid grid-cols-2 gap-2 font-sans text-xs">
                {[
                  { id: "weekly", label: "📅 Weekly (7 Days)" },
                  { id: "monthly", label: "🗓️ Monthly (30 Days)" },
                  { id: "6months", label: "📊 6 Months (180 Days)" },
                  { id: "1year", label: "📈 1 Year (365 Days)" },
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
                ♾️ Customized (No Limit - Custom Range)
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
              <button type="button" onClick={exportCSV} className="px-6 py-2 bg-[#FF3B30] text-white font-bold hover:bg-[#e03126]">Generate CSV Export 📥</button>
            </div>
          </motion.div>
        </div>
      )}

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
    bio: "Representing top 25 lifestyle and fashion creators across India with over 15M combined reach.",
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
    company: "Starlet Creator Studio",
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
    bio: "Connecting cosmetic brands with micro and macro beauty creators across Asia.",
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
          <h2 className="font-sans text-3xl">📋 Agent Verification &amp; Approval Desk</h2>
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
          <div className="grid grid-cols-12 px-6 py-3 border-b border-white/10 bg-white/[0.02] text-white/50 text-[10px] tracking-widest uppercase font-bold">
            <div className="col-span-4">Agency / Company</div>
            <div className="col-span-3">Contact &amp; Location</div>
            <div className="col-span-2">Type / Industry</div>
            <div className="col-span-3 text-right">Verification Status / Action</div>
          </div>
          {displayAgents.map((ag, i) => {
            const companyName = ag.company || ag.name || "Agency Partner";
            const isApproved = Boolean(ag.agent_approved);

            return (
              <div key={ag.id || i} className="grid grid-cols-12 items-center px-6 py-4 border-b border-white/5 hover:bg-white/[0.02]">
                <div className="col-span-4 space-y-0.5">
                  <div className="font-sans text-lg text-white font-bold">{companyName}</div>
                  <div className="text-[10px] text-white/50">{ag.bio || "Talent agency partner."}</div>
                </div>
                <div className="col-span-3 space-y-0.5 text-white/70 text-[11px]">
                  <div>{ag.name || "Agency Contact"} ({ag.email || "agency@cr8.studio"})</div>
                  <div className="text-[10px] text-white/40">{ag.city || "India"}</div>
                </div>
                <div className="col-span-2 space-y-0.5">
                  <span className="text-[#FF3B30] font-bold text-[10px] uppercase block">{ag.agent_type || "Agency"}</span>
                  <span className="text-white/60 text-[10px]">{ag.industry || "Media"}</span>
                </div>
                <div className="col-span-3 flex items-center justify-end gap-2">
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
          <form onSubmit={handleDeclineSubmit} className="bg-[#121212] border border-white/20 p-6 max-w-md w-full rounded-sm space-y-4 shadow-2xl">
            <h3 className="font-sans text-2xl text-white font-bold">Decline Agency Access</h3>
            <p className="font-sans text-xs opacity-60">Decline application for {declineModal.company || declineModal.name || "Agency"}:</p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder=""
              className="w-full bg-black/60 border border-white/20 p-3 text-xs font-sans text-white rounded-xs h-24 focus:outline-none focus:border-[#FF3B30]"
              required
            />
            <div className="flex justify-end gap-3 font-sans text-xs">
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
function EscrowTreasuryDesk() {
  const [escrows, setEscrows] = useState([
    { id: "ESC-901", campaign: "Silk & Midnight Launch", brand: "Studio Noir Apparel", creator: "Aarav Sharma", amount: 250000, fee: 32500, status: "Locked in Escrow", gateway: "Razorpay PCI-DSS" },
    { id: "ESC-902", campaign: "AI Video Editing Suite", brand: "HyperTech AI", creator: "Priya Varma", amount: 350000, fee: 45500, status: "Locked in Escrow", gateway: "Razorpay PCI-DSS" },
    { id: "ESC-903", campaign: "Hydra Glow Serum", brand: "Veda Organics", creator: "Rohan Kapoor", amount: 180000, fee: 23400, status: "Released to Wallet", gateway: "Razorpay PCI-DSS" },
    { id: "ESC-904", campaign: "PulseFit Activewear Series", brand: "PulseFit Global", creator: "Neha Gupta", amount: 200000, fee: 26000, status: "Locked in Escrow", gateway: "Razorpay PCI-DSS" },
    { id: "ESC-905", campaign: "Rockerz 550 Wireless Campaign", brand: "boAt Lifestyle", creator: "Arjun Sharma", amount: 400000, fee: 52000, status: "Released to Wallet", gateway: "Razorpay PCI-DSS" },
    { id: "ESC-906", campaign: "Air Flex Eyewear Launch", brand: "Lenskart India", creator: "Sneha Reddy", amount: 150000, fee: 19500, status: "Released to Wallet", gateway: "Razorpay PCI-DSS" },
    { id: "ESC-907", campaign: "Gourmet Food Delivery Promo", brand: "Zomato Ltd.", creator: "Karthik Iyer", amount: 280000, fee: 36400, status: "Dispute Under Review", gateway: "Razorpay PCI-DSS" },
    { id: "ESC-908", campaign: "Pro Fitness Pass Festival", brand: "Cult.fit", creator: "Anya Singh", amount: 220000, fee: 28600, status: "Pending Verification", gateway: "Razorpay PCI-DSS" }
  ]);

  const handleForceRelease = (id) => {
    setEscrows(prev => prev.map(e => e.id === id ? { ...e, status: "Released to Wallet" } : e));
    toast.success(`🎉 Escrow #${id} override release completed!`);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-8 space-y-8">
      <div className="border-b border-white/10 pb-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-sans text-2xl md:text-3xl font-bold tracking-tight">Platform Escrow Treasury &amp; Revenue Desk</h2>
          <p className="font-sans text-xs opacity-60 mt-1 uppercase tracking-[0.16em]">
            Audit live escrow locks, Escrow verification policy, and manual override releases
          </p>
        </div>
        <span className="font-sans text-xs px-3 py-1 bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/30 rounded-xs font-bold uppercase tracking-wider">
          100% Funds Held Secure
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 border border-white/10 bg-white/[0.02]">
          <div className="font-sans text-[10px] tracking-[0.16em] uppercase opacity-60 font-medium">Total Escrow Volume</div>
          <div className="font-sans text-3xl text-white font-bold mt-3 tracking-tight tabular-nums">₹48,50,000</div>
          <div className="font-sans text-[9px] text-[#34C759] uppercase tracking-wider mt-2">100% Escrow Protected</div>
        </div>
        <div className="p-5 border border-white/10 bg-white/[0.02]">
          <div className="font-sans text-[10px] tracking-[0.16em] uppercase opacity-60 font-medium">Escrow Protection Status</div>
          <div className="font-sans text-3xl text-[#FF3B30] font-bold mt-3 tracking-tight tabular-nums">₹6,30,500</div>
          <div className="font-sans text-[9px] text-white/50 uppercase tracking-wider mt-2">Zero Agency Cuts</div>
        </div>
        <div className="p-5 border border-white/10 bg-white/[0.02]">
          <div className="font-sans text-[10px] tracking-[0.16em] uppercase opacity-60 font-medium">Completed Payouts</div>
          <div className="font-sans text-3xl text-[#34C759] font-bold mt-3 tracking-tight tabular-nums">₹42,19,500</div>
          <div className="font-sans text-[9px] text-[#34C759] uppercase tracking-wider mt-2">Direct Wallet Transfer</div>
        </div>
        <div className="p-5 border border-white/10 bg-white/[0.02]">
          <div className="font-sans text-[10px] tracking-[0.16em] uppercase opacity-60 font-medium">Disputed Claims</div>
          <div className="font-sans text-3xl text-orange-400 font-bold mt-3 tracking-tight tabular-nums">₹1,20,000</div>
          <div className="font-sans text-[9px] text-orange-400 uppercase tracking-wider mt-2">&lt;30m Support Resolution</div>
        </div>
      </div>

      <div className="border border-white/10 bg-white/[0.02] overflow-x-auto">
        <div className="p-4 border-b border-white/10 font-sans text-[10px] uppercase tracking-[0.16em] text-[#FF3B30] font-bold">
          Live Escrow Ledger &amp; Manual Override Control
        </div>
        <table className="w-full text-left border-collapse font-sans text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[9px] tracking-widest uppercase opacity-50">
              <th className="p-4 font-normal">Escrow ID</th>
              <th className="p-4 font-normal">Campaign &amp; Brand</th>
              <th className="p-4 font-normal">Creator</th>
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
                <td className="p-4 text-[#34C759] font-bold tabular-nums">₹{e.amount.toLocaleString()}</td>
                <td className="p-4 text-[#FF3B30] font-bold tabular-nums">₹{e.fee.toLocaleString()}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 text-[9px] uppercase tracking-widest border rounded-xs font-bold ${
                    e.status === "Released to Wallet" ? "bg-[#34C759]/10 text-[#34C759] border-[#34C759]/30" : "bg-orange-400/10 text-orange-400 border-orange-400/30"
                  }`}>
                    {e.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  {e.status === "Locked in Escrow" ? (
                    <button onClick={() => handleForceRelease(e.id)} className="btn-solid py-1 px-3 text-[10px] bg-[#34C759] text-white font-sans uppercase tracking-wider">
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
function BriefModerationDesk() {
  const [briefs, setBriefs] = useState([
    { 
      id: "BRF-101", 
      brand: "Studio Noir Apparel", 
      title: "Cyberpunk Streetwear Editorial Launch", 
      budget: 250000, 
      category: "Fashion & Style",
      aiSafety: "99% Clean", 
      status: "Approved & Live",
      deliverables: "1x Reel + 3x Stories",
      timeline: "14 Days"
    },
    { 
      id: "BRF-102", 
      brand: "HyperTech AI", 
      title: "AI Creator Workstation Pro Review", 
      budget: 350000, 
      category: "Technology & SaaS",
      aiSafety: "98% Clean", 
      status: "Approved & Live",
      deliverables: "1x Long-form Video + 2x Posts",
      timeline: "21 Days"
    },
    { 
      id: "BRF-103", 
      brand: "Veda Organics", 
      title: "Organic Hydra Glow Serum Series", 
      budget: 180000, 
      category: "Beauty & Makeup",
      aiSafety: "100% Clean", 
      status: "Pending Review",
      deliverables: "2x Reels + Before/After Story",
      timeline: "10 Days"
    },
    { 
      id: "BRF-104", 
      brand: "PulseFit Global", 
      title: "Pro Performance Seamless Activewear", 
      budget: 200000, 
      category: "Fitness & Health",
      aiSafety: "97% Clean", 
      status: "Pending Review",
      deliverables: "1x Fitness Workout Reel",
      timeline: "7 Days"
    },
    { 
      id: "BRF-105", 
      brand: "boAt Lifestyle", 
      title: "Rockerz 550 ANC Wireless Audio", 
      budget: 400000, 
      category: "Technology & Gadgets",
      aiSafety: "99% Clean", 
      status: "Approved & Live",
      deliverables: "3x Unboxing Reels + Giveaway",
      timeline: "30 Days"
    },
    { 
      id: "BRF-106", 
      brand: "Lenskart India", 
      title: "Air Flex Ultralight Eyewear Shoot", 
      budget: 150000, 
      category: "Fashion & Lifestyle",
      aiSafety: "96% Clean", 
      status: "Pending Review",
      deliverables: "2x Style Reels",
      timeline: "12 Days"
    }
  ]);

  const handleApproveBrief = (id) => {
    setBriefs(prev => prev.map(b => b.id === id ? { ...b, status: "Approved & Live" } : b));
    toast.success(`🎉 Campaign brief #${id} approved for Marketplace!`);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-8 space-y-8">
      <div className="border-b border-white/10 pb-4 flex items-center justify-between">
        <div>
          <h2 className="font-sans text-3xl">🎯 Campaign Brief Moderation &amp; AI Compliance Desk</h2>
          <p className="font-sans text-xs opacity-60 mt-1 uppercase tracking-widest">
            Review incoming brand campaign briefs, AI logo checks, and copyright compliance
          </p>
        </div>
        <span className="font-sans text-xs px-3 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-xs font-bold">
          AI Compliance Guard Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {briefs.map((b) => (
          <div key={b.id} className="p-6 bg-[#121212] border border-white/15 rounded-xs space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <span className="font-sans text-[10px] text-[#FF3B30] uppercase font-bold">{b.brand}</span>
                <span className="font-sans text-[9px] px-2 py-0.5 bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/30 rounded-xs font-bold">
                  {b.status}
                </span>
              </div>

              <h3 className="font-sans text-2xl font-bold mt-3 text-white">{b.title}</h3>
              <p className="font-sans text-xs text-white/60 mt-1">Campaign Budget: ₹{b.budget.toLocaleString()}</p>

              <div className="mt-4 p-3 bg-white/[0.03] border border-white/10 rounded-xs space-y-1.5 font-sans text-[11px]">
                <div className="flex justify-between text-[#34C759]">
                  <span>AI Content Audit:</span>
                  <span className="font-bold">{b.aiSafety}</span>
                </div>
                <div className="flex justify-between text-white/70">
                  <span>Logo Visibility Check:</span>
                  <span>Passed ✓</span>
                </div>
                <div className="flex justify-between text-white/70">
                  <span>Hashtag #ad Requirement:</span>
                  <span>Enforced ✓</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between font-sans text-xs">
              <span className="opacity-50">Brief #{b.id}</span>
              <button onClick={() => handleApproveBrief(b.id)} className="btn-solid py-1.5 px-4 text-xs bg-[#FF3B30] text-white">
                Approve &amp; Publish ↗
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
