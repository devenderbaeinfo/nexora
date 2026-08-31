import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Guards the /admin/* tree — the platform control center is for SuperAdmin only. A client-side
// user who somehow lands on an /admin URL (typed it, followed a stale bookmark) is bounced
// back to their own app rather than seeing an empty or broken platform-admin shell.
export default function RequireSuperAdmin({ children }: { children: React.ReactElement }) {
  const { can } = useAuth();
  if (!can("platform.manage_tenants")) return <Navigate to="/" replace />;
  return children;
}
