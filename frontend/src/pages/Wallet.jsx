import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Search, Filter, Wallet as WalletIcon, TrendingUp, TrendingDown, ArrowLeft } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { toast, Toaster } from "sonner";

export default function Wallet() {
  const { user, refresh } = useAuth();
  const [w, setW] = useState({ balance: 0, transactions: [] });
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [filterType, setFilterType] = useState("all"); // 'all' | 'income' | 'withdrawal' | 'escrow'
  const [searchQuery, setSearchQuery] = useState("");

  const load = () => api.get("/wallet").then(r => setW(r.data)).catch(() => {});
  useEffect(() => { if (user) load(); }, [user]);

  const doTx = async (kind) => {
    setBusy(true);
    try {
      await api.post(`/wallet/${kind}`, { amount: Number(amount) });
      toast.success(`${kind === 'deposit' ? 'Deposit' : 'Withdrawal'} of ₹${Number(amount).toLocaleString()} recorded.`);
      setAmount("");
      await load();
      await refresh();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Transaction failed");
    } finally { setBusy(false); }
  };

  if (!user) return null;
  const isOwner = user.role === "owner";

  // Calculate financial totals
  const transactions = w.transactions || [];
  const totalIncome = transactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
  const totalWithdrawn = Math.abs(transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + t.amount, 0));

  // Filter transactions
  const filteredTx = transactions.filter(t => {
    const matchesSearch = (t.note || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (t.kind || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (t.id || "").toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (filterType === "income") return t.amount > 0;
    if (filterType === "withdrawal") return t.amount < 0;
    if (filterType === "escrow") return (t.kind || "").toLowerCase().includes("escrow");
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]" data-testid="wallet-page">
      <div className="grain" />
      <Nav />
      <Toaster theme="dark" position="top-center" />
      
      <div className="pt-28 max-w-[1400px] mx-auto px-6 md:px-10 pb-24">
        {/* Header */}
        <div className="hairline-b pb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ Financial Ledger</p>
            <h1 className="font-editorial text-6xl md:text-7xl leading-[1.15] mt-2">
              Wallet Vault<span className="tick">.</span>
            </h1>
          </div>
          <Link to="/dashboard" className="font-mono text-[11px] tracking-[0.28em] uppercase kinetic-underline flex items-center gap-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
        </div>

        {/* Financial Stat Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="hairline-t hairline-b hairline-l hairline-r p-8 bg-[#0D0D0D]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.28em] uppercase opacity-60">Available Balance</span>
              <WalletIcon className="w-5 h-5 text-[#FF3B30]" />
            </div>
            <div className="font-editorial italic text-5xl md:text-6xl leading-[1.1] mt-4 text-[#F4F4F0]">
              ₹{w.balance.toLocaleString()}
            </div>
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-50 mt-3">
              Recorded in INR · Real-time ledger
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="hairline-t hairline-b hairline-l hairline-r p-8 bg-[#0D0D0D]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.28em] uppercase opacity-60">Total Income / Deposited</span>
              <TrendingUp className="w-5 h-5 text-[#34C759]" />
            </div>
            <div className="font-editorial italic text-5xl md:text-6xl leading-[1.1] mt-4 text-[#34C759]">
              +₹{totalIncome.toLocaleString()}
            </div>
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-50 mt-3">
              Total cumulative inflows
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="hairline-t hairline-b hairline-l hairline-r p-8 bg-[#0D0D0D]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.28em] uppercase opacity-60">Total Withdrawn / Payouts</span>
              <TrendingDown className="w-5 h-5 text-[#FF9500]" />
            </div>
            <div className="font-editorial italic text-5xl md:text-6xl leading-[1.1] mt-4 text-[#F4F4F0]/90">
              -₹{totalWithdrawn.toLocaleString()}
            </div>
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-50 mt-3">
              Released &amp; withdrawn payouts
            </div>
          </motion.div>
        </div>

        {/* Deposit / Withdraw Action Box */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-8 hairline-t hairline-b hairline-l hairline-r p-8 bg-[#121212] grid grid-cols-12 gap-6 items-center">
          <div className="col-span-12 md:col-span-7">
            <div className="font-mono text-[11px] tracking-[0.28em] uppercase text-[#FF3B30]">
              {isOwner ? "Deposit Funds (Escrow Account)" : "Payout Request (Bank Transfer)"}
            </div>
            <h3 className="font-editorial text-3xl md:text-4xl mt-2 leading-tight">
              {isOwner ? "Add funds to your campaign vault." : "Withdraw earnings to your registered account."}
            </h3>
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] opacity-60 mt-2">
              Instant mock execution · Funds are secured in smart escrow contracts.
            </p>
          </div>

          <div className="col-span-12 md:col-span-5 flex flex-col gap-3">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-editorial italic text-2xl opacity-60">₹</span>
              <input 
                type="number" 
                data-testid="wallet-amount" 
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                placeholder="Enter amount in INR"
                className="w-full bg-black/40 hairline-b pl-9 pr-4 py-3 focus:outline-none focus:border-[#FF3B30] text-2xl font-editorial italic" 
              />
            </div>
            <div className="flex gap-3">
              <button 
                data-testid="wallet-submit" 
                disabled={busy || !amount || Number(amount) <= 0}
                onClick={() => doTx(isOwner ? "deposit" : "withdraw")}
                className="btn-solid flex-1 justify-center py-3 text-xs uppercase tracking-[0.2em]"
              >
                {isOwner ? (
                  <>Deposit INR <ArrowDownRight className="w-4 h-4" /></>
                ) : (
                  <>Withdraw INR <ArrowUpRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Transactions Table Header & Filters */}
        <div className="mt-16 flex flex-col md:flex-row md:items-center justify-between gap-4 hairline-b pb-6">
          <div>
            <h2 className="font-mono text-[11px] tracking-[0.28em] uppercase opacity-70">
              § Transaction History ({filteredTx.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-white/[0.03] border border-white/10 text-xs font-mono pl-9 pr-3 py-1.5 focus:outline-none focus:border-[#FF3B30] rounded-sm w-48 md:w-64"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 p-1 rounded-sm font-mono text-[10px] uppercase tracking-[0.15em]">
              <button
                onClick={() => setFilterType("all")}
                className={`px-3 py-1 rounded-xs transition-colors ${filterType === "all" ? "bg-[#FF3B30] text-white" : "opacity-60 hover:opacity-100"}`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType("income")}
                className={`px-3 py-1 rounded-xs transition-colors ${filterType === "income" ? "bg-[#34C759] text-black font-bold" : "opacity-60 hover:opacity-100"}`}
              >
                Income
              </button>
              <button
                onClick={() => setFilterType("withdrawal")}
                className={`px-3 py-1 rounded-xs transition-colors ${filterType === "withdrawal" ? "bg-[#FF9500] text-black font-bold" : "opacity-60 hover:opacity-100"}`}
              >
                Withdrawals
              </button>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="mt-6 border border-white/10 bg-white/[0.01] overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 font-mono text-[9px] tracking-widest uppercase opacity-50 bg-white/[0.02]">
                <th className="p-4 font-normal">Date &amp; Time</th>
                <th className="p-4 font-normal">Type / Kind</th>
                <th className="p-4 font-normal">Description / Note</th>
                <th className="p-4 font-normal">Status</th>
                <th className="p-4 font-normal text-right">Amount (INR ₹)</th>
              </tr>
            </thead>
            <tbody>
              {filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-16 text-center font-editorial italic text-2xl opacity-40">
                    No matching transactions on file.
                  </td>
                </tr>
              ) : (
                filteredTx.map(t => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors" data-testid={`tx-${t.id}`}>
                    <td className="p-4 font-mono text-[10px] uppercase tracking-widest opacity-60">
                      {new Date(t.created_at || Date.now()).toLocaleString()}
                    </td>
                    <td className="p-4 font-mono text-[10px] uppercase tracking-widest text-[#FF3B30]">
                      {t.kind || "Transaction"}
                    </td>
                    <td className="p-4 text-sm opacity-90 max-w-xs truncate">
                      {t.note || "Platform ledger settlement"}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 text-[9px] uppercase tracking-widest font-mono rounded-sm border bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20">
                        Completed
                      </span>
                    </td>
                    <td className={`p-4 text-right font-editorial italic text-2xl ${t.amount >= 0 ? "text-[#34C759]" : "text-[#F4F4F0]/80"}`}>
                      {t.amount >= 0 ? "+" : "-"}₹{Math.abs(t.amount).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Footer />
    </div>
  );
}
