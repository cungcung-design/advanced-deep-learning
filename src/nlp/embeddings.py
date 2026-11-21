"""Padding, truncation, attention masks, and embedding layers."""
from __future__ import annotations

import math
from typing import List, Sequence, Tuple

import torch
import torch.nn as nn


def pad_sequences(
    sequences: Sequence[Sequence[int]],
    max_length: int,
    pad_id: int = 0,
    truncation: bool = True,
    padding: str = "max_length",
) -> Tuple[torch.Tensor, torch.Tensor]:
    """Pad/truncate token ID sequences and return attention masks."""
    if max_length <= 0:
        raise ValueError("max_length must be positive")
    if padding not in ("max_length", "longest"):
        raise ValueError("padding must be 'max_length' or 'longest'")
    if not sequences:
        raise ValueError("sequences must not be empty")

    lengths = [len(s) for s in sequences]
    if truncation:
        lengths = [min(n, max_length) for n in lengths]
    elif any(n > max_length for n in lengths):
        raise ValueError("sequence exceeds max_length and truncation is disabled")

    target = max_length if padding == "max_length" else max(lengths)
    ids = torch.full((len(sequences), target), pad_id, dtype=torch.long)
    mask = torch.zeros((len(sequences), target), dtype=torch.long)
    for row, seq in enumerate(sequences):
        seq = list(seq)[:target]
        ids[row, : len(seq)] = torch.tensor(seq, dtype=torch.long)
        mask[row, : len(seq)] = 1
    return ids, mask


class TokenEmbedding(nn.Module):
    """Learnable token embedding table with padding index."""

    def __init__(self, vocab_size: int, embed_dim: int, padding_idx: int = 0) -> None:
        super().__init__()
        if vocab_size <= 0 or embed_dim <= 0:
            raise ValueError("vocab_size and embed_dim must be positive")
        if not 0 <= padding_idx < vocab_size:
            raise ValueError("padding_idx out of range")
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=padding_idx)

    def forward(self, input_ids: torch.Tensor) -> torch.Tensor:
        return self.embedding(input_ids)


class PositionalEmbedding(nn.Module):
    """Fixed sinusoidal positional embeddings."""

    def __init__(self, max_len: int, embed_dim: int, dropout: float = 0.0) -> None:
        super().__init__()
        if max_len <= 0 or embed_dim <= 0:
            raise ValueError("max_len and embed_dim must be positive")
        self.dropout = nn.Dropout(dropout)
        position = torch.arange(max_len).unsqueeze(1)
        div = torch.exp(torch.arange(0, embed_dim, 2) * (-math.log(10000.0) / embed_dim))
        pe = torch.zeros(max_len, embed_dim)
        pe[:, 0::2] = torch.sin(position * div)
        pe[:, 1::2] = torch.cos(position * div[: pe[:, 1::2].shape[1]])
        self.register_buffer("pe", pe.unsqueeze(0), persistent=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.size(1) > self.pe.size(1):
            raise ValueError(f"sequence length {x.size(1)} exceeds max_len {self.pe.size(1)}")
        return self.dropout(x + self.pe[:, : x.size(1)])


def text_to_tensors(
    texts: Sequence[str],
    vocab,
    tokenizer=None,
    max_length: int = 16,
) -> Tuple[torch.Tensor, torch.Tensor]:
    """Convert raw texts to padded ID tensor and attention mask."""
    from .tokenizer import Tokenizer

    tokenizer = tokenizer or Tokenizer()
    encoded: List[List[int]] = [vocab.encode(tokenizer.tokenize(t)) for t in texts]
    return pad_sequences(encoded, max_length=max_length, pad_id=vocab.pad_id)
