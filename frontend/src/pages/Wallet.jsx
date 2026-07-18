import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
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

  const load = () => api.get("/wallet").then(r => setW(r.data));
  useEffect(() => { if (user) load(); }, [user]);

  const doTx = async (kind) => {
    setBusy(true);
    try {
      await api.post(`/wallet/${kind}`, { amount: Number(amount) });
      toast.success(`${kind} recorded.`);
      setAmount("");
      await load();
      await refresh();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || "Failed");
    } finally { setBusy(false); }
  };

  if (!user) return null;
  const isOwner = user.role === "owner";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      <Toaster theme="dark" position="top-center" />
      <div className="pt-28 max-w-[1200px] mx-auto px-6 md:px-10 pb-24">
        <div className="hairline-b pb-6 flex items-baseline justify-between">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">§ Ledger</p>
            <h1 className="font-editorial text-6xl md:text-7xl leading-none mt-2">Wallet<span className="tick">.</span></h1>
          </div>
          <Link to="/dashboard" className="font-mono text-[11px] tracking-[0.28em] uppercase kinetic-underline">← Dashboard</Link>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9 }}
          className="mt-10 grid grid-cols-12 gap-6">
          <div className="col-span-12 md:col-span-7 hairline-t hairline-b hairline-l hairline-r p-10">
            <div className="font-mono text-[10px] tracking-[0.28em] uppercase opacity-60">Available balance</div>
            <div className="font-editorial text-[10rem] leading-[0.9] mt-2 italic">
              ${w.balance.toLocaleString()}
              <span className="tick">.</span>
            </div>
            <div className="mt-6 font-mono text-[10px] tracking-[0.2em] uppercase opacity-50">
              All balances are recorded in USD · mock escrow
            </div>
          </div>
          <div className="col-span-12 md:col-span-5 hairline-t hairline-b hairline-l hairline-r p-8">
            <div className="font-mono text-[10px] tracking-[0.28em] uppercase opacity-60">
              {isOwner ? "Add funds (mock deposit)" : "Withdraw (mock payout)"}
            </div>
            <input type="number" data-testid="wallet-amount" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="Amount USD"
              className="mt-4 w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] text-3xl font-editorial italic" />
            <button data-testid="wallet-submit" disabled={busy || !amount}
              onClick={() => doTx(isOwner ? "deposit" : "withdraw")}
              className="btn-solid mt-6 w-full justify-center">
              {isOwner ? <>Deposit <ArrowDownRight className="w-4 h-4" /></> : <>Withdraw <ArrowUpRight className="w-4 h-4" /></>}
            </button>
          </div>
        </motion.div>

        <h2 className="font-mono text-[10px] tracking-[0.28em] uppercase opacity-60 mt-16 mb-6">
          § Transactions ({w.transactions.length})
        </h2>
        <div>
          {w.transactions.length === 0 ? (
            <div className="py-16 text-center font-editorial italic text-3xl opacity-40">No transactions yet.</div>
          ) : w.transactions.map(t => (
            <div key={t.id} className="hairline-b py-4 grid grid-cols-12 gap-4" data-testid={`tx-${t.id}`}>
              <div className="col-span-2 font-mono text-[10px] tracking-[0.25em] uppercase opacity-60">
                {new Date(t.created_at).toLocaleDateString()}
              </div>
              <div className="col-span-3 font-mono text-[11px] tracking-[0.22em] uppercase">{t.kind}</div>
              <div className="col-span-5 opacity-80 text-sm">{t.note}</div>
              <div className={`col-span-2 text-right font-editorial italic text-2xl ${t.amount >= 0 ? "text-[#FF3B30]" : ""}`}>
                {t.amount >= 0 ? "+" : ""}${t.amount.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
