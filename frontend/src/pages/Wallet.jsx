import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Search, Wallet as WalletIcon, TrendingUp, TrendingDown, ArrowLeft } from "lucide-react";
import { Nav } from "@/components/Nav";

import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { ThemeToaster } from "@/components/ThemeToaster";

export default function Wallet() {
  const { user, refresh } = useAuth();
  const [w, setW] = useState({ balance: 0, transactions: [] });
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const load = () => api.get("/wallet").then((r) => setW(r.data)).catch(() => {});
  useEffect(() => {
    if (user) load();
  }, [user]);

  const doTx = async (kind) => {
    setBusy(true);
    try {
      await api.post(`/wallet/${kind}`, { amount: Number(amount) });
      toast.success(`${kind === "deposit" ? "Deposit" : "Withdrawal"} of ₹${Number(amount).toLocaleString()} recorded.`);
      setAmount("");
      await load();
      await refresh();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Transaction failed");
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;
  const isOwner = user.role === "owner";

  const transactions = w.transactions || [];
  const totalIncome = transactions.filter((t) => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
  const totalWithdrawn = Math.abs(transactions.filter((t) => t.amount < 0).reduce((acc, t) => acc + t.amount, 0));

  const filteredTx = transactions.filter((t) => {
    const matchesSearch =
      (t.note || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.kind || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.id || "").toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterType === "income") return t.amount > 0;
    if (filterType === "withdrawal") return t.amount < 0;
    if (filterType === "escrow") return (t.kind || "").toLowerCase().includes("escrow");
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0]" data-testid="wallet-page">
      <Nav />
      <ThemeToaster />

      <div className="pt-24 max-w-5xl mx-auto px-4 md:px-6 pb-16">
        <div className="pb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
          <div>
            <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight">Wallet</h1>
            <p className="font-sans text-xs opacity-50 mt-1">Balance &amp; transactions</p>
          </div>
          <Link to="/dashboard" className="font-sans text-xs uppercase tracking-widest opacity-60 hover:opacity-100 inline-flex items-center gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          <div className="border border-white/10 bg-white/[0.02] p-4 rounded-sm">
            <div className="flex items-center justify-between">
              <span className="font-sans text-[11px] uppercase tracking-wider opacity-55">Balance</span>
              <WalletIcon className="w-4 h-4 text-[#FF3B30]" />
            </div>
            <div className="font-sans text-2xl font-bold mt-2 tabular-nums">₹{Number(w.balance || 0).toLocaleString()}</div>
          </div>
          <div className="border border-white/10 bg-white/[0.02] p-4 rounded-sm">
            <div className="flex items-center justify-between">
              <span className="font-sans text-[11px] uppercase tracking-wider opacity-55">Income</span>
              <TrendingUp className="w-4 h-4 text-[#34C759]" />
            </div>
            <div className="font-sans text-2xl font-bold mt-2 text-[#34C759] tabular-nums">+₹{totalIncome.toLocaleString()}</div>
          </div>
          <div className="border border-white/10 bg-white/[0.02] p-4 rounded-sm">
            <div className="flex items-center justify-between">
              <span className="font-sans text-[11px] uppercase tracking-wider opacity-55">Withdrawn</span>
              <TrendingDown className="w-4 h-4 text-[#FF9500]" />
            </div>
            <div className="font-sans text-2xl font-bold mt-2 tabular-nums">-₹{totalWithdrawn.toLocaleString()}</div>
          </div>
        </div>

        <div className="mt-5 border border-white/10 bg-white/[0.02] p-4 rounded-sm grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-7">
            <div className="font-sans text-[11px] uppercase tracking-wider text-[#FF3B30]">
              {isOwner ? "Deposit" : "Withdraw"}
            </div>
            <p className="font-sans text-sm opacity-70 mt-1">
              {isOwner ? "Add funds for campaign escrow." : "Send earnings to your linked account."}
            </p>
          </div>
          <div className="md:col-span-5 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-sans text-sm opacity-50">₹</span>
              <input
                type="number"
                data-testid="wallet-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                className="w-full bg-transparent border border-white/15 focus:border-[#FF3B30] outline-none rounded-sm pl-7 pr-3 py-2 font-sans text-sm"
              />
            </div>
            <button
              data-testid="wallet-submit"
              disabled={busy || !amount || Number(amount) <= 0}
              onClick={() => doTx(isOwner ? "deposit" : "withdraw")}
              className="inline-flex items-center justify-center gap-1.5 bg-[#FF3B30] text-white rounded-sm px-4 py-2 font-sans text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
            >
              {isOwner ? (
                <>
                  Deposit <ArrowDownRight className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  Withdraw <ArrowUpRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-sans text-sm font-semibold">Transactions ({filteredTx.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border border-white/15 text-xs font-sans pl-8 pr-3 py-1.5 focus:outline-none focus:border-[#FF3B30] rounded-sm w-40"
              />
            </div>
            <div className="flex items-center gap-1 border border-white/15 p-0.5 rounded-sm font-sans text-[10px] uppercase tracking-wider">
              {[
                ["all", "All"],
                ["income", "Income"],
                ["withdrawal", "Out"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilterType(id)}
                  className={`px-2.5 py-1 rounded-xs transition-colors ${
                    filterType === id ? "bg-[#FF3B30] text-white" : "opacity-60 hover:opacity-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 border border-white/10 rounded-sm overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 font-sans text-[10px] uppercase tracking-wider opacity-50 bg-white/[0.02]">
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Note</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredTx.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center font-sans text-sm opacity-40">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filteredTx.map((t) => (
                  <tr key={t.id} className="border-b border-white/5 hover:bg-white/[0.02]" data-testid={`tx-${t.id}`}>
                    <td className="px-3 py-2.5 font-sans text-xs opacity-60 whitespace-nowrap">
                      {new Date(t.created_at || Date.now()).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2.5 font-sans text-xs text-[#FF3B30]">{t.kind || "Transaction"}</td>
                    <td className="px-3 py-2.5 font-sans text-sm opacity-80 max-w-[220px] truncate">
                      {t.note || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-1.5 py-0.5 text-[10px] uppercase font-sans rounded-sm border bg-[#34C759]/10 text-[#34C759] border-[#34C759]/20">
                        Done
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-sans text-sm font-semibold tabular-nums ${
                        t.amount >= 0 ? "text-[#34C759]" : "opacity-80"
                      }`}
                    >
                      {t.amount >= 0 ? "+" : "-"}₹{Math.abs(t.amount).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
