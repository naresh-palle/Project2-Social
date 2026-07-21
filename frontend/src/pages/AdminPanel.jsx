import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Users, DollarSign, Activity, Bell, Search, Download, Calendar, ArrowUpRight, ArrowDownRight, Loader2, CheckCircle2, XCircle, Filter, Trash2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { motion } from "framer-motion";

const CATEGORIES = [
  "Fashion & Style", "Food & Cooking", "Beauty & Makeup", 
  "Technology & Gadgets", "Fitness & Health", "Lifestyle & Home",
  "Travel & Adventure", "Business & Entrepreneurship", 
  "Entertainment & Gaming", "Education & Learning", "Other"
];

function StatCard({ title, value, sub, icon, trend, pos }) {
    return (
        <div className="p-6 border border-white/10 bg-white/[0.02] relative overflow-hidden group">
            <div className="flex justify-between items-start">
                <div className="font-mono text-[10px] tracking-widest uppercase opacity-60">{title}</div>
                <div className="p-2 bg-white/5 rounded-sm">{icon}</div>
            </div>
            <div className="font-editorial text-4xl mt-4 mb-1">{value}</div>
            <div className="flex justify-between items-center mt-4">
                <div className="font-mono text-[9px] tracking-widest uppercase opacity-50">{sub}</div>
                <div className={`flex items-center gap-1 font-mono text-[10px] ${pos ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                    {pos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {trend}
                </div>
            </div>
        </div>
    );
}

export function AdminPanel() {
  const [tab, setTab] = useState("overview"); 
  
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [payments, setPayments] = useState([]);
  
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  
  const [loading, setLoading] = useState(true);
  
  const [roleFilter, setRoleFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const notifications = [
      { id: 1, text: "New creator '@zara_fashion' registered", time: "2 mins ago", type: "success" },
      { id: 2, text: "API Synchronization failed for YouTube", time: "1 hr ago", type: "error" },
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
          if (roleFilter) params.append("role", roleFilter);
          if (categoryFilter) params.append("category", categoryFilter);
          if (statusFilter) params.append("status", statusFilter);
          if (searchQuery) params.append("q", searchQuery);
          
          const { data } = await api.get(`/admin/users?${params.toString()}`);
          setUsersList(data);
      } catch (e) {
          toast.error("Failed to load users");
      } finally {
          setUsersLoading(false);
      }
  };

  useEffect(() => {
      if (tab === "users") fetchUsers();
  }, [tab, roleFilter, categoryFilter, statusFilter, searchQuery]);

  const deleteUser = async (userId) => {
      if (!window.confirm("Are you sure you want to permanently delete this user?")) return;
      try {
          await api.delete(`/admin/users/${userId}`);
          toast.success("User deleted successfully");
          fetchUsers();
          const stRes = await api.get("/admin/dashboard-stats");
          setStats(stRes.data);
      } catch (e) {
          toast.error("Failed to delete user");
      }
  };

  const exportCSV = () => {
      const data = tab === "users" ? usersList : [stats];
      if (!data || !data.length) return;
      const headers = Object.keys(data[0] || {}).join(",");
      const csv = [
          headers,
          ...data.map(row => Object.values(row || {}).map(v => `"${v}"`).join(","))
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cr8_export_${tab}_${new Date().toISOString()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Export successful");
  };

  if (loading) return (
      <div className="flex items-center justify-center py-20 text-[#F4F4F0]">
        <div className="animate-pulse font-mono tracking-widest text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Initializing Super Admin...
        </div>
      </div>
  );

  if (!stats) {
      return (
          <div className="flex flex-col items-center justify-center text-[#F4F4F0] py-20 text-center">
              <div className="font-editorial text-3xl text-[#FF3B30] mb-2">Studio Offline</div>
              <div className="font-mono text-xs opacity-60 max-w-md">The admin console could not retrieve secure data from the server. Please ensure the backend is running.</div>
              <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 border border-white/20 text-xs font-mono uppercase tracking-widest hover:bg-white/5 transition">Hard Refresh</button>
          </div>
      );
  }

  const revenueData = [
      { name: 'Jan', revenue: 10000, payments: 66000 },
      { name: 'Feb', revenue: 15000, payments: 100000 },
      { name: 'Mar', revenue: 22000, payments: 146000 },
      { name: 'Apr', revenue: 35000, payments: 233000 },
      { name: 'May', revenue: 42000, payments: 280000 },
      { name: 'Jun', revenue: stats?.financial?.revenue || 0, payments: stats?.financial?.total_payments || 0 }
  ];

  const platformData = [
      { name: 'Active', value: stats?.platform?.active_users || 0 },
      { name: 'Inactive', value: ((stats?.users?.creators || 0) + (stats?.users?.brands || 0)) - (stats?.platform?.active_users || 0) }
  ];
  const COLORS = ['#34C759', '#FF3B30'];

  return (
    <div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/10 pb-6">
            <div>
                <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 text-[#FF3B30]">Super Admin</p>
                <h1 className="font-editorial text-5xl md:text-6xl leading-none mt-2">Platform Console</h1>
                <div className="flex gap-6 mt-8 font-mono text-xs uppercase tracking-widest">
                    <button onClick={() => setTab("overview")} className={`pb-2 border-b-2 transition-colors ${tab === "overview" ? "border-[#FF3B30] text-[#FF3B30]" : "border-transparent opacity-60 hover:opacity-100"}`}>Overview</button>
                    <button onClick={() => setTab("users")} className={`pb-2 border-b-2 transition-colors ${tab === "users" ? "border-[#FF3B30] text-[#FF3B30]" : "border-transparent opacity-60 hover:opacity-100"}`}>User Management</button>
                    <button onClick={() => setTab("audit")} className={`pb-2 border-b-2 transition-colors ${tab === "audit" ? "border-[#FF3B30] text-[#FF3B30]" : "border-transparent opacity-60 hover:opacity-100"}`}>Audit Logs</button>
                </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                <button onClick={exportCSV} className="btn-outline border-white/20 hover:border-white px-4 py-2 flex items-center gap-2">
                    <Download className="w-4 h-4" /> Export {tab === "users" ? "Users" : "Data"}
                </button>
            </div>
        </div>

        {tab === "overview" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
                    <StatCard title="Total Users" value={(stats?.users?.creators || 0) + (stats?.users?.brands || 0) + (stats?.users?.agencies || 0)} sub={`${stats?.users?.creators || 0} Creators · ${stats?.users?.brands || 0} Brands`} icon={<Users className="w-5 h-5 text-blue-400" />} trend="+12%" pos={true} />
                    <StatCard title="Total Revenue" value={`₹${((stats?.financial?.revenue || 0) / 1000).toFixed(1)}K`} sub={`From ₹${((stats?.financial?.total_payments || 0) / 1000).toFixed(1)}K GMV`} icon={<DollarSign className="w-5 h-5 text-green-400" />} trend="+8%" pos={true} />
                    <StatCard title="Active Campaigns" value={stats?.campaigns?.active || 0} sub={`Out of ${stats?.campaigns?.total || 0} total`} icon={<Activity className="w-5 h-5 text-purple-400" />} trend="-2%" pos={false} />
                    <StatCard title="Pending Requests" value={(stats?.requests?.verification_requests || 0) + (stats?.requests?.creator_requests || 0)} sub={`${stats?.requests?.verification_requests || 0} verifications`} icon={<Bell className="w-5 h-5 text-orange-400" />} trend="+5%" pos={false} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                    <div className="lg:col-span-2 p-6 border border-white/10 bg-white/[0.02]">
                        <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-6">Revenue & GMV Growth</h3>
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
                        <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-6">Platform Activity</h3>
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
                        <div className="flex justify-center gap-6 mt-4 font-mono text-[10px] tracking-widest uppercase opacity-80">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#34C759]" /> Active</div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#FF3B30]" /> Inactive</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
                    <div className="lg:col-span-2 p-6 border border-white/10 bg-white/[0.02]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-60">Recent Payments</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10 font-mono text-[9px] tracking-widest uppercase opacity-50">
                                        <th className="p-3 font-normal">ID</th><th className="p-3 font-normal">Creator</th><th className="p-3 font-normal">Brand</th><th className="p-3 font-normal">Amount</th><th className="p-3 font-normal">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.slice(0, 5).map((p, i) => (
                                        <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                            <td className="p-3 font-mono text-xs opacity-60">#{p.id}</td>
                                            <td className="p-3 text-sm">{p.creator}</td>
                                            <td className="p-3 text-sm opacity-80">{p.brand}</td>
                                            <td className="p-3 font-mono text-sm text-[#FF3B30]">₹{(p.amount || 0).toLocaleString()}</td>
                                            <td className="p-3">
                                                <span className="px-2 py-1 text-[9px] uppercase tracking-widest font-mono bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20 rounded-sm">{p.status}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="p-6 border border-white/10 bg-white/[0.02]">
                            <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-6 flex items-center gap-2"><Bell className="w-3 h-3" /> System Alerts</h3>
                            <div className="space-y-4">
                                {notifications.map(n => (
                                    <div key={n.id} className="flex items-start gap-3">
                                        {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-[#34C759] shrink-0 mt-0.5" />}
                                        {n.type === 'error' && <XCircle className="w-4 h-4 text-[#FF3B30] shrink-0 mt-0.5" />}
                                        {n.type === 'warning' && <Activity className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />}
                                        <div>
                                            <p className="text-sm opacity-90 leading-snug">{n.text}</p>
                                            <p className="font-mono text-[9px] uppercase tracking-widest opacity-50 mt-1">{n.time}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-6 border border-white/10 bg-white/[0.02]">
                            <h3 className="font-mono text-[10px] tracking-widest uppercase opacity-60 mb-6">Recent Activity</h3>
                            <div className="space-y-4">
                                {activity.slice(0, 4).map((a, i) => (
                                    <div key={i} className="flex justify-between items-center border-b border-white/5 pb-4 last:border-0 last:pb-0">
                                        <div>
                                            <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">{a.type}</p>
                                            <p className="text-sm opacity-90 mt-1">{a.user} <span className="opacity-50">· {a.status}</span></p>
                                        </div>
                                        <div className="font-mono text-[9px] tracking-widest uppercase opacity-40">{new Date(a.time).toLocaleDateString()}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        )}

        {tab === "users" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-8">
                <div className="flex flex-wrap items-center gap-4 mb-6 p-4 border border-white/10 bg-white/[0.02]">
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <Search className="w-4 h-4 opacity-50" />
                        <input type="text" placeholder="Search users by name or email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-transparent border-none outline-none text-sm placeholder:opacity-50" />
                    </div>
                    <div className="h-6 w-px bg-white/10 hidden md:block" />
                    <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <Filter className="w-3 h-3 opacity-50" />
                            <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="bg-transparent outline-none cursor-pointer">
                                <option value="" className="bg-[#0A0A0A]">All Roles</option>
                                <option value="creator" className="bg-[#0A0A0A]">Creators</option>
                                <option value="brand" className="bg-[#0A0A0A]">Brands</option>
                                <option value="agency" className="bg-[#0A0A0A]">Agencies</option>
                            </select>
                        </div>
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-transparent outline-none cursor-pointer">
                            <option value="" className="bg-[#0A0A0A]">All Status</option>
                            <option value="active" className="bg-[#0A0A0A]">Active</option>
                            <option value="pending" className="bg-[#0A0A0A]">Pending</option>
                        </select>
                    </div>
                </div>
                <div className="border border-white/10 bg-white/[0.02] overflow-x-auto">
                    {usersLoading ? (
                        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin opacity-50" /></div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 font-mono text-[9px] tracking-widest uppercase opacity-50">
                                    <th className="p-4 font-normal">User</th><th className="p-4 font-normal">Role / Category</th><th className="p-4 font-normal">Joined</th><th className="p-4 font-normal">Status</th><th className="p-4 font-normal text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usersList.length === 0 ? (
                                    <tr><td colSpan={5} className="p-12 text-center font-editorial italic text-2xl opacity-40">No users found</td></tr>
                                ) : (
                                    usersList.map((u) => (
                                        <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                            <td className="p-4"><div className="font-editorial text-xl">{u.name}</div><div className="font-mono text-[10px] opacity-60 mt-1">{u.email}</div></td>
                                            <td className="p-4"><div className="font-mono text-[10px] uppercase tracking-widest text-[#FF3B30]">{u.role}</div><div className="text-xs opacity-60 mt-1">{u.category || "—"}</div></td>
                                            <td className="p-4 font-mono text-[10px] uppercase tracking-widest opacity-60">{new Date(u.created_at).toLocaleDateString()}</td>
                                            <td className="p-4">
                                                {u.onboarding_status === 'pending' ? <span className="px-2 py-1 text-[9px] uppercase tracking-widest font-mono bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-sm">Pending</span> : <span className="px-2 py-1 text-[9px] uppercase tracking-widest font-mono bg-[#34C759]/10 text-[#34C759] border border-[#34C759]/20 rounded-sm">Active</span>}
                                            </td>
                                            <td className="p-4 text-right"><button onClick={() => deleteUser(u.id)} className="p-2 opacity-50 hover:opacity-100 hover:text-[#FF3B30] transition-colors" title="Delete User"><Trash2 className="w-4 h-4" /></button></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </motion.div>
        )}

        {tab === "audit" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-8">
                <div className="border border-white/10 bg-white/[0.02] overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 font-mono text-[9px] tracking-widest uppercase opacity-50">
                                <th className="p-4 font-normal">Timestamp</th>
                                <th className="p-4 font-normal">User</th>
                                <th className="p-4 font-normal">Action Type</th>
                                <th className="p-4 font-normal">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activity.length === 0 ? (
                                <tr><td colSpan={4} className="p-12 text-center font-editorial italic text-2xl opacity-40">No recent activity</td></tr>
                            ) : (
                                activity.map((a, i) => (
                                    <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 font-mono text-[10px] uppercase tracking-widest opacity-60">
                                            {new Date(a.time).toLocaleString()}
                                        </td>
                                        <td className="p-4 text-sm opacity-90">{a.user}</td>
                                        <td className="p-4 font-mono text-[10px] uppercase tracking-widest opacity-80">{a.type}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 text-[9px] uppercase tracking-widest font-mono rounded-sm border ${
                                                a.status === 'success' ? 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20' :
                                                a.status === 'failed' ? 'bg-[#FF3B30]/10 text-[#FF3B30] border-[#FF3B30]/20' :
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
    </div>
  );
}
