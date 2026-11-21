"""Transformer encoder blocks and encoder stack."""
from __future__ import annotations

import torch
import torch.nn as nn

from .attention import MultiHeadSelfAttention
from .embeddings import PositionalEmbedding, TokenEmbedding


class TransformerEncoderBlock(nn.Module):
    """Pre-norm Transformer encoder block with residual connections."""

    def __init__(self, embed_dim: int, num_heads: int, ff_dim: int, dropout: float = 0.0) -> None:
        super().__init__()
        if ff_dim <= 0:
            raise ValueError("ff_dim must be positive")
        self.norm1 = nn.LayerNorm(embed_dim)
        self.attention = MultiHeadSelfAttention(embed_dim, num_heads, dropout)
        self.dropout1 = nn.Dropout(dropout)
        self.norm2 = nn.LayerNorm(embed_dim)
        self.ffn = nn.Sequential(
            nn.Linear(embed_dim, ff_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(ff_dim, embed_dim),
        )
        self.dropout2 = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, attention_mask: torch.Tensor | None = None) -> torch.Tensor:
        x = x + self.dropout1(self.attention(self.norm1(x), attention_mask))
        x = x + self.dropout2(self.ffn(self.norm2(x)))
        return x


class TransformerEncoder(nn.Module):
    """Stacked Transformer encoder over token IDs with padding masks."""

    def __init__(
        self,
        vocab_size: int,
        embed_dim: int = 64,
        num_heads: int = 4,
        num_layers: int = 2,
        ff_dim: int = 128,
        max_len: int = 128,
        dropout: float = 0.1,
        padding_idx: int = 0,
    ) -> None:
        super().__init__()
        if vocab_size <= 0 or num_layers <= 0:
            raise ValueError("vocab_size and num_layers must be positive")
        self.padding_idx = padding_idx
        self.token_embedding = TokenEmbedding(vocab_size, embed_dim, padding_idx)
        self.positional_embedding = PositionalEmbedding(max_len, embed_dim, dropout)
        self.blocks = nn.ModuleList([
            TransformerEncoderBlock(embed_dim, num_heads, ff_dim, dropout)
            for _ in range(num_layers)
        ])
        self.norm = nn.LayerNorm(embed_dim)

    def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor | None = None) -> torch.Tensor:
        if input_ids.dim() != 2:
            raise ValueError("input_ids must be [batch, seq]")
        if attention_mask is not None and attention_mask.shape != input_ids.shape:
            raise ValueError("attention_mask must match input_ids shape")
        x = self.positional_embedding(self.token_embedding(input_ids))
        for block in self.blocks:
            x = block(x, attention_mask)
        return self.norm(x)
