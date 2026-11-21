"""Offline tests for Hugging Face integration."""
from __future__ import annotations

from types import SimpleNamespace

import pytest
import torch

from src.nlp.huggingface import extract_embeddings, predict_sentiment, tokenize_batch


class FakeTokenizer:
    def __call__(self, texts, return_tensors=None, padding=True, truncation=True, max_length=128):
        texts = [texts] if isinstance(texts, str) else texts
        ids = [[1 + (len(t) % 5), 2] for t in texts]
        width = max(len(x) for x in ids)
        input_ids = torch.zeros(len(texts), width, dtype=torch.long)
        mask = torch.zeros(len(texts), width, dtype=torch.long)
        for i, row in enumerate(ids):
            input_ids[i, : len(row)] = torch.tensor(row)
            mask[i, : len(row)] = 1
        return {"input_ids": input_ids, "attention_mask": mask}


class FakeClassifier(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.config = SimpleNamespace(id2label={0: "NEGATIVE", 1: "POSITIVE"})
        self.linear = torch.nn.Linear(1, 2)

    def forward(self, input_ids, attention_mask):
        base = input_ids.float().mean(dim=1, keepdim=True)
        return SimpleNamespace(logits=self.linear(base))


class FakeEncoder(torch.nn.Module):
    def forward(self, input_ids, attention_mask):
        hidden = torch.ones(input_ids.size(0), input_ids.size(1), 8)
        return SimpleNamespace(last_hidden_state=hidden)


def test_batch_tokenization_shapes():
    batch = tokenize_batch(["hello", "a longer sentence"], FakeTokenizer())
    assert batch["input_ids"].shape == (2, 2)
    assert batch["attention_mask"].shape == (2, 2)


def test_predict_sentiment_structure():
    results = predict_sentiment(["good", "bad"], tokenizer=FakeTokenizer(), model=FakeClassifier())
    assert len(results) == 2
    assert set(results[0]) == {"text", "label", "score"}
    assert results[0]["label"] in ("NEGATIVE", "POSITIVE")


def test_predict_no_grad():
    results = predict_sentiment(["good"], tokenizer=FakeTokenizer(), model=FakeClassifier())
    assert isinstance(results[0]["score"], float)


def test_embeddings_shape():
    emb = extract_embeddings(["one", "two"], tokenizer=FakeTokenizer(), model=FakeEncoder())
    assert emb.shape == (2, 8)
    assert torch.isfinite(emb).all()


def test_invalid_texts():
    with pytest.raises(ValueError):
        tokenize_batch([], FakeTokenizer())
    with pytest.raises(ValueError):
        predict_sentiment([""], tokenizer=FakeTokenizer(), model=FakeClassifier())


def test_missing_model_error(monkeypatch):
    import src.nlp.huggingface as hf

    def raise_oserror(*args, **kwargs):
        raise OSError("offline")

    monkeypatch.setattr(hf.AutoTokenizer, "from_pretrained", raise_oserror)
    with pytest.raises(OSError):
        hf.load_sentiment_pipeline("missing-model")
