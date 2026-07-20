import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Trash2 } from "lucide-react";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { toast, Toaster } from "sonner";

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [camps, setCamps] = useState([]);

  const load = async () => {
    if (user?.role !== "admin") return;
    const [u, c] = await Promise.all([api.get("/admin/users"), api.get("/admin/campaigns")]);
    setUsers(u.data);
    setCamps(c.data);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (user && user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0] pt-40 px-10">
        <Nav />
        <h1 className="font-editorial italic text-5xl">Admins only.</h1>
      </div>
    );
  }

  const verify = async (id) => {
    try { await api.post(`/admin/users/${id}/verify`); toast.success("Verified"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const approveAgent = async (id) => {
    try { await api.post(`/admin/approve-agent/${id}`); toast.success("Agent Approved"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };
  const del = async (id) => {
    try { await api.delete(`/admin/campaigns/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(formatApiError(e.response?.data?.detail)); }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      <Toaster theme="dark" position="top-center" />
      <div className="pt-28 max-w-[1600px] mx-auto px-6 md:px-10 pb-24">
        <div className="hairline-b pb-6">
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ Admin console</p>
          <h1 className="font-editorial text-6xl md:text-7xl leading-none mt-2">
            The <span className="italic">register</span><span className="tick">.</span>
          </h1>
        </div>

        <div className="flex gap-8 mt-6 font-mono text-[11px] tracking-[0.28em] uppercase">
          {["users", "campaigns"].map(t => (
            <button key={t} onClick={() => setTab(t)} data-testid={`admin-tab-${t}`}
              className={`kinetic-underline ${tab === t ? "text-[#FF3B30]" : "opacity-60"}`}>
              {t === "users" ? `Users · ${users.length}` : `Campaigns · ${camps.length}`}
            </button>
          ))}
        </div>

        {tab === "users" ? (
          <div className="mt-8 space-y-2">
            {users.map((u, i) => (
              <motion.div key={u.id} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.02 }}
                data-testid={`admin-user-${u.id}`}
                className="hairline-b py-4 grid grid-cols-12 gap-4 items-baseline">
                <div className="col-span-1 font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="col-span-3">
                  <div className="font-editorial text-2xl">{u.name}</div>
                  <div className="font-mono text-[10px] tracking-[0.22em] uppercase opacity-60">
                    {u.handle || u.company}
                  </div>
                </div>
                <div className="col-span-3 font-mono text-[11px] opacity-70">{u.email}</div>
                <div className="col-span-2 font-mono text-[10px] tracking-[0.25em] uppercase">
                  <span className={u.role === "admin" ? "text-[#FF3B30]" : "opacity-80"}>{u.role}</span>
                </div>
                <div className="col-span-2 font-mono text-[10px] tracking-[0.25em] uppercase">
                  {u.verified ? <span className="text-[#FF3B30]">✓ verified</span> : <span className="opacity-60">unverified</span>}
                </div>
                <div className="col-span-2 text-right flex gap-2 justify-end">
                  {!u.verified && (
                    <button onClick={() => verify(u.id)} data-testid={`admin-verify-${u.id}`}
                      className="btn-pill text-[10px]"><Shield className="w-3 h-3" /></button>
                  )}
                  {u.role === "agent" && !u.agent_approved && (
                    <button onClick={() => approveAgent(u.id)} data-testid={`admin-approve-agent-${u.id}`}
                      className="btn-pill text-[10px] border-[#FF3B30] text-[#FF3B30]">Approve</button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="mt-8 space-y-2">
            {camps.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.02 }}
                data-testid={`admin-camp-${c.id}`}
                className="hairline-b py-4 grid grid-cols-12 gap-4 items-baseline">
                <div className="col-span-1 font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="col-span-5">
                  <div className="font-mono text-[10px] tracking-[0.22em] uppercase opacity-60">{c.brand}</div>
                  <Link to={`/campaigns/${c.id}`} className="font-editorial text-2xl kinetic-underline">{c.title}</Link>
                </div>
                <div className="col-span-2 font-mono text-[11px] tracking-[0.22em] uppercase opacity-70">${c.budget}</div>
                <div className="col-span-2 font-mono text-[10px] tracking-[0.25em] uppercase">
                  <span className={c.status === "completed" ? "text-[#FF3B30]" : "opacity-80"}>{c.status}</span>
                </div>
                <div className="col-span-2 text-right">
                  <button onClick={() => del(c.id)} data-testid={`admin-delete-${c.id}`} className="btn-pill text-[10px]">
                    <Trash2 className="w-3 h-3" /> Remove
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
