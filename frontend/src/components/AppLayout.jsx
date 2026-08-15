import { Sidebar } from "./Sidebar";
import { ThemeToaster } from "@/components/ThemeToaster";
import { Outlet, useNavigate } from "react-router-dom";
import { FloatingChatWidget } from "./FloatingChatWidget";
import { useAuth } from "@/lib/auth";
import { isSupportOpsRole } from "@/lib/supportOps";
import { NotificationBell } from "./NotificationBell";
import { IconTip } from "@/components/IconTip";
import { AiIcon } from "@/components/AiIcon";

export function AppLayout() {
  const { logout, user } = useAuth();
  const nav = useNavigate();
  const isSupport = isSupportOpsRole(user?.role);

  return (
    <div className="h-screen bg-[#0B0B0E] text-[#F4F4F0] relative overflow-hidden flex">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#FF3B30] opacity-[0.02] blur-[100px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#34C759] opacity-[0.02] blur-[100px] rounded-full mix-blend-screen" />
      </div>

      <Sidebar />
      <ThemeToaster />

      <main className="flex-1 ml-64 relative z-10 flex flex-col h-screen min-h-0 overflow-hidden">
        {/* Compact utility strip — reserved height so icons never overlap page cards */}
        <div className="shrink-0 h-12 flex items-center justify-end gap-2 px-5 md:px-8 relative z-[80] bg-[#0B0B0E]/95 backdrop-blur-sm border-b border-white/5">
          <NotificationBell />
          <IconTip label="Sign out" side="bottom">
            <button
              type="button"
              onClick={() => {
                logout();
                nav("/");
              }}
              aria-label="Sign out"
              data-testid="logout-button"
              className="w-9 h-9 rounded-full border border-white/25 bg-white/10 hover:border-[#FF3B30] hover:bg-[#FF3B30]/15 flex items-center justify-center transition-colors"
            >
              <AiIcon name="logout" className="w-5 h-5" />
            </button>
          </IconTip>
        </div>
        <div
          id="app-scroll"
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar relative w-full max-w-[1600px] mx-auto px-5 md:px-8 pb-12 pt-3"
        >
          <Outlet />
        </div>
      </main>

      {!isSupport && <FloatingChatWidget />}
    </div>
  );
}
