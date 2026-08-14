import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { isSupportOpsRole, SUPPORT_ALLOWED_PATHS, supportHomePath } from "@/lib/supportOps";

export function RequireAuth({ children, roles = [] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-[#F4F4F0] font-mono text-[10px] tracking-[0.3em] uppercase">
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

  if (roles.length > 0 && !roles.includes(user.role) && user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
