import { useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquare, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import Messages from "@/pages/Messages";

export function FloatingChatWidget() {
  const { user } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  if (!user || location.pathname === "/messages" || location.pathname.startsWith("/onboarding")) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="fixed bottom-[5.5rem] right-[1.5rem] z-[60] w-[380px] max-w-[calc(100vw-3rem)] h-[560px] max-h-[calc(100vh-7.5rem)] bg-[#0B0B0E] border border-[#FF3B30]/35 rounded-3xl shadow-[0_20px_60px_rgba(255,59,48,0.25)] overflow-hidden flex flex-col"
            data-testid="messages-popup"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-[#FF3B30]/20 via-[#FF6B35]/10 to-transparent shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#FF3B30] flex items-center justify-center text-white shadow-lg shadow-[#FF3B30]/40">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-sans text-sm font-bold tracking-wide truncate">Messages</h3>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/50">Inbox</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-[#FF3B30] hover:border-[#FF3B30] text-white/70 hover:text-white transition-colors"
                aria-label="Close messages"
                data-testid="messages-popup-close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <Messages miniWidget={true} onClose={() => setIsOpen(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {!isOpen && (
          <motion.button
            key="open"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-[1.5rem] right-[1.5rem] z-[60] flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-[#FF3B30] via-[#FF5A3C] to-[#FF8A3D] text-white shadow-[0_10px_36px_rgba(255,59,48,0.45)] hover:shadow-[0_14px_44px_rgba(255,59,48,0.6)] hover:-translate-y-1 transition-all duration-300 ring-2 ring-white/20"
            title="Messages"
            aria-label="Open messages"
            data-testid="messages-fab"
          >
            <MessageSquare className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
