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

  const timeoutRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("mousedown", onClick);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 250);
  };

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
        <Link 
          to="/" 
          onClick={() => {
            window.dispatchEvent(new Event("resetHomeDeck"));
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }} 
          data-testid="nav-logo" 
          className="flex items-center gap-2 cursor-pointer"
        >
          <span className="font-editorial italic text-2xl leading-[1.15]">CR</span>
          <span className="font-editorial text-2xl leading-[1.15]">8</span>
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-60 ml-3">⌘ Studio</span>
        </Link>


        <div className="flex items-center gap-3">
          {user ? (
            <>
              <NotificationBell />
              <div 
                ref={menuRef} 
                className="relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                <button
                  onClick={() => setOpen(v => !v)}
                  data-testid="nav-user-menu"
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/30 bg-white/10 hover:bg-[#FF3B30] hover:border-[#FF3B30] text-white text-xs font-mono tracking-widest uppercase transition-all duration-300 shadow-md"
                >
                  <span className="font-bold text-white tracking-wider">{(user.name || user.username || user.email || "User").split(" ")[0]}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-white transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {open && (
                    <div 
                      className="absolute right-0 top-full pt-1.5 w-60 z-50"
                      onMouseEnter={handleMouseEnter}
                      onMouseLeave={handleMouseLeave}
                    >
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="bg-[#0A0A0A] border border-white/20 shadow-2xl backdrop-blur-2xl rounded-sm overflow-hidden"
                      >
                        <div className="p-4 hairline-b bg-white/[0.03]">
                          <div className="font-editorial text-xl">{user.name}</div>
                          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[#FF3B30]">{user.role}</div>
                        </div>
                        <div className="p-2">
                          {items.map(it => (
                            <Link
                              key={it.to}
                              to={it.to}
                              onClick={() => setOpen(false)}
                              data-testid={`menu-${it.label.toLowerCase().replace(/\s+/g, "-")}`}
                              className="block px-3 py-2.5 font-mono text-[11px] tracking-[0.22em] uppercase hover:bg-white/10 text-white/90 hover:text-white transition-colors"
                            >
                              {it.label}
                            </Link>
                          ))}

                          <button
                            onClick={() => { setOpen(false); logout(); nav("/"); }}
                            data-testid="nav-logout"
                            className="block w-full text-left px-3 py-2.5 font-mono text-[11px] tracking-[0.22em] uppercase text-[#FF3B30] hover:bg-white/10 transition-colors"
                          >
                            Sign Out
                          </button>
                        </div>
                      </motion.div>
                    </div>
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
