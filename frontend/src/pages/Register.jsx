import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const { role: urlRole } = useParams();
  
  // Enforce valid roles
  const role = ["owner", "influencer", "agent"].includes(urlRole) ? urlRole : "influencer";

  const [form, setForm] = useState({ 
    email: "", username: "", password: "", firstName: "", lastName: "", 
    company: "", mobile: "", pincode: "", city: "", state: "", otp: "" 
  });
  const [err, setErr] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");

  const [emailStatus, setEmailStatus] = useState("typing"); // typing, checking, available, taken
  const [mobileStatus, setMobileStatus] = useState("typing");

  // Prevent data leakage / "cache saving" when switching between categories
  useEffect(() => {
    setForm({ 
      email: "", username: "", password: "", firstName: "", lastName: "", 
      company: "", mobile: "", pincode: "", city: "", state: "", otp: "" 
    });
    setFieldErrors({});
    setErr("");
    setEmailStatus("typing");
    setMobileStatus("typing");
  }, [urlRole]);

  // Format label based on role
  const roleLabel = role === "owner" ? "an Owner" : role === "agent" ? "an Agent" : "a Creator";

  // Debounced Validation for Email
  useEffect(() => {
    const checkEmail = async () => {
      if (!/^\\S+@\\S+\\.\\S+$/.test(form.email)) {
        setEmailStatus("typing");
        return;
      }
      setEmailStatus("checking");
      try {
        const res = await api.post("/auth/check", { email: form.email });
        setEmailStatus(res.data.available ? "available" : "taken");
        if (!res.data.available) setFieldErrors(e => ({ ...e, email: "Email already registered" }));
        else setFieldErrors(e => ({ ...e, email: "" }));
      } catch (e) {
        setEmailStatus("typing");
      }
    };
    const to = setTimeout(checkEmail, 600);
    return () => clearTimeout(to);
  }, [form.email]);

  // Debounced Validation for Mobile
  useEffect(() => {
    const checkMobile = async () => {
      if (!/^[6-9]\d{9}$/.test(form.mobile)) {
        setMobileStatus("typing");
        return;
      }
      setMobileStatus("checking");
      try {
        const res = await api.post("/auth/check", { mobile: form.mobile });
        setMobileStatus(res.data.available ? "available" : "taken");
        if (!res.data.available) setFieldErrors(e => ({ ...e, mobile: "Mobile already registered" }));
        else setFieldErrors(e => ({ ...e, mobile: "" }));
      } catch (e) {
        setMobileStatus("typing");
      }
    };
    const to = setTimeout(checkMobile, 600);
    return () => clearTimeout(to);
  }, [form.mobile]);

  // Pincode
  useEffect(() => {
    if (form.pincode.length === 6) {
      fetch(`https://api.zippopotam.us/in/${form.pincode}`)
        .then(res => {
          if (!res.ok) throw new Error("Invalid pincode");
          return res.json();
        })
        .then(data => {
          if (data && data.places && data.places.length > 0) {
            const po = data.places[0];
            setForm(f => ({ ...f, city: po["place name"], state: po["state"] }));
          } else {
            setForm(f => ({ ...f, city: "", state: "" }));
          }
        }).catch(() => { setForm(f => ({ ...f, city: "", state: "" })); });
    } else {
      setForm(f => ({ ...f, city: "", state: "" }));
    }
  }, [form.pincode]);

  const change = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const validateForm = () => {
    let errs = {};
    if (!form.firstName.trim() || /[^a-zA-Z\s]/.test(form.firstName)) errs.firstName = "Letters only";
    if (!form.lastName.trim() || /[^a-zA-Z\s]/.test(form.lastName)) errs.lastName = "Letters only";
    if (!/^[a-zA-Z0-9_]{3,}$/.test(form.username)) errs.username = "Min. 3 chars, no spaces";
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = "Invalid email";
    if (emailStatus === "taken") errs.email = "Email already registered";
    if (!/^[6-9]\d{9}$/.test(form.mobile)) errs.mobile = "Invalid Indian mobile number";
    if (mobileStatus === "taken") errs.mobile = "Mobile already registered";
    if (!/^\d{6}$/.test(form.pincode)) errs.pincode = "Must be 6 digits";
    if (form.pincode.length === 6 && !form.city) errs.pincode = "Invalid Pincode";
    if (!/^(?=.*[a-zA-Z])(?=.*[0-9]).{8,}$/.test(form.password)) errs.password = "Min. 8 chars, alphanumeric";
    if ((role === "owner" || role === "agent") && !form.company.trim()) errs.company = "Required";
    return errs;
  };

  const handleInitialSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    
    const errs = validateForm();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    // Trigger OTP Send
    setLoading(true);
    try {
      await api.post("/auth/send-otp", { email: form.email, mobile: form.mobile });
      setShowOtpModal(true);
    } catch (e) {
      setErr(e.response?.data?.detail || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  const verifyAndRegister = async (e) => {
    e.preventDefault();
    setOtpError("");
    if (!form.otp || form.otp.length !== 6) {
      setOtpError("Must be 6 digits");
      return;
    }

    setOtpLoading(true);
    const payload = { ...form, role, name: `${form.firstName.trim()} ${form.lastName.trim()}` };
    delete payload.firstName;
    delete payload.lastName;
    if (role === "influencer") delete payload.company;
    
    const r = await register(payload);
    setOtpLoading(false);
    
    if (r.ok) {
      nav(`/onboarding/${role}`);
    } else {
      setOtpError(r.error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F4F4F0]">
      <div className="grain" />
      <Nav />
      
      <div className="min-h-screen flex items-center justify-center pt-24 pb-14 px-6">
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          onSubmit={handleInitialSubmit}
          className="w-full max-w-2xl bg-[#0A0A0A] border border-[#F4F4F0]/10 p-8 md:p-14"
          data-testid={`register-form-${role}`}
          autoComplete="off"
        >
          <div className="flex items-center justify-between mb-8">
            <p className="font-mono text-[11px] tracking-[0.3em] uppercase opacity-60">
              § Apply for access
            </p>
            <Link to="/register" className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 hover:opacity-100 hover:text-[#FF3B30] transition-colors">
              ← Change Door
            </Link>
          </div>

          <h1 className="font-editorial text-4xl md:text-5xl leading-[1.15]">
            Register as <span className="italic text-[#FF3B30]">{roleLabel}.</span>
          </h1>

          <div className="mt-10 flex justify-center w-full">
            <GoogleLogin
              onSuccess={credentialResponse => {
                try {
                  const decoded = jwtDecode(credentialResponse.credential);
                  setForm(f => ({
                    ...f,
                    firstName: decoded.given_name || "",
                    lastName: decoded.family_name || "",
                    email: decoded.email || ""
                  }));
                  setErr("");
                  setFieldErrors(e => ({...e, firstName: "", lastName: "", email: ""}));
                } catch (e) {
                  setErr("Failed to parse Google login");
                }
              }}
              onError={() => {
                setErr("Google Login Failed");
              }}
              theme="filled_black"
              shape="rectangular"
              text="continue_with"
              size="large"
              width="100%"
            />
          </div>

          <div className="flex items-center gap-4 mt-8 opacity-60">
            <div className="h-px bg-[#F4F4F0]/20 flex-1"></div>
            <span className="font-mono text-[10px] tracking-widest uppercase">Or fill manually</span>
            <div className="h-px bg-[#F4F4F0]/20 flex-1"></div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
            <Field label="First name" testid="reg-firstname" value={form.firstName} onChange={change("firstName")} placeholder="First name" error={fieldErrors.firstName} required />
            <Field label="Last name" testid="reg-lastname" value={form.lastName} onChange={change("lastName")} placeholder="Last name" error={fieldErrors.lastName} required />
            
            {(role === "owner" || role === "agent") && (
              <Field 
                label={role === "owner" ? "Brand / Company" : "Agency Name"} 
                testid="reg-company" 
                value={form.company} 
                onChange={change("company")} 
                placeholder={role === "owner" ? "Company name" : "Agency name"} 
                error={fieldErrors.company}
                required 
              />
            )}
            <Field label="Username" testid="reg-username" value={form.username} onChange={change("username")} placeholder="your_username" error={fieldErrors.username} required />
            
            <div className="relative">
              <Field label="Email" testid="reg-email" value={form.email} onChange={change("email")} placeholder="you@example.com" type="email" error={fieldErrors.email} required />
              {emailStatus === "available" && <CheckCircle2 className="absolute right-3 top-10 w-4 h-4 text-green-500" />}
              {emailStatus === "taken" && <XCircle className="absolute right-3 top-10 w-4 h-4 text-[#FF3B30]" />}
            </div>

            <div className="relative">
              <Field label="Mobile Number" testid="reg-mobile" value={form.mobile} onChange={change("mobile")} placeholder="" prefix="🇮🇳 +91" error={fieldErrors.mobile} required maxLength="10" />
              {mobileStatus === "available" && <CheckCircle2 className="absolute right-3 top-10 w-4 h-4 text-green-500" />}
              {mobileStatus === "taken" && <XCircle className="absolute right-3 top-10 w-4 h-4 text-[#FF3B30]" />}
            </div>

            <Field label="Pincode (India)" testid="reg-pincode" value={form.pincode} onChange={change("pincode")} placeholder="6 digits" error={fieldErrors.pincode} required />
            
            <Field label="City" testid="reg-city" value={form.city} onChange={change("city")} placeholder="Auto-filled from Pincode" error={fieldErrors.city} required />
            <Field label="State" testid="reg-state" value={form.state} onChange={change("state")} placeholder="Auto-filled from Pincode" error={fieldErrors.state} required />

            <Field label="Password" testid="reg-password" value={form.password} onChange={change("password")} placeholder="min. 8 chars, alphanumeric" type="password" error={fieldErrors.password} required />
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
            {loading ? "Sending Code…" : <>Verify Identity <ArrowRight className="w-4 h-4" /></>}
          </button>

          <p className="mt-6 font-mono text-[11px] tracking-[0.2em] uppercase opacity-60 text-center">
            Already inside?{" "}
            <Link to="/login" className="kinetic-underline text-[#FF3B30]" data-testid="link-to-login">
              Sign in →
            </Link>
          </p>
        </motion.form>
      </div>

      {/* OTP Verification Modal */}
      <AnimatePresence>
        {showOtpModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A]/90 backdrop-blur-sm p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0A0A0A] border border-[#F4F4F0]/20 p-8 md:p-12 max-w-md w-full relative"
            >
              <button 
                type="button"
                onClick={() => setShowOtpModal(false)}
                className="absolute top-6 right-6 opacity-60 hover:opacity-100 transition-opacity"
              >
                <XCircle className="w-6 h-6" />
              </button>

              <h2 className="font-editorial text-4xl mb-2">Verify it's you.</h2>
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 mb-8 leading-relaxed">
                We sent a 6-digit code to {form.email}. Check your console logs since this is a Mock OTP.
              </p>

              <form onSubmit={verifyAndRegister}>
                <Field 
                  label="Verification Code" 
                  testid="otp-input" 
                  value={form.otp} 
                  onChange={change("otp")} 
                  placeholder="000000" 
                  error={otpError} 
                  maxLength={6}
                  required 
                  autoFocus
                  className="w-full py-3 focus:outline-none text-2xl tracking-widest text-center bg-transparent"
                />
                
                <button
                  type="submit"
                  disabled={otpLoading}
                  data-testid="verify-submit"
                  className="btn-solid mt-8 w-full justify-center"
                >
                  {otpLoading ? "Entering…" : <>Complete Registration <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, testid, error, prefix, ...props }) {
  return (
    <div>
      <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
        {label}
      </label>
      <div className={`mt-2 flex items-center w-full bg-transparent transition-colors ${error ? "border-b border-[#FF3B30] text-[#FF3B30]" : "hairline-b focus-within:border-[#FF3B30]"}`}>
        {prefix && <span className="text-lg opacity-60 mr-2 flex-shrink-0">{prefix}</span>}
        <input
          data-testid={testid}
          {...props}
          className={`w-full py-3 focus:outline-none text-lg bg-transparent ${props.className || ''}`}
        />
      </div>
      {error && <p className="text-[#FF3B30] text-[10px] mt-2 uppercase tracking-widest font-mono">{error}</p>}
    </div>
  );
}
