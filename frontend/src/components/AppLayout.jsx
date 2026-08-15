import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { ThemeToaster } from "@/components/ThemeToaster";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { FloatingChatWidget } from "./FloatingChatWidget";
import { useAuth } from "@/lib/auth";
import { isSupportOpsRole } from "@/lib/supportOps";
import { NotificationBell } from "./NotificationBell";
import { IconTip } from "@/components/IconTip";
import { AiIcon } from "@/components/AiIcon";
import { MobileBottomNav } from "./MobileBottomNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Menu } from "lucide-react";

export function AppLayout() {
  const { logout, user } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const isSupport = isSupportOpsRole(user?.role);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!navOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  return (
    <div className="h-[100dvh] bg-[#0B0B0E] text-[#F4F4F0] relative overflow-hidden flex min-w-0">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-[min(500px,80vw)] h-[min(500px,80vw)] bg-[#FF3B30] opacity-[0.02] blur-[100px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-0 right-0 w-[min(500px,80vw)] h-[min(500px,80vw)] bg-[#34C759] opacity-[0.02] blur-[100px] rounded-full mix-blend-screen" />
      </div>

      <Sidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />
      <ThemeToaster />

      <main className="flex-1 ml-0 lg:ml-64 relative z-10 flex flex-col h-[100dvh] min-h-0 min-w-0 overflow-hidden">
        <div className="shrink-0 h-12 flex items-center gap-2 px-3 sm:px-5 lg:px-8 relative z-[80] bg-[#0B0B0E]/95 backdrop-blur-sm border-b border-white/5">
          <button
            type="button"
            className="lg:hidden w-9 h-9 rounded-full border border-white/20 bg-white/10 flex items-center justify-center shrink-0"
            aria-label="Open menu"
            onClick={() => setNavOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/dashboard" className="lg:hidden font-editorial text-lg text-[#FF3B30] shrink-0">
            CR8
          </Link>
          <div className="ml-auto flex items-center gap-2">
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
        </div>
        <div
          id="app-scroll"
          className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden no-scrollbar relative w-full max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 pt-3 pb-[max(5.75rem,calc(4.5rem+env(safe-area-inset-bottom)))] lg:pb-12"
        >
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>

      <MobileBottomNav />
      {!isSupport && <FloatingChatWidget />}
    </div>
  );
}
