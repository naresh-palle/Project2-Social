import { Navigate, useLocation } from "react-router-dom";

/** Dedicated Influencers entry — reuses Directory with the creators tab selected. */
export default function InfluencersRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  if (!params.get("tab")) params.set("tab", "creators");
  const qs = params.toString();
  return <Navigate to={`/marketplace?${qs}`} replace />;
}
