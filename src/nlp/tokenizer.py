"""Text normalization and tokenization utilities."""
from __future__ import annotations

import re
import unicodedata
from typing import List

_TOKEN_RE = re.compile(r"[a-z0-9]+(?:'[a-z]+)?|[^\sa-z0-9]", re.IGNORECASE)


def normalize_text(text: str) -> str:
    """Normalize text: Unicode NFKC, lowercase, collapse whitespace."""
    if not isinstance(text, str):
        raise TypeError("text must be a string")
    text = unicodedata.normalize("NFKC", text).lower()
    return re.sub(r"\s+", " ", text).strip()


class Tokenizer:
    """Simple regex tokenizer producing word and punctuation tokens."""

    def __init__(self, normalize: bool = True) -> None:
        self.normalize = normalize

    def tokenize(self, text: str) -> List[str]:
        if not isinstance(text, str):
            raise TypeError("text must be a string")
        if self.normalize:
            text = normalize_text(text)
        if not text:
            return []
        return _TOKEN_RE.findall(text)
