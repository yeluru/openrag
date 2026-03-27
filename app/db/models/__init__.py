"""Import all models for Alembic and metadata registration."""

from app.db.models.activity import LearningActivity
from app.db.models.chat import ChatMessage, ChatSession
from app.db.models.chunk import Chunk
from app.db.models.document import Document
from app.db.models.enums import (
    ChatRole,
    Difficulty,
    IngestionStatus,
    LearningActivityType,
    QuizQuestionType,
    SectionKind,
)
from app.db.models.flashcard import Flashcard
from app.db.models.highlight import HighlightBookmark
from app.db.models.ingestion import IngestionJob
from app.db.models.note import Note
from app.db.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.db.models.section import DocumentSection
from app.db.models.user import User

__all__ = [
    "User",
    "Document",
    "DocumentSection",
    "Chunk",
    "IngestionJob",
    "ChatSession",
    "ChatMessage",
    "Quiz",
    "QuizQuestion",
    "QuizAttempt",
    "Flashcard",
    "Note",
    "HighlightBookmark",
    "LearningActivity",
    "IngestionStatus",
    "SectionKind",
    "QuizQuestionType",
    "Difficulty",
    "ChatRole",
    "LearningActivityType",
]
