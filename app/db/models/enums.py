"""Shared database enums."""

import enum


class IngestionStatus(str, enum.Enum):
    uploaded = "uploaded"
    parsing = "parsing"
    structure_extracting = "structure_extracting"
    chunking = "chunking"
    embedding = "embedding"
    indexing = "indexing"
    ready = "ready"
    failed = "failed"


class SectionKind(str, enum.Enum):
    document_root = "document_root"
    chapter = "chapter"
    section = "section"
    logical = "logical"


class QuizQuestionType(str, enum.Enum):
    multiple_choice = "multiple_choice"
    true_false = "true_false"
    short_answer = "short_answer"
    concept_explanation = "concept_explanation"


class Difficulty(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class ChatRole(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class LearningActivityType(str, enum.Enum):
    chat = "chat"
    quiz = "quiz"
    quiz_attempt = "quiz_attempt"
    flashcard = "flashcard"
    note = "note"
    search = "search"
    read = "read"
    highlight = "highlight"
