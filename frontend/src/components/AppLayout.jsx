import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { ThemeToaster } from "@/components/ThemeToaster";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { FloatingChatWidget } from "./FloatingChatWidget";
import { useAuth } from "@/lib/auth";
import { isSupportOpsRole } from "@/lib/supportOps";
import { NotificationBell } from "./NotificationBell";
import { IconTip } from "@/components/IconTip";
import { MobileBottomNav } from "./MobileBottomNav";
import { ErrorBoundary } from "./ErrorBoundary";
import { LogOut, Menu } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

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
    <div className="h-[100dvh] bg-[#F7F8FC] text-[#1E1B4B] relative overflow-hidden flex min-w-0">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-24 -left-16 w-[420px] h-[420px] bg-[#7C3AED]/10 blur-[110px] rounded-full" />
        <div className="absolute -bottom-28 -right-10 w-[380px] h-[380px] bg-[#14B8A6]/10 blur-[100px] rounded-full" />
      </div>

      <Sidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />
      <ThemeToaster />

      <main className="flex-1 ml-0 lg:ml-[16.5rem] relative z-10 flex flex-col h-[100dvh] min-h-0 min-w-0 overflow-hidden">
        <header className="shrink-0 h-14 flex items-center gap-2 px-3 sm:px-5 lg:px-8 relative z-[85] bg-white border-b border-[#1E1B4B]/10 shadow-sm overflow-visible safe-px">
          <Link to="/dashboard" className="lg:hidden shrink-0 max-w-[52vw] outline-none" aria-label="flugr home">
            <BrandLogo variant="wordmark" height={30} />
          </Link>
          <div className="ml-auto flex items-center gap-2 shrink-0 relative z-[86]">
            <IconTip label="Menu" side="bottom">
              <button
                type="button"
                className="lg:hidden w-9 h-9 rounded-full border border-[#1E1B4B]/12 bg-[#F7F8FC] text-[#1E1B4B] flex items-center justify-center shrink-0 hover:border-[#FF2D55]/40 hover:bg-[#FFF1F3] transition-colors"
                aria-label="Open menu"
                data-testid="header-menu-button"
                onClick={() => setNavOpen(true)}
              >
                <Menu className="w-5 h-5 text-current" strokeWidth={2.25} />
              </button>
            </IconTip>
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
                className="w-9 h-9 rounded-full border border-[#1E1B4B]/20 bg-white hover:border-[#FF2D55]/50 hover:bg-[#FFF1F3] flex items-center justify-center transition-colors shrink-0 text-[#1E1B4B]"
              >
                <LogOut className="w-5 h-5 text-[#1E1B4B]" strokeWidth={2.4} aria-hidden="true" />
              </button>
            </IconTip>
          </div>
        </header>
        <div
          id="app-scroll"
          className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden no-scrollbar relative w-full max-w-[1600px] mx-auto px-3 sm:px-5 lg:px-8 pt-4 pb-[max(5.75rem,calc(4.5rem+env(safe-area-inset-bottom)))] lg:pb-12 safe-px"
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
