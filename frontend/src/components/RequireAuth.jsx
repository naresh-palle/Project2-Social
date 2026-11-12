import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { isSupportOpsRole, SUPPORT_ALLOWED_PATHS, supportHomePath } from "@/lib/supportOps";
import {
  isRestrictedMode,
  isPathAllowedWhileIncomplete,
  campaignsPathForUser,
  onboardingPathForUser,
} from "@/lib/onboarding";

export function RequireAuth({ children, roles = [] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F0E6] flex items-center justify-center text-[#2A201A] font-mono text-[10px] tracking-[0.3em] uppercase">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Support Operations is an independent category — never inherit business-role routes
  if (isSupportOpsRole(user.role)) {
    const path = location.pathname || "";
    const allowed =
      SUPPORT_ALLOWED_PATHS.some((p) => path === p || path.startsWith(`${p}/`)) ||
      (roles.length > 0 && (roles.includes(user.role) || roles.some((r) => isSupportOpsRole(r))));

    if (!allowed) {
      return <Navigate to={supportHomePath()} replace />;
    }

    if (roles.length > 0 && !roles.includes(user.role) && !roles.some((r) => isSupportOpsRole(r))) {
      return <Navigate to={supportHomePath()} replace />;
    }

    return children;
  }

  // Incomplete / unverified profiles: Campaigns + Complete Profile only
  if (isRestrictedMode(user)) {
    const path = location.pathname || "";
    const search = location.search || "";

    // Always allow onboarding / complete-profile
    if (path.startsWith("/onboarding") || path.startsWith("/complete-profile")) {
      return children;
    }

    // Dashboard and other restricted URLs → campaigns
    if (path === "/dashboard" || path === "/feed" || path === "/messages" || path === "/search" || path === "/discover") {
      return <Navigate to={campaignsPathForUser(user)} replace />;
    }

    if (!isPathAllowedWhileIncomplete(path, search)) {
      // Soft-allow marketplace campaigns tab; otherwise bounce
      if (path === "/marketplace") {
        return <Navigate to={campaignsPathForUser(user)} replace />;
      }
      return <Navigate to={campaignsPathForUser(user)} replace />;
    }
  }

  if (roles.length > 0 && !roles.includes(user.role) && user.role !== "admin") {
    return <Navigate to={isRestrictedMode(user) ? campaignsPathForUser(user) : "/dashboard"} replace />;
  }

  return children;
}

export { onboardingPathForUser };
