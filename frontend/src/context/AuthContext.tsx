import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setAccessToken } from "../lib/api";
import { setBaseCurrencyCode } from "../lib/currency";

interface AuthUser {
  displayName: string;
  role: string;
  permissions: string[];
  mustChangePassword: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticating: boolean;
  // Returns the fresh permissions list so the caller can decide where to route the user
  // (SuperAdmin -> /admin/dashboard, everyone else -> /) without waiting on a state re-render.
  login: (email: string, password: string) => Promise<string[]>;
  logout: () => void;
  can: (permission: string) => boolean;
  completePasswordChange: (accessToken: string, displayName: string, role: string, permissions: string[], baseCurrencyCode: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("erp:session-expired", onExpired);
    return () => window.removeEventListener("erp:session-expired", onExpired);
  }, []);

  const login = async (email: string, password: string) => {
    setIsAuthenticating(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setAccessToken(data.accessToken);
      setBaseCurrencyCode(data.baseCurrencyCode);
      setUser({ displayName: data.displayName, role: data.role, permissions: data.permissions, mustChangePassword: data.mustChangePassword });
      return data.permissions as string[];
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = () => {
    setAccessToken(null);
    setUser(null);
  };

  // Called once /auth/change-password succeeds: swaps in the fresh token it returns
  // (the old one is permanently stamped mustChangePassword and can't be un-stamped).
  const completePasswordChange = (accessToken: string, displayName: string, role: string, permissions: string[], baseCurrencyCode: string) => {
    setAccessToken(accessToken);
    setBaseCurrencyCode(baseCurrencyCode);
    setUser({ displayName, role, permissions, mustChangePassword: false });
  };

  const can = (permission: string) => user?.permissions.includes(permission) ?? false;

  const value = useMemo(
    () => ({ user, isAuthenticating, login, logout, can, completePasswordChange }),
    [user, isAuthenticating]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
