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
            className="fixed bottom-[5.5rem] right-[1.5rem] z-[999999] w-[360px] max-w-[calc(100vw-3rem)] h-[550px] max-h-[calc(100vh-8rem)] bg-[#0B0B0E] border border-white/20 rounded-xl shadow-2xl overflow-hidden flex flex-col"
          >
            <Messages miniWidget={true} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.button
          key={isOpen ? "close" : "open"}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          onClick={() => setIsOpen(!isOpen)}
          className="fixed bottom-[1.5rem] right-[1.5rem] z-[999999] flex items-center justify-center w-14 h-14 rounded-full bg-[#FF3B30] text-white shadow-[0_8px_30px_rgb(255,59,48,0.3)] hover:shadow-[0_8px_40px_rgb(255,59,48,0.5)] hover:-translate-y-1 transition-all duration-300"
          title={isOpen ? "Close Chat" : "Open Chat"}
        >
          {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        </motion.button>
      </AnimatePresence>
    </>
  );
}
