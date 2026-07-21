import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";

export function Nav({ variant = "dark" }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const isPaper = variant === "paper";

  useEffect(() => {
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const items = user
    ? [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/messages", label: "Messages" },
        { to: "/invitations", label: "Invitations" },
        { to: "/wallet", label: "Wallet" },
        { to: "/profile", label: "Profile" },
      ]
    : [];

  return (
    <motion.header
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl ${
        isPaper ? "bg-[#F4F4F0]/70 text-[#0A0A0A] hairline-b" : "bg-black/50 text-[#F4F4F0] hairline-b"
      }`}
    >
      <div className="max-w-[1600px] mx-auto flex items-center justify-between px-6 md:px-10 py-4">
        <Link to="/" data-testid="nav-logo" className="flex items-center gap-2">
          <span className="font-editorial italic text-2xl leading-[1.15]">CR</span>
          <span className="font-editorial text-2xl leading-[1.15]">8</span>
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 ml-3">⌘ Studio</span>
        </Link>


        <div className="flex items-center gap-3">
          {user ? (
            <>
              <NotificationBell />
              <div ref={menuRef} className="relative">
              <button
                onClick={() => setOpen(v => !v)}
                data-testid="nav-user-menu"
                className="btn-pill"
              >
                <span>{user.name?.split(" ")[0]}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-3 w-56 bg-[#0A0A0A]/95 backdrop-blur-xl hairline-t hairline-b hairline-l hairline-r"
                  >
                    <div className="p-4 hairline-b">
                      <div className="font-editorial text-xl">{user.name}</div>
                      <div className="font-mono text-[10px] tracking-[0.22em] uppercase opacity-60">{user.role}</div>
                    </div>
                    <div className="p-2">
                      {items.map(it => (
                        <Link
                          key={it.to}
                          to={it.to}
                          onClick={() => setOpen(false)}
                          data-testid={`menu-${it.label.toLowerCase().replace(/\s+/g, "-")}`}
                          className="block px-3 py-2 font-mono text-[11px] tracking-[0.22em] uppercase hover:bg-white/5"
                        >
                          {it.label}
                        </Link>
                      ))}
                      <button
                        onClick={() => { setOpen(false); logout(); nav("/"); }}
                        data-testid="nav-logout"
                        className="block w-full text-left px-3 py-2 font-mono text-[11px] tracking-[0.22em] uppercase text-[#FF3B30] hover:bg-white/5"
                      >
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            </>
          ) : (
            <>
              <Link to="/login" data-testid="nav-login" className="hidden sm:block font-mono text-[11px] tracking-[0.22em] uppercase kinetic-underline">Sign In</Link>
              <Link to="/register" data-testid="nav-register" className="btn-solid">Enter Studio →</Link>
            </>
          )}
        </div>
      </div>
    </motion.header>
  );
}
