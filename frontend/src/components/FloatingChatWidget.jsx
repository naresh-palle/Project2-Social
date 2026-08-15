import { useEffect, useMemo, useState } from "react";
import { useLocation, matchPath } from "react-router-dom";
import { MessageSquare, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import Messages from "@/pages/Messages";

function useProfileDmTarget() {
  const location = useLocation();
  return useMemo(() => {
    const creator = matchPath("/creators/:id", location.pathname);
    if (creator?.params?.id) return creator.params.id;
    const publicUser = matchPath("/u/:userId", location.pathname);
    if (publicUser?.params?.userId) return publicUser.params.userId;
    return null;
  }, [location.pathname]);
}

export function FloatingChatWidget() {
  const { user } = useAuth();
  const location = useLocation();
  const dmUserId = useProfileDmTarget();
  const [isOpen, setIsOpen] = useState(false);

  // When landing on a creator/company profile, keep widget closed until icon click
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  if (!user || location.pathname === "/messages" || location.pathname.startsWith("/onboarding")) {
    return null;
  }

  const chattingProfile = Boolean(dmUserId && String(dmUserId) !== String(user.id));

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="fixed bottom-[6.75rem] lg:bottom-[5.5rem] right-3 left-3 sm:left-auto sm:right-6 z-[60] w-auto sm:w-[380px] max-w-[calc(100vw-1.5rem)] h-[min(560px,calc(100dvh-11rem))] bg-[#0B0B0E] border border-[#FF3B30]/35 rounded-3xl shadow-[0_20px_60px_rgba(255,59,48,0.25)] overflow-hidden flex flex-col"
            data-testid="messages-popup"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-[#FF3B30]/20 via-[#FF6B35]/10 to-transparent shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#FF3B30] flex items-center justify-center text-white shadow-lg shadow-[#FF3B30]/40">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-sans text-sm font-bold tracking-wide truncate">Messages</h3>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-white/50">
                    {chattingProfile ? "Chat with profile" : "Inbox"}
                  </p>
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
              <Messages
                miniWidget={true}
                onClose={() => setIsOpen(false)}
                dmUserId={chattingProfile ? dmUserId : null}
              />
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
            className="fixed bottom-[4.75rem] lg:bottom-6 right-3 lg:right-6 z-[60] flex items-center justify-center w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-[#FF3B30] via-[#FF5A3C] to-[#FF8A3D] text-white shadow-[0_10px_36px_rgba(255,59,48,0.45)] hover:shadow-[0_14px_44px_rgba(255,59,48,0.6)] hover:-translate-y-1 transition-all duration-300 ring-2 ring-white/20"
            title={chattingProfile ? "Message this profile" : "Messages"}
            aria-label={chattingProfile ? "Message this profile" : "Open messages"}
            data-testid="messages-fab"
          >
            <MessageSquare className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
