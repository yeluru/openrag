/** API shapes aligned with OpenRAG FastAPI OpenAPI */

export type Scope = {
  document_id: string;
  chapter_id?: string | null;
  section_id?: string | null;
  chapter_label?: string | null;
  section_label?: string | null;
  page_start?: number | null;
  page_end?: number | null;
};

export type DocumentSummary = {
  id: string;
  title: string;
  page_count: number | null;
  created_at: string;
};

export type ParserDescriptor = {
  id: string;
  version: string;
  canonical_mime: string;
  extensions: string[];
};

export type SupportedFormatsResponse = {
  parsers: ParserDescriptor[];
  canonical_mime_types: string[];
  extensions: string[];
  upload_content_types: string[];
};

export type DocumentEngagement = {
  document_id: string;
  event_count: number;
  last_activity_at: string | null;
};

export type ActivityRow = {
  id: string;
  activity_type: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export type ChatSessionOut = {
  id: string;
  document_id: string | null;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessageOut = {
  id: string;
  role: string;
  content: string;
  structured_response: Record<string, unknown> | null;
  created_at: string;
};

export type IngestionJobSummary = {
  job_id: string;
  status: string;
  error_message: string | null;
  progress: Record<string, unknown>;
};

export type DocumentDetail = {
  id: string;
  title: string;
  original_filename: string;
  /** Canonical MIME from upload; drives whether the reader uses PDF embed vs text preview. */
  mime_type: string;
  page_count: number | null;
  author_inferred: string | null;
  metadata: Record<string, unknown>;
  ingestion: IngestionJobSummary | null;
  created_at: string;
};

export type IngestionStatusPayload = {
  job_id: string;
  status: string;
  error_message: string | null;
  error_detail: unknown;
  progress: Record<string, unknown>;
};

export type StructureNode = {
  id: string;
  kind: string;
  label: string;
  order_index: number;
  page_start: number | null;
  page_end: number | null;
  children: StructureNode[];
};

export type Citation = {
  chunk_id: string;
  document_id: string;
  page_start: number | null;
  page_end: number | null;
  chapter_label: string | null;
  section_label: string | null;
  snippet: string;
};

export type SourcePassage = {
  chunk_id: string;
  score: number;
  text: string;
  page_start: number | null;
  page_end: number | null;
  chapter_label: string | null;
  section_label: string | null;
};

export type RetrievalMeta = {
  top_k: number;
  used_scope_filters: boolean;
  insufficient_evidence: boolean;
  min_score_threshold: number | null;
  timing_ms: number | null;
  debug: Record<string, unknown> | null;
};

export type ChatAskResponse = {
  session_id: string;
  answer: string;
  mode: string;
  scope: Record<string, unknown>;
  citations: Citation[];
  source_passages: SourcePassage[];
  retrieval_meta: RetrievalMeta;
};

export type SearchResult = {
  chunk_id: string;
  document_id: string;
  score: number;
  text: string;
  page_start: number | null;
  page_end: number | null;
  chapter_label: string | null;
  section_label: string | null;
  section_id: string | null;
  chunk_index: number | null;
};

export type SemanticSearchResponse = {
  results: SearchResult[];
  citations: Citation[];
  retrieval_meta: RetrievalMeta;
};

export type QuizQuestion = {
  id: string;
  question_type: string;
  question_text: string;
  options: unknown;
  correct_answer: string;
  explanation: string | null;
  citations: Record<string, unknown>[];
  source_passages: Record<string, unknown>[];
  order_index: number;
};

export type QuizGenerateResponse = {
  quiz_id: string;
  title: string;
  difficulty: string;
  questions: QuizQuestion[];
};

export type FlashcardItem = {
  id: string;
  front: string;
  back: string;
  difficulty: string | null;
  citations: Record<string, unknown>[];
  source_passages: Record<string, unknown>[];
  ai_generated: boolean;
};

export type NoteAssistResponse = {
  note_id: string;
  title: string | null;
  content: string;
  citations: Record<string, unknown>[];
  ai_generated: boolean;
};

export type ReadthroughChunk = {
  chunk_id: string;
  text: string;
  page_start: number | null;
  page_end: number | null;
  chapter_label: string | null;
  section_label: string | null;
};

export type SectionReadthroughResponse = {
  section_id: string;
  section_label: string | null;
  chunk_count: number;
  chunks: ReadthroughChunk[];
};

export type DocumentReadthroughResponse = {
  document_id: string;
  chunk_count: number;
  chunks: ReadthroughChunk[];
};

export type Highlight = {
  id: string;
  document_id: string;
  chunk_id: string | null;
  page_start: number | null;
  page_end: number | null;
  quote_text: string | null;
  created_at: string;
};
