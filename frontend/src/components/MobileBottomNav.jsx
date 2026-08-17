import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { AiIcon } from "@/components/AiIcon";
import { getBottomNavItems, isNavItemActive } from "@/lib/navConfig";

function goHome(nav) {
  const el = document.getElementById("app-scroll");
  if (el) el.scrollTop = 0;
  nav("/dashboard", { replace: false });
}

export function MobileBottomNav() {
  const { user } = useAuth();
  const location = useLocation();
  const nav = useNavigate();
  if (!user) return null;
  const items = getBottomNavItems(user);

  return (
    <nav
      className="lg:hidden fixed inset-x-0 bottom-0 z-[70] border-t border-white/10 bg-[#0B0B0E]/95 backdrop-blur-xl"
      style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
      aria-label="Primary"
    >
      <div className="grid min-h-[3.5rem]" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => {
          const active = isNavItemActive(it, location, user);
          const isHome = it.label === "Home" || it.to === "/dashboard" || it.tab === "dashboard";
          return (
            <Link
              key={`${it.to}-${it.label}`}
              to={it.to}
              data-testid={isHome ? "footer-home" : undefined}
              onClick={(e) => {
                if (!isHome) return;
                e.preventDefault();
                goHome(nav);
              }}
              className={`flex flex-col items-center justify-center gap-0.5 px-1 py-2 min-w-0 ${
                active ? "text-white" : "text-white/50"
              }`}
            >
              <span className={`flex items-center justify-center w-8 h-8 rounded-full ${active ? "bg-[#FF3B30]" : ""}`}>
                <AiIcon name={it.icon} className="w-4 h-4" />
              </span>
              <span className="font-sans text-[9px] font-medium tracking-tight truncate max-w-full">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
