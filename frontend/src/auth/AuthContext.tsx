import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const SESSION_KEY = "openrag_session";

export type Session = {
  displayName: string;
};

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (o && typeof o === "object" && "displayName" in o) {
      const name = String((o as { displayName: unknown }).displayName || "").trim();
      if (name.length > 0) return { displayName: name.slice(0, 120) };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

type AuthContextValue = {
  isLoggedIn: boolean;
  displayName: string | null;
  login: (displayName: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readSession());

  const login = useCallback((displayName: string) => {
    const name = displayName.trim() || "Reader";
    const s = { displayName: name.slice(0, 120) };
    writeSession(s);
    setSession(s);
  }, []);

  const logout = useCallback(() => {
    writeSession(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoggedIn: session != null,
      displayName: session?.displayName ?? null,
      login,
      logout,
    }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
