export type DocumentId = string;

export type LibraryFilter = "all" | "recent" | "completed" | "favorites";

export type AppView =
  | "library"
  | "reader"
  | "chat"
  | "quiz"
  | "active_chats"
  | "highlights_hub"
  | "progress_hub"
  | "settings";

export type ReaderTab = "highlights" | "notes" | "summary" | "transcript";
