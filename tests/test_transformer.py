"""Tests for Transformer attention and encoder."""
from __future__ import annotations

import pytest
import torch

from src.nlp import (
    MultiHeadSelfAttention,
    TransformerEncoder,
    TransformerEncoderBlock,
    scaled_dot_product_attention,
)


def test_scaled_dot_product_attention_shape():
    q = torch.randn(2, 3, 5, 4)
    k = torch.randn(2, 3, 5, 4)
    v = torch.randn(2, 3, 5, 4)
    out, weights = scaled_dot_product_attention(q, k, v)
    assert out.shape == (2, 3, 5, 4)
    assert weights.shape == (2, 3, 5, 5)
    assert torch.allclose(weights.sum(-1), torch.ones(2, 3, 5), atol=1e-6)


def test_attention_mask_zeros_padding_weights():
    q = torch.zeros(1, 1, 3, 4)
    k = torch.zeros(1, 1, 3, 4)
    v = torch.randn(1, 1, 3, 4)
    mask = torch.tensor([[1, 1, 0]])
    out, weights = scaled_dot_product_attention(q, k, v, mask)
    assert torch.allclose(weights[..., 2], torch.zeros(1, 1, 3), atol=1e-6)
    assert out.shape == (1, 1, 3, 4)


def test_attention_rejects_bad_dims():
    with pytest.raises(ValueError):
        scaled_dot_product_attention(torch.randn(2, 3), torch.randn(2, 3), torch.randn(2, 3))


def test_multihead_shape_and_config():
    mha = MultiHeadSelfAttention(embed_dim=16, num_heads=4)
    out = mha(torch.randn(2, 5, 16))
    assert out.shape == (2, 5, 16)
    with pytest.raises(ValueError):
        MultiHeadSelfAttention(embed_dim=10, num_heads=4)
    with pytest.raises(ValueError):
        mha(torch.randn(2, 5, 8))


def test_multihead_head_split_concat_identity():
    mha = MultiHeadSelfAttention(embed_dim=8, num_heads=2)
    x = torch.randn(3, 4, 8)
    split = mha._split_heads(x)
    assert split.shape == (3, 2, 4, 4)
    merged = mha._merge_heads(split)
    assert torch.allclose(merged, x)


def test_encoder_block_shape():
    block = TransformerEncoderBlock(embed_dim=16, num_heads=4, ff_dim=32, dropout=0.0)
    x = torch.randn(2, 6, 16)
    mask = torch.ones(2, 6, dtype=torch.long)
    assert block(x, mask).shape == (2, 6, 16)


def test_encoder_stack_multiple_layers():
    model = TransformerEncoder(vocab_size=20, embed_dim=16, num_heads=4, num_layers=3, ff_dim=32, max_len=10, dropout=0.0)
    ids = torch.randint(0, 20, (2, 7))
    mask = torch.ones(2, 7, dtype=torch.long)
    out = model(ids, mask)
    assert out.shape == (2, 7, 16)
    assert len(model.blocks) == 3


def test_encoder_invalid_config():
    with pytest.raises(ValueError):
        TransformerEncoder(vocab_size=10, embed_dim=10, num_heads=4)
    with pytest.raises(ValueError):
        TransformerEncoder(vocab_size=10, embed_dim=16, num_heads=4, num_layers=0)


def test_encoder_mask_shape_mismatch():
    model = TransformerEncoder(vocab_size=10, embed_dim=16, num_heads=4, num_layers=1, ff_dim=32, max_len=8)
    with pytest.raises(ValueError):
        model(torch.randint(0, 10, (2, 5)), torch.ones(2, 4))


def test_encoder_different_batch_and_seq_sizes():
    model = TransformerEncoder(vocab_size=10, embed_dim=16, num_heads=4, num_layers=1, ff_dim=32, max_len=12)
    for batch, seq in [(1, 3), (4, 12)]:
        ids = torch.randint(0, 10, (batch, seq))
        assert model(ids).shape == (batch, seq, 16)


def test_encoder_finite_outputs_and_backprop():
    model = TransformerEncoder(vocab_size=12, embed_dim=16, num_heads=4, num_layers=2, ff_dim=32, max_len=8)
    ids = torch.randint(0, 12, (2, 6))
    mask = torch.ones(2, 6, dtype=torch.long)
    out = model(ids, mask)
    assert torch.isfinite(out).all()
    out.sum().backward()
    assert any(p.grad is not None for p in model.parameters())
