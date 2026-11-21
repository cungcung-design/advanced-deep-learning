"""Offline tests for the unified NLP service."""
from __future__ import annotations

from types import SimpleNamespace

import pytest
import torch

from src.nlp.service import NLPService


class FakeSentTokenizer:
    def __call__(self, text, return_tensors="pt", truncation=True, padding=True, max_length=128):
        if isinstance(text, str):
            text = [text]
        ids = torch.ones(len(text), 3, dtype=torch.long)
        return {"input_ids": ids, "attention_mask": torch.ones_like(ids)}


class FakeSentModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.config = SimpleNamespace(id2label={0: "NEGATIVE", 1: "POSITIVE"})
        self.w = torch.nn.Parameter(torch.tensor(0.0))

    def forward(self, input_ids, attention_mask):
        logits = torch.stack([torch.zeros(input_ids.size(0)), torch.ones(input_ids.size(0))], dim=-1)
        return SimpleNamespace(logits=logits + self.w * 0)


class FakeEncModel(torch.nn.Module):
    def forward(self, input_ids, attention_mask):
        return SimpleNamespace(last_hidden_state=torch.ones(input_ids.size(0), input_ids.size(1), 8))


class FakeNerTokenizer:
    def __call__(self, text, return_tensors="pt", truncation=True, max_length=256, return_offsets_mapping=True):
        words = text.split()
        offsets = []
        pos = 0
        for w in words:
            offsets.append([pos, pos + len(w)])
            pos += len(w) + 1
        return {
            "input_ids": torch.ones(1, len(words), dtype=torch.long),
            "attention_mask": torch.ones(1, len(words), dtype=torch.long),
            "offset_mapping": torch.tensor([offsets]),
        }


class FakeNerModel(torch.nn.Module):
    def __init__(self):
        super().__init__()
        self.config = SimpleNamespace(id2label={0: "O", 1: "B-PER", 2: "B-LOC"})
        self.w = torch.nn.Parameter(torch.tensor(0.0))

    def forward(self, input_ids, attention_mask):
        logits = torch.zeros(input_ids.size(0), input_ids.size(1), 3)
        logits[:, 0, 1] = 5
        logits[:, 1, 2] = 5
        return SimpleNamespace(logits=logits + self.w * 0)


@pytest.fixture
def service(monkeypatch):
    svc = NLPService(finetuned_checkpoint="unused.pt")
    monkeypatch.setattr(svc, "_load_finetuned", lambda: (FakeSentTokenizer(), FakeSentModel()))
    monkeypatch.setattr(svc, "_load_pretrained_sentiment", lambda: (FakeSentTokenizer(), FakeSentModel()))
    monkeypatch.setattr(svc, "_load_embeddings", lambda: (FakeSentTokenizer(), FakeEncModel()))
    monkeypatch.setattr(svc, "_load_ner", lambda: (FakeNerTokenizer(), FakeNerModel()))
    return svc


def test_service_initialization():
    svc = NLPService()
    assert svc.device.type == "cpu"
    assert svc._cache == {}


def test_sentiment(service):
    r = service.predict_sentiment("good", model="finetuned")
    assert r["label"] == "POSITIVE"
    assert 0 <= r["score"] <= 1
    assert r["task"] == "sentiment"


def test_batch_sentiment(service):
    out = service.predict_sentiment_batch(["a", "b"], model="pretrained")
    assert len(out) == 2


def test_embeddings(service):
    emb = service.extract_embeddings(["one", "two"])
    assert emb.shape == (2, 8)


def test_ner(service):
    ents = service.extract_entities("Barack Obama visited Paris")
    assert len(ents) == 2
    assert ents[0]["label"] == "PER"
    assert ents[0]["text"] == "Barack"
    assert set(ents[0]) == {"text", "label", "score"}


def test_invalid_inputs(service):
    with pytest.raises(ValueError):
        service.predict_sentiment("")
    with pytest.raises(ValueError):
        service.predict_sentiment_batch([])
    with pytest.raises(ValueError):
        service.extract_entities("   ")
    with pytest.raises(ValueError):
        service.predict_sentiment("ok", model="unknown")


def test_model_caching(monkeypatch):
    svc = NLPService()
    calls = {"n": 0}

    def load():
        calls["n"] += 1
        return FakeSentTokenizer(), FakeSentModel()

    monkeypatch.setattr(svc, "_load_finetuned", load)
    svc.predict_sentiment("a")
    svc.predict_sentiment("b")
    assert calls["n"] == 2  # monkeypatched loader is not cached itself
    monkeypatch.setattr(svc, "_load_finetuned", lambda: (FakeSentTokenizer(), FakeSentModel()))
