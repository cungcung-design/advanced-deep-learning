"""Scaled dot-product and multi-head self-attention."""
from __future__ import annotations

import math

import torch
import torch.nn as nn


def scaled_dot_product_attention(
    query: torch.Tensor,
    key: torch.Tensor,
    value: torch.Tensor,
    attention_mask: torch.Tensor | None = None,
    dropout: nn.Dropout | None = None,
) -> tuple[torch.Tensor, torch.Tensor]:
    """Compute attention for tensors shaped [batch, heads, seq, head_dim]."""
    if query.dim() != 4 or key.dim() != 4 or value.dim() != 4:
        raise ValueError("query, key, value must be 4D [batch, heads, seq, dim]")
    head_dim = query.size(-1)
    if key.size(-1) != head_dim or value.size(-1) != head_dim:
        raise ValueError("query, key, value must share head dimension")

    scores = torch.matmul(query, key.transpose(-2, -1)) / math.sqrt(head_dim)
    if attention_mask is not None:
        if attention_mask.dim() == 2:
            mask = attention_mask[:, None, None, :].to(torch.bool)
        elif attention_mask.dim() == 4:
            mask = attention_mask.to(torch.bool)
        else:
            raise ValueError("attention_mask must be 2D [batch, seq] or 4D [batch, 1, 1, seq]")
        scores = scores.masked_fill(~mask, torch.finfo(scores.dtype).min)

    weights = torch.softmax(scores, dim=-1)
    if dropout is not None:
        weights = dropout(weights)
    output = torch.matmul(weights, value)
    return output, weights


class MultiHeadSelfAttention(nn.Module):
    """Multi-head self-attention with batch-first tensors."""

    def __init__(self, embed_dim: int, num_heads: int, dropout: float = 0.0) -> None:
        super().__init__()
        if embed_dim <= 0 or num_heads <= 0:
            raise ValueError("embed_dim and num_heads must be positive")
        if embed_dim % num_heads != 0:
            raise ValueError("embed_dim must be divisible by num_heads")
        self.embed_dim = embed_dim
        self.num_heads = num_heads
        self.head_dim = embed_dim // num_heads
        self.q_proj = nn.Linear(embed_dim, embed_dim)
        self.k_proj = nn.Linear(embed_dim, embed_dim)
        self.v_proj = nn.Linear(embed_dim, embed_dim)
        self.out_proj = nn.Linear(embed_dim, embed_dim)
        self.dropout = nn.Dropout(dropout)

    def _split_heads(self, x: torch.Tensor) -> torch.Tensor:
        batch, seq, _ = x.shape
        return x.view(batch, seq, self.num_heads, self.head_dim).transpose(1, 2)

    def _merge_heads(self, x: torch.Tensor) -> torch.Tensor:
        batch, _, seq, _ = x.shape
        return x.transpose(1, 2).contiguous().view(batch, seq, self.embed_dim)

    def forward(self, x: torch.Tensor, attention_mask: torch.Tensor | None = None) -> torch.Tensor:
        if x.dim() != 3 or x.size(-1) != self.embed_dim:
            raise ValueError(f"expected [batch, seq, {self.embed_dim}] input")
        q = self._split_heads(self.q_proj(x))
        k = self._split_heads(self.k_proj(x))
        v = self._split_heads(self.v_proj(x))
        out, _ = scaled_dot_product_attention(q, k, v, attention_mask, self.dropout)
        return self.out_proj(self._merge_heads(out))
