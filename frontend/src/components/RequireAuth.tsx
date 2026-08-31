import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ForcedPasswordChange from "../pages/ForcedPasswordChange";

export default function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <ForcedPasswordChange />;
  return children;
}
