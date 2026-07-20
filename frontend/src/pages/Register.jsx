import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth";

const PLATFORMS = ["Instagram", "YouTube", "Facebook", "X (Twitter)", "LinkedIn", "Snapchat", "Moj", "Josh", "ShareChat", "Chingari"];

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [role, setRole] = useState(sp.get("role") === "owner" ? "owner" : "influencer");
  const [form, setForm] = useState({ email: "", password: "", name: "", platform: "Instagram", handle: "", company: "", mobile: "", pincode: "" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const r = sp.get("role");
    if (r === "owner" || r === "influencer") setRole(r);
  }, [sp]);

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const payload = { ...form, role };
    if (role === "owner") { delete payload.handle; delete payload.platform; }
    if (role === "influencer") delete payload.company;
    const r = await register(payload);
    setLoading(false);
    if (r.ok) nav("/dashboard");
    else setErr(r.error);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-5 pt-20">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="relative overflow-hidden hidden md:block md:col-span-2 hairline-r"
        >
          <img
            src="https://images.pexels.com/photos/35458193/pexels-photo-35458193.jpeg"
            alt="Studio"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[#0A0A0A]/50" />
          <div className="absolute bottom-10 left-10 right-10">
            <p className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-70">
              Vol. 08 · Winter Edition
            </p>
            <h2 className="font-editorial text-5xl italic mt-4 leading-none">
              Two doors.<br />
              One studio.
            </h2>
          </div>
        </motion.div>

        <div className="md:col-span-3 flex items-center justify-center px-6 md:px-20 py-14">
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            onSubmit={submit}
            className="w-full max-w-lg"
            data-testid="register-form"
          >
            <p className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
              § Enter the studio
            </p>
            <h1 className="font-editorial text-5xl md:text-6xl mt-3 leading-none">
              Choose your <span className="italic">door.</span>
            </h1>

            {/* Role selector */}
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                { k: "owner", label: "I'm an Owner", sub: "Brand · House" },
                { k: "influencer", label: "I'm a Creator", sub: "Editor · Voice" },
                { k: "agent", label: "I'm an Agent", sub: "Talent · Scout" }
              ].map((r) => (
                <button
                  type="button"
                  key={r.k}
                  onClick={() => setRole(r.k)}
                  data-testid={`role-${r.k}`}
                  className={`text-left p-4 hairline-b hairline-t hairline-l hairline-r transition-colors duration-300 ${
                    role === r.k ? "bg-[#FF3B30] text-[#F4F4F0] border-[#FF3B30]" : "hover:bg-white/5"
                  }`}
                >
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase opacity-70">
                    {r.k === "owner" ? "01" : r.k === "influencer" ? "02" : "03"}
                  </div>
                  <div className="font-editorial text-xl mt-1">{r.label}</div>
                  <div className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-60 mt-1">
                    {r.sub}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
              <Field label="Full name" testid="reg-name" value={form.name} onChange={change("name")} placeholder="Your name" required />
              {role === "influencer" ? (
                <div>
                  <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">Primary Platform & Handle</label>
                  <div className="flex items-center gap-2 mt-2">
                    <select 
                      value={form.platform} 
                      onChange={change("platform")}
                      className="bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] text-lg font-mono w-1/3"
                    >
                      {PLATFORMS.map(p => <option key={p} className="bg-black text-[#F4F4F0]">{p}</option>)}
                    </select>
                    <input
                      data-testid="reg-handle"
                      value={form.handle}
                      onChange={change("handle")}
                      placeholder="@yourhandle"
                      className="w-2/3 bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] text-lg"
                    />
                  </div>
                </div>
              ) : (
                <Field label="Brand / Company" testid="reg-company" value={form.company} onChange={change("company")} placeholder="Company name" />
              )}
              <Field label="Email" testid="reg-email" value={form.email} onChange={change("email")} placeholder="you@studio.com" type="email" required />
              <Field label="Mobile Number" testid="reg-mobile" value={form.mobile} onChange={change("mobile")} placeholder="9876543210" required />
              <Field label="Pincode (India)" testid="reg-pincode" value={form.pincode} onChange={change("pincode")} placeholder="6 digits" required />
              <Field label="Password" testid="reg-password" value={form.password} onChange={change("password")} placeholder="min. 6 chars" type="password" required />
            </div>

            {err && (
              <p data-testid="register-error" className="mt-6 text-[#FF3B30] font-mono text-xs tracking-widest uppercase">
                {err}
              </p>
            )}

            <button
              data-testid="register-submit"
              disabled={loading}
              className="btn-solid mt-8 w-full justify-center"
            >
              {loading ? "Opening the door…" : <>Enter the studio <ArrowRight className="w-4 h-4" /></>}
            </button>

            <p className="mt-6 font-mono text-[11px] tracking-[0.2em] uppercase opacity-60">
              Already inside?{" "}
              <Link to="/login" className="kinetic-underline text-[#FF3B30]" data-testid="link-to-login">
                Sign in →
              </Link>
            </p>
          </motion.form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, testid, ...props }) {
  return (
    <div>
      <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
        {label}
      </label>
      <input
        data-testid={testid}
        {...props}
        className="mt-2 w-full bg-transparent hairline-b py-3 focus:outline-none focus:border-[#FF3B30] text-lg"
      />
    </div>
  );
}
