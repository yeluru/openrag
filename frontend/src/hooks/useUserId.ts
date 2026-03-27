import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "openrag_user_id";

function randomUuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function useUserId(): [string, (id: string) => void] {
  const [id, setId] = useState<string>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s && /^[0-9a-f-]{36}$/i.test(s)) return s;
    } catch {
      /* ignore */
    }
    const u = randomUuid();
    try {
      localStorage.setItem(STORAGE_KEY, u);
    } catch {
      /* ignore */
    }
    return u;
  });

  const update = useCallback((next: string) => {
    if (!/^[0-9a-f-]{36}$/i.test(next.trim())) return;
    const v = next.trim();
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* ignore */
    }
    setId(v);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, [id]);

  return [id, update];
}
