"""Text normalization utilities."""

import re
import unicodedata


def normalize_whitespace(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def estimate_tokens(text: str) -> int:
    """Rough token estimate (~4 chars per token) when tiktoken unavailable."""
    if not text:
        return 0
    return max(1, len(text) // 4)
