const FAV = "openrag_favorites_v1";
const DONE = "openrag_completed_v1";

export function loadIdSet(key: typeof FAV | typeof DONE): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const a = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(a) ? (a as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveIdSet(key: typeof FAV | typeof DONE, ids: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

export const favoriteStorage = { key: FAV, load: () => loadIdSet(FAV), save: (s: Set<string>) => saveIdSet(FAV, s) };
export const completedStorage = { key: DONE, load: () => loadIdSet(DONE), save: (s: Set<string>) => saveIdSet(DONE, s) };

export function notesKey(docId: string, page: number) {
  return `openrag_notes_${docId}_p${page}`;
}

const AI_SUMMARY_PREFIX = "openrag_ai_summary_";

export function aiSummaryKey(docId: string, page: number) {
  return `${AI_SUMMARY_PREFIX}${docId}_p${page}`;
}

/** Load cached AI summaries for a document from localStorage (keys openrag_ai_summary_<docId>_p<n>). */
export function loadAiSummariesForDoc(docId: string): Record<number, string> {
  const out: Record<number, string> = {};
  const needle = `${AI_SUMMARY_PREFIX}${docId}_p`;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(needle)) continue;
      const m = k.match(/_p(\d+)$/);
      if (!m) continue;
      const p = parseInt(m[1], 10);
      const v = localStorage.getItem(k);
      if (v != null && v.length > 0) out[p] = v;
    }
  } catch {
    /* ignore */
  }
  return out;
}
