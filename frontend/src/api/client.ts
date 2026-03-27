const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? "/api/v1";

export type ApiError = {
  status: number;
  message: string;
  detail?: unknown;
};

function getApiKey(): string | undefined {
  const k = import.meta.env.VITE_API_KEY;
  return k && String(k).trim() ? String(k).trim() : undefined;
}

export function buildHeaders(userId: string): HeadersInit {
  const h: Record<string, string> = {
    "X-User-Id": userId,
  };
  const key = getApiKey();
  if (key) h["X-Api-Key"] = key;
  return h;
}

export async function apiJson<T>(
  userId: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${API_PREFIX}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(buildHeaders(userId));
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    let message = res.statusText || "Request failed";
    let detail: unknown;
    try {
      const j = await res.json();
      detail = j;
      if (typeof j?.detail === "string") message = j.detail;
      else if (Array.isArray(j?.detail)) message = j.detail.map((x: { msg?: string }) => x.msg).join("; ");
    } catch {
      /* ignore */
    }
    const err: ApiError = { status: res.status, message, detail };
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function humanApiError(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as ApiError).message);
  }
  return "Something went wrong. Please try again.";
}
