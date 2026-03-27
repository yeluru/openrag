const CHAT_MODEL_KEY = "openrag_preferred_chat_model";

export const CHAT_MODEL_OPTIONS = [
  { id: "", label: "Server default", description: "Uses your deployment’s configured model." },
  { id: "gpt-4o-mini", label: "GPT-4o mini", description: "If your API supports user-facing model choice." },
  { id: "gpt-4o", label: "GPT-4o", description: "If your API supports user-facing model choice." },
] as const;

const ALLOWED_MODEL_IDS = new Set<string>(
  CHAT_MODEL_OPTIONS.map((o) => o.id).filter((id) => id.length > 0),
);

export function getPreferredChatModel(): string {
  try {
    const v = localStorage.getItem(CHAT_MODEL_KEY);
    if (v == null) return "";
    if (v === "") return "";
    return ALLOWED_MODEL_IDS.has(v) ? v : "";
  } catch {
    return "";
  }
}

export function setPreferredChatModel(modelId: string) {
  try {
    if (!modelId || !ALLOWED_MODEL_IDS.has(modelId)) localStorage.removeItem(CHAT_MODEL_KEY);
    else localStorage.setItem(CHAT_MODEL_KEY, modelId);
  } catch {
    /* ignore */
  }
}
