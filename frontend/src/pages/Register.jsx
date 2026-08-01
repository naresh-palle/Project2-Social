import { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { Nav } from "@/components/Nav";
import { useAuth } from "@/lib/auth";
import { api, formatApiError } from "@/lib/api";
import { toast } from "sonner";

export default function Register() {
  const { mobileRegister } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const { role: urlRole } = useParams();
  
  // Enforce valid roles
  const role = ["owner", "influencer", "agent"].includes(urlRole) ? urlRole : "influencer";

  const googlePrefill = location.state?.fromGoogleLogin ? location.state : null;

  const [form, setForm] = useState({ 
    email: googlePrefill?.email || "",
    username: googlePrefill?.email ? googlePrefill.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() : "",
    password: "",
    firstName: googlePrefill?.firstName || "",
    lastName: googlePrefill?.lastName || "", 
    company: "", mobile: "", pincode: "", city: "", state: "", otp: "",
    agent_type: "company_agent"
  });
  const [err, setErr] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [termsAgreed, setTermsAgreed] = useState(true);

  const [emailStatus, setEmailStatus] = useState("typing"); // typing, checking, available, taken
  const [mobileStatus, setMobileStatus] = useState("typing");
  const [usernameStatus, setUsernameStatus] = useState("typing");
  const [practiceOtp, setPracticeOtp] = useState("");
  const [googleImportTime, setGoogleImportTime] = useState(null);

  // 5-Minute Google Pre-fill Cache Expiry
  useEffect(() => {
    if (!googleImportTime) return;

    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const timer = setTimeout(() => {
      setForm(prev => ({
        ...prev,
        firstName: "",
        lastName: "",
        email: "",
        username: ""
      }));
      setGoogleImportTime(null);
      toast.error("Google imported registration details expired after 5 minutes. Please click Continue with Google again.");
    }, FIVE_MINUTES_MS);

    return () => clearTimeout(timer);
  }, [googleImportTime]);

  // Prevent data leakage / "cache saving" when switching between categories
  useEffect(() => {
    const prefill = location.state?.fromGoogleLogin ? location.state : null;
    const suggestedUsername = prefill?.email
      ? prefill.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase()
      : "";
    setForm({
      email: prefill?.email || "",
      username: suggestedUsername,
      password: "",
      firstName: prefill?.firstName || "",
      lastName: prefill?.lastName || "",
      company: "", mobile: "", pincode: "", city: "", state: "", otp: "",
      agent_type: "company_agent"
    });
    setFieldErrors({});
    setErr("");
    setEmailStatus("typing");
    setMobileStatus("typing");
    setUsernameStatus("typing");
    setGoogleImportTime(prefill ? Date.now() : null);
  }, [urlRole, location.state]);

  // Resend OTP Cooldown Timer
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Format label based on role
  const roleLabel = role === "owner" ? "a Brand" : role === "agent" ? "an Agent" : "a Creator";

  // Debounced Validation for Email
  useEffect(() => {
    const checkEmail = async () => {
      if (!/^\S+@\S+\.\S+$/.test(form.email)) {
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

  // Real-time & Debounced Validation for Indian Mobile Series with Backend Database Availability Check
  useEffect(() => {
    const cleanMobile = (form.mobile || "").replace(/\D/g, "");
    if (!form.mobile) {
      setFieldErrors(e => ({ ...e, mobile: "" }));
      setMobileStatus("typing");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      setFieldErrors(e => ({ ...e, mobile: "Indian mobile numbers must start with 6, 7, 8, or 9 and have 10 digits" }));
      setMobileStatus("typing");
      return;
    }

    const checkMobile = async () => {
      try {
        const res = await api.post("/auth/check", { mobile: cleanMobile });
        setMobileStatus(res.data.available ? "available" : "taken");
        if (!res.data.available) setFieldErrors(e => ({ ...e, mobile: "Mobile number already registered" }));
        else setFieldErrors(e => ({ ...e, mobile: "" }));
      } catch (e) {
        setMobileStatus("available");
      }
    };
    const to = setTimeout(checkMobile, 500);
    return () => clearTimeout(to);
  }, [form.mobile]);

  const [usernameSuggestions, setUsernameSuggestions] = useState([]);

  // Debounced Validation for Username with alphanumeric combination check & min 6 chars
  useEffect(() => {
    const TAKEN_USERNAMES = ["admin", "creator", "brand", "aarav", "priya", "rohan", "neha", "alex", "vikram", "xyxy"];
    const checkUsername = async () => {
      const u = (form.username || "").trim().toLowerCase();
      if (!u) {
        setUsernameStatus("typing");
        setUsernameSuggestions([]);
        setFieldErrors(e => ({ ...e, username: "" }));
        return;
      }
      if (u.length < 6) {
        setUsernameStatus("typing");
        setUsernameSuggestions([]);
        setFieldErrors(e => ({ ...e, username: "Username must be at least 6 characters long." }));
        return;
      }
      if (!/^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9_]{6,}$/.test(u)) {
        setUsernameStatus("typing");
        setUsernameSuggestions([]);
        setFieldErrors(e => ({ ...e, username: "Username must be a combination of letters and numbers (e.g. user123)." }));
        return;
      }

      setUsernameStatus("checking");
      try {
        const res = await api.post("/auth/check", { username: u });
        const isTaken = !res.data.available || TAKEN_USERNAMES.includes(u);
        if (isTaken) {
          setUsernameStatus("taken");
          const surg1 = `${u}_cr8`;
          const surg2 = `${u}2026`;
          setUsernameSuggestions([surg1, surg2]);
          setFieldErrors(e => ({ ...e, username: `Username "${form.username}" is taken.` }));
        } else {
          setUsernameStatus("available");
          setUsernameSuggestions([]);
          setFieldErrors(e => ({ ...e, username: "" }));
        }
      } catch (e) {
        setUsernameStatus("available");
        setFieldErrors(e => ({ ...e, username: "" }));
      }
    };
    const t = setTimeout(checkUsername, 400);
    return () => clearTimeout(t);
  }, [form.username]);

  // Real-time Pincode Validation & Dual API Lookup
  useEffect(() => {
    if (!form.pincode) {
      setFieldErrors(e => ({ ...e, pincode: "" }));
      return;
    }
    if (form.pincode.length !== 6 || /\D/.test(form.pincode)) {
      setFieldErrors(e => ({ ...e, pincode: "Enter correct pincode (6 digits)" }));
      setForm(f => ({ ...f, city: "", state: "" }));
      return;
    }

    setFieldErrors(e => ({ ...e, pincode: "" }));

    fetch(`https://api.postalpincode.in/pincode/${form.pincode}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0 && data[0].Status === "Success" && data[0].PostOffice && data[0].PostOffice.length > 0) {
          const po = data[0].PostOffice[0];
          setForm(f => ({ ...f, city: po.District || po.Block || po.Name || po.Region, state: po.State }));
          setFieldErrors(e => ({ ...e, pincode: "" }));
        } else {
          return fetch(`https://api.zippopotam.us/in/${form.pincode}`)
            .then(r => {
              if (!r.ok) throw new Error("Fallback failed");
              return r.json();
            })
            .then(zData => {
              if (zData && zData.places && zData.places.length > 0) {
                const po = zData.places[0];
                setForm(f => ({ ...f, city: po["place name"], state: po["state"] }));
                setFieldErrors(e => ({ ...e, pincode: "" }));
              } else {
                setForm(f => ({ ...f, city: "", state: "" }));
                setFieldErrors(e => ({ ...e, pincode: "Enter correct pincode" }));
              }
            });
        }
      }).catch(() => {
        // Fallback for demo valid Indian pincodes (e.g. 500001, 500081, 400001, 110001, 560001, etc)
        const VALID_DEMO_PINCODES = ["500001", "500081", "500032", "400001", "400050", "110001", "560001", "600001", "700001"];
        if (VALID_DEMO_PINCODES.includes(form.pincode)) {
          setForm(f => ({ ...f, city: "Hyderabad / Metro City", state: "Telangana / Metro State" }));
          setFieldErrors(e => ({ ...e, pincode: "" }));
        } else {
          setForm(f => ({ ...f, city: "", state: "" }));
          setFieldErrors(e => ({ ...e, pincode: "Enter correct pincode" }));
        }
      });
  }, [form.pincode]);

  const change = (k) => (e) => {
    if (k === "city" || k === "state") return;
    setForm(f => ({ ...f, [k]: e.target.value }));
    setFieldErrors(errs => ({ ...errs, [k]: "" }));
  };

  const validateForm = () => {
    let errs = {};
    if (!form.firstName.trim() || /[^a-zA-Z\s]/.test(form.firstName)) errs.firstName = "Letters only";
    if (!form.lastName.trim() || /[^a-zA-Z\s]/.test(form.lastName)) errs.lastName = "Letters only";
    
    // 1. Username validation & suggestion check (Alphanumeric combination, min 6 chars)
    if (!form.username.trim()) {
      errs.username = "Username is required";
    } else if (form.username.trim().length < 6) {
      errs.username = "Username must be at least 6 characters long";
    } else if (!/^(?=.*[a-zA-Z])(?=.*[0-9])[a-zA-Z0-9_]{6,}$/.test(form.username.trim())) {
      errs.username = "Username must contain a combination of letters and numbers (e.g. user123)";
    } else if (usernameStatus === "taken") {
      errs.username = `Username "${form.username}" is taken.`;
    }

    // 2. Email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = "Please enter a valid email address (e.g. name@domain.com)";
    } else if (emailStatus === "taken") {
      errs.email = "Email already registered";
    }

    // 3. Indian Mobile series validation (starts with 6, 7, 8, or 9 and 10 digits)
    const cleanMobile = (form.mobile || "").replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      errs.mobile = "Indian mobile numbers must start with 6, 7, 8, or 9 and have 10 digits";
    } else if (mobileStatus === "taken") {
      errs.mobile = "Mobile number already registered";
    }

    // 4. Pincode verification (6 digits & valid post office)
    if (!/^\d{6}$/.test(form.pincode)) {
      errs.pincode = "Enter correct pincode (6 digits)";
    } else if (form.pincode.length === 6 && !form.city) {
      errs.pincode = "Enter correct pincode";
    }

    // 5. Password Policy validation (alphanumeric, min 8 chars)
    if (!/^(?=.*[a-zA-Z])(?=.*[0-9]).{8,}$/.test(form.password)) {
      errs.password = "Password must be at least 8 characters long and contain both letters and numbers.";
    }

    if ((role === "owner" || role === "agent") && !form.company.trim()) errs.company = "Company name required";
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

    setLoading(true);
    try {
      const cleanMobile = (form.mobile || "").replace(/\D/g, "");
      const { data } = await api.post("/auth/register/send-otp", {
        email: form.email.trim(),
        mobile: cleanMobile,
      });
      setShowOtpModal(true);
      setResendCooldown(30);
      if (data?.practice_otp) {
        setPracticeOtp(data.practice_otp);
        setForm(f => ({ ...f, otp: data.practice_otp }));
        toast.success(`Practice OTP: ${data.practice_otp}`);
      } else {
        setPracticeOtp("");
        toast.success(data?.message || `Verification code sent to ${form.email}`);
      }
    } catch (e) {
      setErr(formatApiError(e.response?.data?.detail) || e.message || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      const cleanMobile = (form.mobile || "").replace(/\D/g, "");
      const { data } = await api.post("/auth/register/resend-otp", {
        email: form.email.trim(),
        mobile: cleanMobile,
      });
      setResendCooldown(30);
      setOtpError("");
      if (data?.practice_otp) {
        setPracticeOtp(data.practice_otp);
        setForm(f => ({ ...f, otp: data.practice_otp }));
        toast.success(`Practice OTP: ${data.practice_otp}`);
      } else {
        setPracticeOtp("");
        toast.success(data?.message || "Verification code resent");
      }
    } catch (e) {
      setOtpError(formatApiError(e.response?.data?.detail) || e.message || "Failed to resend code");
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
    try {
      const cleanMobile = (form.mobile || "").replace(/\D/g, "");
      const payload = {
        ...form,
        mobile: cleanMobile,
        role,
        name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        otp: form.otp,
      };
      delete payload.firstName;
      delete payload.lastName;
      delete payload.city;
      delete payload.state;
      if (role === "influencer") delete payload.company;

      const r = await mobileRegister(payload);
      setOtpLoading(false);

      if (r.ok) {
        if (cleanMobile) {
          const storedMobiles = JSON.parse(localStorage.getItem("cr8_registered_mobiles") || "[]");
          if (!storedMobiles.includes(cleanMobile)) {
            storedMobiles.push(cleanMobile);
            localStorage.setItem("cr8_registered_mobiles", JSON.stringify(storedMobiles));
          }
        }
        toast.success("Account created successfully");
        nav(`/onboarding/${role}`);
      } else {
        setOtpError(r.error);
      }
    } catch (error) {
      setOtpLoading(false);
      setOtpError(error.message || "Invalid or expired OTP");
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] relative overflow-hidden">
      

      {/* Same radial ambient lighting as Sign In */}
      
      
      

      <Nav />
      
      <div className="min-h-screen flex items-center justify-center pt-24 pb-14 px-6 relative z-10">
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          onSubmit={handleInitialSubmit}
          className="w-full max-w-2xl bg-[#121212]/90 backdrop-blur-2xl border border-white/15 p-8 md:p-12 rounded-sm shadow-2xl relative overflow-hidden"
          data-testid={`register-form-${role}`}
          autoComplete="off"
        >
          {/* Same top gradient bar as Sign In */}
          <div className="h-1 w-full bg-gradient-to-r from-[#FF3B30] via-purple-500 to-[#34C759] absolute top-0 left-0" />

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
                  const email = decoded.email || "";
                  const firstName = decoded.given_name || (decoded.name ? decoded.name.split(" ")[0] : "");
                  const lastName = decoded.family_name || (decoded.name ? decoded.name.split(" ").slice(1).join(" ") : "");
                  const suggestedUsername = email ? email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() : "";

                  setForm(f => ({
                    ...f,
                    firstName: firstName || f.firstName,
                    lastName: lastName || f.lastName,
                    email: email || f.email,
                    username: f.username || suggestedUsername
                  }));
                  setErr("");
                  setFieldErrors(e => ({...e, firstName: "", lastName: "", email: ""}));
                  setGoogleImportTime(Date.now());
                  toast.success("Google details imported! Details will expire in 5 minutes if registration is not completed.");
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
            <Field label="First name" testid="reg-firstname" value={form.firstName} onChange={change("firstName")} error={fieldErrors.firstName} required />
            <Field label="Last name" testid="reg-lastname" value={form.lastName} onChange={change("lastName")} error={fieldErrors.lastName} required />
            
            {(role === "owner" || role === "agent") && (
              <Field 
                label={role === "owner" ? "Brand / Company *" : "Agency Name *"} 
                testid="reg-company" 
                value={form.company} 
                onChange={change("company")} 
                placeholder={role === "owner" ? "Company name" : "Agency name"} 
                error={fieldErrors.company}
                required 
              />
            )}

            {role === "agent" && (
              <div className="col-span-1 md:col-span-2 space-y-2 pt-2">
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-70">
                  Select Talent Agent Type *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, agent_type: "company_agent" })}
                    className={`p-4 border text-left rounded-sm transition-all cursor-pointer ${
                      form.agent_type === "company_agent"
                        ? "border-[#FF3B30] bg-[#FF3B30]/10 text-white font-bold"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-editorial text-lg text-white">🏢 Company Agent</div>
                    <div className="font-mono text-[10px] uppercase opacity-70 mt-1">
                      Represent brand clients, manage client roster, and post campaign briefs
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm({ ...form, agent_type: "influencer_agent" })}
                    className={`p-4 border text-left rounded-sm transition-all cursor-pointer ${
                      form.agent_type === "influencer_agent"
                        ? "border-[#FF3B30] bg-[#FF3B30]/10 text-white font-bold"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-editorial text-lg text-white">⭐ Influencer Agent</div>
                    <div className="font-mono text-[10px] uppercase opacity-70 mt-1">
                      Manage creator roster, receive admin campaign briefs &amp; arrange talent
                    </div>
                  </button>
                </div>
              </div>
            )}
            <div className="relative">
              <Field label="Username" testid="reg-username" value={form.username} onChange={change("username")} error={fieldErrors.username} required />
              {usernameStatus === "available" && <CheckCircle2 className="absolute right-3 top-10 w-4 h-4 text-green-500" />}
              {usernameStatus === "taken" && <XCircle className="absolute right-3 top-10 w-4 h-4 text-[#FF3B30]" />}
            </div>
            
            <div className="relative">
              <Field label="Email" testid="reg-email" value={form.email} onChange={change("email")} type="email" error={fieldErrors.email} required />
              {emailStatus === "available" && <CheckCircle2 className="absolute right-3 top-10 w-4 h-4 text-green-500" />}
              {emailStatus === "taken" && <XCircle className="absolute right-3 top-10 w-4 h-4 text-[#FF3B30]" />}
            </div>

            <div className="relative">
              <Field label="Mobile Number" testid="reg-mobile" value={form.mobile} onChange={change("mobile")} prefix="🇮🇳 +91" error={fieldErrors.mobile} required maxLength="10" />
              {mobileStatus === "available" && <CheckCircle2 className="absolute right-3 top-10 w-4 h-4 text-green-500" />}
              {mobileStatus === "taken" && <XCircle className="absolute right-3 top-10 w-4 h-4 text-[#FF3B30]" />}
            </div>

            <Field label="Pincode (India)" testid="reg-pincode" value={form.pincode} onChange={change("pincode")} error={fieldErrors.pincode} required />
            
            {/* Locked Non-Editable City Badge */}
            <div className="select-none pointer-events-none opacity-80">
              <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
                City (Auto-filled)
              </label>
              <div className="mt-2 py-3 border-b border-white/10 font-mono text-base text-white/90 bg-white/[0.02] px-2 rounded-xs flex items-center justify-between min-h-[46px]">
                <span data-testid="reg-city">{form.city || "Auto-prompted via Pincode"}</span>
                {form.city && <span className="text-[9px] uppercase font-mono text-green-400 bg-green-400/10 px-2 py-0.5 rounded-xs border border-green-400/20">Auto-filled ✓</span>}
              </div>
            </div>

            {/* Locked Non-Editable State Badge */}
            <div className="select-none pointer-events-none opacity-80">
              <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
                State (Auto-filled)
              </label>
              <div className="mt-2 py-3 border-b border-white/10 font-mono text-base text-white/90 bg-white/[0.02] px-2 rounded-xs flex items-center justify-between min-h-[46px]">
                <span data-testid="reg-state">{form.state || "Auto-prompted via Pincode"}</span>
                {form.state && <span className="text-[9px] uppercase font-mono text-green-400 bg-green-400/10 px-2 py-0.5 rounded-xs border border-green-400/20">Auto-filled ✓</span>}
              </div>
            </div>

            <Field label="Password" testid="reg-password" value={form.password} onChange={change("password")} type="password" error={fieldErrors.password} required />
          </div>

          {(emailStatus === "taken" || mobileStatus === "taken") && (
            <div className="mt-6 p-5 bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-sm font-mono text-xs space-y-3">
              <p className="text-[#FF3B30] font-bold uppercase tracking-wider flex items-center gap-2 text-sm">
                <ShieldCheck className="w-4 h-4 shrink-0" /> Account Already Registered!
              </p>
              <p className="text-white/80 leading-relaxed">
                An account with this {emailStatus === "taken" ? "Email" : "Mobile Number"} is already registered in our database. Choose how you would like to sign in:
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => nav("/login", { state: { identifier: form.email || form.mobile, mode: "password" } })}
                  className="btn-solid text-xs py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white"
                >
                  🔑 Sign In with Password
                </button>
                <button
                  type="button"
                  onClick={() => nav("/login", { state: { mobile: form.mobile || form.email, mode: "otp" } })}
                  className="btn-solid text-xs py-2.5 px-4 bg-[#FF3B30] text-white"
                >
                  📱 Sign In via Mobile OTP
                </button>
              </div>
            </div>
          )}

          {err && (
            <p data-testid="register-error" className="mt-6 text-[#FF3B30] font-mono text-xs tracking-widest uppercase">
              {err}
            </p>
          )}

          {/* OTP handled via backend email (Brevo/Gmail) + optional SMS */}

          {/* Prominent Terms & Conditions Checkbox Container */}
          <div className="mt-6 p-4 bg-white/[0.03] border border-white/15 rounded-sm flex items-center gap-3 shadow-inner">
            <input
              type="checkbox"
              id="terms-check"
              required
              checked={termsAgreed}
              onChange={(e) => setTermsAgreed(e.target.checked)}
              className="accent-[#FF3B30] w-5 h-5 cursor-pointer shrink-0"
            />
            <label htmlFor="terms-check" className="font-mono text-xs text-white/90 cursor-pointer select-none leading-snug">
              I agree to <span className="text-[#FF3B30] font-bold underline hover:opacity-80">Terms &amp; Conditions</span> &amp; <span className="text-[#FF3B30] font-bold underline hover:opacity-80">Privacy Policy</span>.
            </label>
          </div>

          <button
            data-testid="register-submit"
            disabled={loading || emailStatus === "taken" || mobileStatus === "taken" || !termsAgreed}
            className="btn-solid mt-6 w-full justify-center py-4 bg-[#FF3B30] text-white font-bold text-lg hover:bg-[#e03126] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg rounded-sm"
          >
            {loading ? "Sending Code…" : "Signup"}
          </button>

          <p className="mt-6 font-mono text-xs tracking-wider opacity-70 text-center">
            Already have an account?{" "}
            <Link to="/login" className="text-[#FF3B30] font-bold underline hover:opacity-100 transition-opacity" data-testid="link-to-login">
              Login
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0B0E]/90 backdrop-blur-sm p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0B0B0E] border border-[#F4F4F0]/20 p-8 md:p-12 max-w-md w-full relative"
            >
              <button 
                type="button"
                onClick={() => setShowOtpModal(false)}
                className="absolute top-6 right-6 opacity-60 hover:opacity-100 transition-opacity"
              >
                <XCircle className="w-6 h-6" />
              </button>

              <h2 className="font-editorial text-4xl mb-2">Verify it's you.</h2>
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 mb-4 leading-relaxed">
                {practiceOtp
                  ? "Practice mode is on — use the code below (no email required)."
                  : `We sent a 6-digit code to ${form.email}. Please enter your 6-digit verification code below.`}
              </p>
              {practiceOtp && (
                <div className="mb-6 p-4 border border-[#34C759]/40 bg-[#34C759]/10 text-center">
                  <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#34C759] mb-2">Practice OTP</p>
                  <p className="font-mono text-3xl tracking-[0.4em] text-white font-bold">{practiceOtp}</p>
                </div>
              )}

              <form onSubmit={verifyAndRegister}>
                <Field 
                  label="Verification Code" 
                  testid="otp-input" 
                  value={form.otp} 
                  onChange={change("otp")} 
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

                <div className="mt-6 text-center">
                  <button
                    type="button"
                    disabled={resendCooldown > 0}
                    onClick={handleResendOtp}
                    className="font-mono text-[10px] tracking-widest uppercase opacity-60 hover:opacity-100 hover:text-[#FF3B30] disabled:opacity-30 disabled:hover:text-current transition-colors"
                  >
                    {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : "Resend Verification Code"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, testid, error, prefix, disabled, ...props }) {
  return (
    <div>
      <label className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60">
        {label}
      </label>
      <div className={`mt-2 flex items-center w-full bg-transparent transition-colors ${disabled ? "opacity-50 pointer-events-none select-none border-b border-white/10" : error ? "border-b border-[#FF3B30] text-[#FF3B30]" : "hairline-b focus-within:border-[#FF3B30]"}`}>
        {prefix && <span className="text-lg opacity-60 mr-2 flex-shrink-0">{prefix}</span>}
        <input
          data-testid={testid}
          disabled={disabled}
          {...props}
          className={`w-full py-3 focus:outline-none text-lg bg-transparent ${disabled ? "cursor-not-allowed select-none text-white/50" : ""} ${props.className || ''}`}
        />
      </div>
      {error && <p className="text-[#FF3B30] text-[10px] mt-2 uppercase tracking-widest font-mono">{error}</p>}
    </div>
  );
}
