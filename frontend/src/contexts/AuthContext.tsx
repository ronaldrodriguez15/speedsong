import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AuthUser, LoginCredentials } from "../types/auth";
import { loginRequest } from "../services/auth.service";
import { api, apiError } from "../services/api";
interface AuthContextValue {
  user: AuthUser | null; isAuthenticated: boolean; isLoading: boolean; isLoggingIn: boolean;
  isLoggingOut: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>; refreshUser: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const logoutPending = useRef(false);
  const [error, setError] = useState("");
  const refreshUser = useCallback(async () => { setUser((await api.get<AuthUser>("/user")).data); }, []);
  useEffect(() => {
    try { localStorage.removeItem("speedsong_token"); localStorage.removeItem("speedsong_user"); } catch { /* Cookies handle authentication when storage is blocked. */ }
    const expired = () => setUser(null);
    window.addEventListener("auth:expired", expired);
    const controller = new AbortController();
    api.get<AuthUser>("/user", { signal: controller.signal, feedback: { ignoreUnauthorized: true, history: false, pending: "Validando sesión...", success: "Sesión verificada." } })
      .then(response => { if (!controller.signal.aborted) setUser(response.data); })
      .catch(() => { if (!controller.signal.aborted) setUser(null); })
      .finally(() => { if (!controller.signal.aborted) setIsLoading(false); });
    return () => { controller.abort(); window.removeEventListener("auth:expired", expired); };
  }, [refreshUser]);
  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoggingIn(true);
    try { setUser(await loginRequest(credentials)); setError(""); }
    finally { setIsLoggingIn(false); }
  }, []);
  const logout = useCallback(async () => {
    if (logoutPending.current) return;
    logoutPending.current = true;
    setIsLoggingOut(true);
    try { await api.post("/logout"); setUser(null); setError(""); }
    catch (e) { setError(apiError(e)); }
    finally { logoutPending.current = false; setIsLoggingOut(false); }
  }, []);
  const value = useMemo(() => ({user, isAuthenticated: Boolean(user), isLoading, isLoggingIn, isLoggingOut, login, logout, refreshUser}), [user, isLoading, isLoggingIn, isLoggingOut, login, logout, refreshUser]);
  return <AuthContext.Provider value={value}>{error && <div role="alert" className="bg-rose-50 dark:bg-rose-950 p-4 text-rose-700 dark:text-rose-300">{error}</div>}{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth requiere AuthProvider.");
  return context;
}
