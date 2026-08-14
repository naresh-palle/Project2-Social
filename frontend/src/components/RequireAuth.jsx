import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

const SUPPORT_ROLES = ["support", "support_agent", "support_lead", "support_admin"];

export function RequireAuth({ children, roles = [] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-[#F4F4F0] font-mono text-[10px] tracking-[0.3em] uppercase">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Support Operations is an independent category — never inherit business-role routes
  if (SUPPORT_ROLES.includes(user.role)) {
    if (roles.length === 0) {
      // Generic auth-only pages (settings etc.) OK
      return children;
    }
    if (roles.some((r) => SUPPORT_ROLES.includes(r)) || roles.includes(user.role)) {
      return children;
    }
    return <Navigate to="/support/ops" replace />;
  }

  if (roles.length > 0 && !roles.includes(user.role) && user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
