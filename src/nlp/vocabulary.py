"""Vocabulary construction and token/ID conversion."""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Iterable, List, Sequence

from .tokenizer import Tokenizer

PAD_TOKEN = "<pad>"
UNK_TOKEN = "<unk>"


class Vocabulary:
    """Bidirectional token/ID mapping with PAD and UNK tokens."""

    def __init__(self, tokens: Iterable[str] | None = None) -> None:
        self.token_to_id: dict[str, int] = {PAD_TOKEN: 0, UNK_TOKEN: 1}
        self.id_to_token: dict[int, str] = {0: PAD_TOKEN, 1: UNK_TOKEN}
        if tokens:
            self.add_tokens(tokens)

    @property
    def pad_id(self) -> int:
        return self.token_to_id[PAD_TOKEN]

    @property
    def unk_id(self) -> int:
        return self.token_to_id[UNK_TOKEN]

    def __len__(self) -> int:
        return len(self.token_to_id)

    def add_token(self, token: str) -> int:
        if not token:
            raise ValueError("token must be non-empty")
        if token not in self.token_to_id:
            idx = len(self.token_to_id)
            self.token_to_id[token] = idx
            self.id_to_token[idx] = token
        return self.token_to_id[token]

    def add_tokens(self, tokens: Iterable[str]) -> None:
        for token in tokens:
            self.add_token(token)

    @classmethod
    def build_from_texts(cls, texts: Sequence[str], min_freq: int = 1, max_size: int | None = None) -> "Vocabulary":
        tokenizer = Tokenizer()
        counter: Counter[str] = Counter()
        for text in texts:
            counter.update(tokenizer.tokenize(text))
        vocab = cls()
        items = [(t, c) for t, c in counter.most_common() if c >= min_freq]
        if max_size is not None:
            items = items[: max(0, max_size - len(vocab))]
        vocab.add_tokens([t for t, _ in items])
        return vocab

    def encode(self, tokens: Sequence[str]) -> List[int]:
        return [self.token_to_id.get(t, self.unk_id) for t in tokens]

    def decode(self, ids: Sequence[int], skip_special: bool = True) -> str:
        tokens = []
        for i in ids:
            token = self.id_to_token.get(int(i))
            if token is None:
                raise KeyError(f"Unknown token id: {i}")
            if skip_special and token in (PAD_TOKEN, UNK_TOKEN):
                continue
            tokens.append(token)
        return " ".join(tokens)

    def save(self, path: str | Path) -> None:
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        Path(path).write_text(json.dumps(self.token_to_id, indent=2))

    @classmethod
    def load(cls, path: str | Path) -> "Vocabulary":
        data = json.loads(Path(path).read_text())
        vocab = cls()
        vocab.token_to_id = {t: int(i) for t, i in data.items()}
        vocab.id_to_token = {int(i): t for t, i in data.items()}
        return vocab
