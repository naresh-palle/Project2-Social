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
            className="fixed bottom-[6.75rem] lg:bottom-[5.5rem] right-3 left-3 sm:left-auto sm:right-6 z-[60] w-auto sm:w-[380px] max-w-[calc(100vw-1.5rem)] min-w-0 h-[min(560px,calc(100dvh-11rem))] max-h-[calc(100dvh-7.5rem)] landscape:h-[min(420px,calc(100dvh-6.5rem))] landscape:max-h-[calc(100dvh-5.5rem)] border border-[#8B7CFF]/35 rounded-3xl shadow-[0_20px_60px_rgba(6,9,20,0.58)] overflow-hidden flex flex-col"
            style={{
              backgroundColor: "#0B1020",
              backgroundImage: `linear-gradient(180deg, rgba(11,16,32,0.72) 0%, rgba(11,16,32,0.90) 55%, rgba(11,16,32,0.96) 100%), url(${process.env.PUBLIC_URL}/chat-panel-bg.png)`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
            data-testid="messages-popup"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-[#8B7CFF]/20 via-[#52D4B5]/10 to-transparent shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#8B7CFF] flex items-center justify-center text-white shadow-lg shadow-[#8B7CFF]/35">
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
                className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-[#FF5C5C] hover:border-[#FF5C5C] text-white/70 hover:text-white transition-colors"
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
            className="fixed bottom-[4.75rem] lg:bottom-6 right-3 lg:right-6 z-[60] flex items-center justify-center w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-[#8B7CFF] via-[#6675EE] to-[#52D4B5] text-white shadow-[0_10px_36px_rgba(99,92,225,0.42)] hover:shadow-[0_14px_44px_rgba(82,212,181,0.42)] hover:-translate-y-1 transition-all duration-300 ring-2 ring-white/20"
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
