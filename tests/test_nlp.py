"""Tests for NLP foundations."""
from __future__ import annotations

import pytest
import torch

from src.nlp import (
    PositionalEmbedding,
    TokenEmbedding,
    Tokenizer,
    Vocabulary,
    normalize_text,
    pad_sequences,
    text_to_tensors,
)


def test_normalization():
    assert normalize_text("  Hello   WORLD! ") == "hello world!"
    with pytest.raises(TypeError):
        normalize_text(None)


def test_tokenization():
    tok = Tokenizer()
    assert tok.tokenize("Hello, world!") == ["hello", ",", "world", "!"]
    assert tok.tokenize("") == []
    with pytest.raises(TypeError):
        tok.tokenize(3)


def test_vocabulary_consistency():
    vocab = Vocabulary(["a", "b", "a"])
    assert len(vocab) == 4
    assert vocab.token_to_id["a"] == vocab.add_token("a")
    assert vocab.id_to_token[vocab.token_to_id["b"]] == "b"


def test_unknown_token():
    vocab = Vocabulary(["known"])
    assert vocab.encode(["missing"])[0] == vocab.unk_id


def test_encode_decode():
    vocab = Vocabulary(["deep", "learning"])
    tokens = ["deep", "learning"]
    ids = vocab.encode(tokens)
    assert ids == [vocab.token_to_id["deep"], vocab.token_to_id["learning"]]
    assert vocab.decode(ids) == "deep learning"


def test_padding_truncation():
    ids, mask = pad_sequences([[1, 2, 3], [4]], max_length=2, pad_id=0)
    assert ids.shape == (2, 2)
    assert ids.tolist() == [[1, 2], [4, 0]]
    assert mask.tolist() == [[1, 1], [1, 0]]
    with pytest.raises(ValueError):
        pad_sequences([[1, 2, 3]], max_length=2, truncation=False)


def test_attention_mask():
    _, mask = pad_sequences([[1, 2, 3], [1]], max_length=4, pad_id=0)
    assert mask.tolist() == [[1, 1, 1, 0], [1, 0, 0, 0]]


def test_token_embedding_shape():
    emb = TokenEmbedding(10, 8, padding_idx=0)
    out = emb(torch.tensor([[1, 2], [3, 0]]))
    assert out.shape == (2, 2, 8)
    assert torch.allclose(emb.embedding.weight[0], torch.zeros(8))


def test_positional_embedding_shape():
    pos = PositionalEmbedding(max_len=16, embed_dim=8)
    out = pos(torch.zeros(2, 6, 8))
    assert out.shape == (2, 6, 8)


def test_positional_embedding_too_long():
    pos = PositionalEmbedding(max_len=4, embed_dim=8)
    with pytest.raises(ValueError):
        pos(torch.zeros(1, 5, 8))


def test_text_to_tensors():
    texts = ["hello world", "hello"]
    vocab = Vocabulary.build_from_texts(texts)
    ids, mask = text_to_tensors(texts, vocab, max_length=4)
    assert ids.shape == (2, 4)
    assert mask.shape == (2, 4)
    assert mask[1].tolist() == [1, 0, 0, 0]


def test_invalid_padding():
    with pytest.raises(ValueError):
        pad_sequences([[1]], max_length=0)
    with pytest.raises(ValueError):
        pad_sequences([], max_length=2)
    with pytest.raises(ValueError):
        pad_sequences([[1]], max_length=2, padding="bad")
