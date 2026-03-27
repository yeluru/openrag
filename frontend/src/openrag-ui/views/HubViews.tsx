import { motion } from "framer-motion";
import { LogOut, MessageSquare, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthContext";
import { ThemeModeControl } from "@/components/ThemeModeControl";
import { listActivity, listAllHighlights, listChatSessions, listDocuments } from "@/api/openrag";
import type { DocumentSummary, Highlight } from "@/api/types";
import { humanApiError } from "@/api/client";
import { CHAT_MODEL_OPTIONS, getPreferredChatModel, setPreferredChatModel } from "@/lib/generationPrefs";
import { useOpenRAG } from "../context/OpenRAGContext";

export function ActiveChatsView() {
  const { userId, documents, openChat } = useOpenRAG();
  const [sessions, setSessions] = useState<Awaited<ReturnType<typeof listChatSessions>>>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    void (async () => {
      try {
        const rows = await listChatSessions(userId);
        if (!c) setSessions(rows);
      } catch (e) {
        if (!c) setErr(humanApiError(e));
      }
    })();
    return () => {
      c = true;
    };
  }, [userId]);

  const titleFor = (docId: string | null) => documents.find((d) => d.id === docId)?.title ?? "Document";

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:px-10">
      <h1 className="font-display text-3xl font-semibold">Active chats</h1>
      <p className="mt-2 text-sm text-[var(--or-ink-muted)]">Sessions from your OpenRAG backend.</p>
      {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}
      <ul className="mt-8 space-y-3">
        {sessions.length === 0 && !err ? (
          <p className="text-sm text-[var(--or-ink-muted)]">No chat sessions yet — open Chat on a document.</p>
        ) : null}
        {sessions.map((s) => (
          <motion.li
            key={s.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="or-card flex items-center gap-4 rounded-[12px] border border-[var(--or-border)] bg-[var(--or-cream)] p-4 shadow-or-card"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--or-ink)] text-[var(--or-cream)]">
              <MessageSquare className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[var(--or-ink)]">{s.title || titleFor(s.document_id)}</p>
              <p className="font-mono text-[10px] text-[var(--or-ink-muted)]">
                {new Date(s.updated_at).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              disabled={!s.document_id}
              onClick={() => s.document_id && openChat(s.document_id)}
              className="shrink-0 rounded-xl bg-[var(--or-amber)]/20 px-4 py-2 text-sm font-semibold text-[var(--or-ink)] disabled:opacity-40"
            >
              Open
            </button>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

export function HighlightsHubView() {
  const { userId } = useOpenRAG();
  const [rows, setRows] = useState<Highlight[]>([]);
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    void (async () => {
      try {
        const [hl, dl] = await Promise.all([listAllHighlights(userId), listDocuments(userId)]);
        if (!c) {
          setRows(hl);
          setDocs(dl);
        }
      } catch (e) {
        if (!c) setErr(humanApiError(e));
      }
    })();
    return () => {
      c = true;
    };
  }, [userId]);

  const titleFor = (docId: string) => docs.find((d) => d.id === docId)?.title ?? docId.slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:px-10">
      <h1 className="font-display text-3xl font-semibold">Highlights</h1>
      <p className="mt-2 text-sm text-[var(--or-ink-muted)]">Saved passages across your library.</p>
      {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}
      <ul className="mt-8 space-y-3">
        {rows.length === 0 && !err ? <p className="text-sm text-[var(--or-ink-muted)]">No highlights yet.</p> : null}
        {rows.map((h) => (
          <li key={h.id} className="rounded-[12px] border border-[var(--or-border)] bg-[var(--or-cream)] p-4 text-sm shadow-sm">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--or-amber)]">
              {titleFor(h.document_id)} · p.{h.page_start ?? "?"}
            </p>
            <p className="mt-2 leading-relaxed text-[var(--or-ink)]">{h.quote_text || "—"}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProgressHubView() {
  const { userId, documents } = useOpenRAG();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listActivity>>>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let c = false;
    void (async () => {
      try {
        const a = await listActivity(userId, { limit: 100 });
        if (!c) setRows(a);
      } catch (e) {
        if (!c) setErr(humanApiError(e));
      }
    })();
    return () => {
      c = true;
    };
  }, [userId]);

  const byType = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.activity_type] = (acc[r.activity_type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-10 sm:px-6 lg:px-10">
      <h1 className="font-display text-3xl font-semibold">Progress</h1>
      <p className="mt-2 text-sm text-[var(--or-ink-muted)]">Recent learning activity (last 100 events).</p>
      {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="or-card rounded-[12px] border border-[var(--or-border)] bg-[var(--or-cream)] p-6 text-center shadow-or-card">
          <TrendingUp className="mx-auto h-6 w-6 text-[var(--or-amber)]" />
          <p className="mt-3 font-display text-3xl font-bold">{documents.length}</p>
          <p className="text-sm font-medium text-[var(--or-ink)]">Documents</p>
        </div>
        <div className="or-card rounded-[12px] border border-[var(--or-border)] bg-[var(--or-cream)] p-6 text-center shadow-or-card sm:col-span-2">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--or-ink-muted)]">Activity mix</p>
          <ul className="mt-4 space-y-2 text-left text-sm">
            {Object.entries(byType)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <li key={k} className="flex justify-between border-b border-[var(--or-border)]/60 py-1">
                  <span className="text-[var(--or-ink-muted)]">{k}</span>
                  <span className="font-mono font-semibold">{v}</span>
                </li>
              ))}
            {rows.length === 0 ? <li className="text-[var(--or-ink-muted)]">No activity logged yet.</li> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function SettingsView() {
  const { displayName, logout } = useAuth();
  const [model, setModel] = useState(() => getPreferredChatModel());

  const onModelChange = (v: string) => {
    setModel(v);
    setPreferredChatModel(v);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-10">
      <h1 className="font-display text-3xl font-semibold">Settings</h1>
      <p className="mt-2 text-sm text-[var(--or-ink-muted)]">
        Signed in as <span className="font-medium text-[var(--or-ink)]">{displayName}</span>
      </p>

      <section className="mt-10 rounded-2xl border border-[var(--or-border)] bg-[var(--or-cream)] p-6 shadow-or-card">
        <h2 className="font-display text-lg font-semibold text-[var(--or-ink)]">Appearance</h2>
        <p className="mt-1 text-sm text-[var(--or-ink-muted)]">Use the sun / moon control to switch between light and dark.</p>
        <div className="mt-4">
          <ThemeModeControl />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--or-border)] bg-[var(--or-cream)] p-6 shadow-or-card">
        <h2 className="font-display text-lg font-semibold text-[var(--or-ink)]">Model (chat &amp; generation)</h2>
        <p className="mt-1 text-sm text-[var(--or-ink-muted)]">
          Preference is stored in this browser. Your API must accept or map this for it to change behavior—many deployments use
          one server-side model only.
        </p>
        <label htmlFor="or-chat-model" className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[var(--or-ink-muted)]">
          Preferred chat model
        </label>
        <select
          id="or-chat-model"
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="or-input mt-2 w-full rounded-xl px-4 py-3 text-sm"
        >
          {CHAT_MODEL_OPTIONS.map((o) => (
            <option key={o.id || "default"} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--or-border)] bg-[var(--or-cream)] p-6 shadow-or-card">
        <h2 className="font-display text-lg font-semibold text-[var(--or-ink)]">Account &amp; data</h2>
        <p className="mt-2 text-sm text-[var(--or-ink-muted)]">
          API base: <span className="font-mono text-xs">{import.meta.env.VITE_API_PREFIX ?? "/api/v1"}</span>
        </p>
        <p className="mt-2 text-sm text-[var(--or-ink-muted)]">
          A stable user id is stored locally for the <code className="font-mono text-xs">X-User-Id</code> header. Signing out
          returns you to the home page; your library data remains on the server under that id until you clear site data.
        </p>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-900 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/60"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </section>
    </div>
  );
}
