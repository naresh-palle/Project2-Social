import { Sidebar } from "./Sidebar";
import { ThemeToaster } from "@/components/ThemeToaster";
import { Outlet, useNavigate } from "react-router-dom";
import { FloatingChatWidget } from "./FloatingChatWidget";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { isSupportOpsRole } from "@/lib/supportOps";

export function AppLayout() {
  const { logout, user } = useAuth();
  const nav = useNavigate();
  const isSupport = isSupportOpsRole(user?.role);

  return (
    <div className="min-h-screen bg-[#0B0B0E] text-[#F4F4F0] relative overflow-hidden flex">
      {/* Background gradients/elements (optional) */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#FF3B30] opacity-[0.02] blur-[100px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#34C759] opacity-[0.02] blur-[100px] rounded-full mix-blend-screen" />
      </div>

      <Sidebar />
      <ThemeToaster />

      {/* The main shell is fixed height. Child pages must manage their own scrolling */}
      <main className="flex-1 ml-64 relative z-10 flex flex-col h-screen overflow-hidden">
        <div className="shrink-0 flex items-center justify-end gap-2 px-6 md:px-10 pt-4 pb-1 relative z-30">
          <button
            type="button"
            onClick={() => {
              logout();
              nav("/");
            }}
            title="Sign out"
            aria-label="Sign out"
            data-testid="logout-button"
            className="p-2.5 rounded-full border border-white/15 bg-[#121212]/80 hover:border-[#FF3B30] hover:text-[#FF3B30] text-white/70 transition-colors shadow-lg shadow-black/30"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative w-full max-w-[1600px] mx-auto px-6 md:px-10 pb-28 pr-8 md:pr-12 pt-2">
          <Outlet />
        </div>
      </main>

      {/* Business messaging FAB — not for Support Operations */}
      {!isSupport && <FloatingChatWidget />}
    </div>
  );
}
