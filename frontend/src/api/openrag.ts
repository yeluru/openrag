import { apiJson, buildHeaders } from "./client";
import type {
  ActivityRow,
  ChatAskResponse,
  ChatMessageOut,
  ChatSessionOut,
  DocumentDetail,
  DocumentEngagement,
  DocumentReadthroughResponse,
  DocumentSummary,
  SupportedFormatsResponse,
  FlashcardItem,
  Highlight,
  IngestionStatusPayload,
  NoteAssistResponse,
  QuizGenerateResponse,
  Scope,
  SectionReadthroughResponse,
  SemanticSearchResponse,
  StructureNode,
} from "./types";

const API_PREFIX = import.meta.env.VITE_API_PREFIX ?? "/api/v1";

export async function bootstrapUser(userId: string) {
  return apiJson<{ id: string; email: string | null; display_name: string | null }>(
    userId,
    "/users/bootstrap",
    { method: "POST" },
  );
}

export async function listDocuments(userId: string) {
  return apiJson<DocumentSummary[]>(userId, "/documents");
}

/** Ingestible formats (no user header required). Uses API key if VITE_API_KEY is set. */
export async function getSupportedDocumentFormats(): Promise<SupportedFormatsResponse> {
  const headers: Record<string, string> = {};
  const key = import.meta.env.VITE_API_KEY;
  if (key && String(key).trim()) headers["X-Api-Key"] = String(key).trim();
  const res = await fetch(`${API_PREFIX}/documents/supported-formats`, { headers });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw { status: res.status, message: j.detail || res.statusText };
  }
  return res.json() as Promise<SupportedFormatsResponse>;
}

export async function uploadDocument(userId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const headers: Record<string, string> = { "X-User-Id": userId };
  const key = import.meta.env.VITE_API_KEY;
  if (key && String(key).trim()) headers["X-Api-Key"] = String(key).trim();
  const res = await fetch(`${API_PREFIX}/documents`, { method: "POST", headers, body: fd });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw { status: res.status, message: j.detail || res.statusText };
  }
  return res.json() as Promise<{
    document_id: string;
    ingestion_job_id: string;
    status: string;
  }>;
}

export async function getDocument(userId: string, documentId: string) {
  return apiJson<DocumentDetail>(userId, `/documents/${documentId}`);
}

/** Fetch the original file with auth; returns a blob: URL you must revoke when done. */
export async function fetchDocumentPdfObjectUrl(userId: string, documentId: string): Promise<string> {
  const url = `${API_PREFIX}/documents/${documentId}/file`;
  const res = await fetch(url, { headers: buildHeaders(userId) });
  if (!res.ok) {
    let message = res.statusText || "Failed to load document";
    try {
      const j = await res.json();
      if (typeof j?.detail === "string") message = j.detail;
    } catch {
      /* ignore */
    }
    throw { status: res.status, message };
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function getIngestion(userId: string, documentId: string) {
  return apiJson<IngestionStatusPayload>(userId, `/documents/${documentId}/ingestion`);
}

export async function getStructure(userId: string, documentId: string) {
  return apiJson<{ document_id: string; sections: StructureNode[] }>(
    userId,
    `/documents/${documentId}/structure`,
  );
}

export async function getSectionReadthrough(userId: string, documentId: string, sectionId: string) {
  return apiJson<SectionReadthroughResponse>(
    userId,
    `/documents/${documentId}/sections/${sectionId}/readthrough`,
  );
}

export async function getDocumentReadthrough(userId: string, documentId: string) {
  return apiJson<DocumentReadthroughResponse>(userId, `/documents/${documentId}/readthrough`);
}

export async function listDocumentEngagement(userId: string) {
  return apiJson<DocumentEngagement[]>(userId, "/activity/document-engagement");
}

export async function listActivity(userId: string, params?: { limit?: number; activity_type?: string }) {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.activity_type) q.set("activity_type", params.activity_type);
  const suffix = q.toString() ? `?${q}` : "";
  return apiJson<ActivityRow[]>(userId, `/activity${suffix}`);
}

export async function listAllHighlights(userId: string, documentId?: string | null) {
  const q = new URLSearchParams();
  if (documentId) q.set("document_id", documentId);
  const suffix = q.toString() ? `?${q}` : "";
  return apiJson<Highlight[]>(userId, `/highlights${suffix}`);
}

export async function listChatSessions(userId: string, documentId?: string | null) {
  const q = new URLSearchParams();
  if (documentId) q.set("document_id", documentId);
  const suffix = q.toString() ? `?${q}` : "";
  return apiJson<ChatSessionOut[]>(userId, `/chat/sessions${suffix}`);
}

export async function getChatMessages(userId: string, sessionId: string) {
  return apiJson<ChatMessageOut[]>(userId, `/chat/sessions/${sessionId}/messages`);
}

export async function chatAsk(
  userId: string,
  body: {
    question: string;
    scope: Scope;
    mode?: string;
    session_id?: string | null;
    top_k?: number | null;
  },
) {
  return apiJson<ChatAskResponse>(userId, "/chat/ask", {
    method: "POST",
    body: JSON.stringify({
      question: body.question,
      scope: body.scope,
      mode: body.mode ?? "beginner_explanation",
      session_id: body.session_id ?? undefined,
      top_k: body.top_k ?? undefined,
    }),
  });
}

export async function semanticSearch(
  userId: string,
  body: { query: string; scope: Scope; top_k?: number; min_score?: number | null },
) {
  return apiJson<SemanticSearchResponse>(userId, "/search/semantic", {
    method: "POST",
    body: JSON.stringify({
      query: body.query,
      scope: body.scope,
      top_k: body.top_k ?? 12,
      min_score: body.min_score ?? 0,
    }),
  });
}

export async function generateQuiz(
  userId: string,
  body: {
    scope: Scope;
    topic?: string | null;
    num_questions?: number;
    difficulty?: string;
    question_types?: string[] | null;
  },
) {
  return apiJson<QuizGenerateResponse>(userId, "/quizzes/generate", {
    method: "POST",
    body: JSON.stringify({
      scope: body.scope,
      topic: body.topic ?? undefined,
      num_questions: body.num_questions ?? 5,
      difficulty: body.difficulty ?? "intermediate",
      question_types: body.question_types ?? undefined,
    }),
  });
}

export async function submitQuizAttempt(
  userId: string,
  quizId: string,
  answers: Record<string, string>,
) {
  return apiJson<{
    attempt_id: string;
    score: number;
    score_fraction: number;
    per_question: Record<string, boolean | null>;
  }>(userId, `/quizzes/${quizId}/attempts`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export async function generateFlashcards(
  userId: string,
  body: { scope: Scope; topic?: string | null; count?: number },
) {
  return apiJson<{ flashcards: FlashcardItem[] }>(userId, "/flashcards/generate", {
    method: "POST",
    body: JSON.stringify({
      scope: body.scope,
      topic: body.topic ?? undefined,
      count: body.count ?? 10,
    }),
  });
}

export async function notesAssist(
  userId: string,
  body: {
    scope: Scope;
    instruction: string;
    title?: string | null;
    top_k?: number;
  },
) {
  return apiJson<NoteAssistResponse>(userId, "/notes/assist", {
    method: "POST",
    body: JSON.stringify({
      scope: body.scope,
      instruction: body.instruction,
      title: body.title ?? undefined,
      top_k: body.top_k ?? 10,
    }),
  });
}

export async function listHighlights(userId: string, documentId: string) {
  return apiJson<Highlight[]>(userId, `/documents/${documentId}/highlights`);
}

export async function createHighlight(
  userId: string,
  documentId: string,
  body: {
    chunk_id?: string | null;
    page_start?: number | null;
    page_end?: number | null;
    quote_text?: string | null;
  },
) {
  return apiJson<Highlight>(userId, `/documents/${documentId}/highlights`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteHighlight(userId: string, highlightId: string) {
  await apiJson<void>(userId, `/highlights/${highlightId}`, { method: "DELETE" });
}
