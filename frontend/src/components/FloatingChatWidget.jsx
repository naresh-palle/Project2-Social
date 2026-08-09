import { Link, useLocation } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";

export function FloatingChatWidget() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user || location.pathname === "/messages" || location.pathname.startsWith("/onboarding")) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        style={{ position: "fixed", bottom: "1.5rem", right: "1.5rem", zIndex: 999999 }}
      >
        <Link
          to="/messages"
          className="flex items-center justify-center w-14 h-14 rounded-full bg-[#FF3B30] text-white shadow-[0_8px_30px_rgb(255,59,48,0.3)] hover:shadow-[0_8px_40px_rgb(255,59,48,0.5)] hover:-translate-y-1 transition-all duration-300"
          title="Messages"
        >
          <MessageSquare className="w-6 h-6" />
        </Link>
      </motion.div>
    </AnimatePresence>
  );
}
