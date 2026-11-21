"""Offline tests for DistilBERT fine-tuning pipeline components."""
from __future__ import annotations

from types import SimpleNamespace

import pytest
import torch
from torch.utils.data import DataLoader

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from src.nlp.imdb import TokenizedTextDataset


class FakeTokenizer:
    def __call__(self, texts, truncation=True, padding="max_length", max_length=8, return_tensors="pt"):
        if isinstance(texts, str):
            texts = [texts]
        ids = torch.zeros(len(texts), max_length, dtype=torch.long)
        mask = torch.zeros(len(texts), max_length, dtype=torch.long)
        for i, text in enumerate(texts):
            n = min(len(text.split()), max_length)
            ids[i, :n] = torch.arange(1, n + 1)
            mask[i, :n] = 1
        return {"input_ids": ids, "attention_mask": mask}


class TinyClassifier(torch.nn.Module):
    def __init__(self, vocab_size=100, hidden=8):
        super().__init__()
        self.emb = torch.nn.Embedding(vocab_size, hidden)
        self.fc = torch.nn.Linear(hidden, 2)

    def forward(self, input_ids, attention_mask, labels=None):
        x = self.emb(input_ids).mean(dim=1)
        logits = self.fc(x)
        loss = None
        if labels is not None:
            loss = torch.nn.functional.cross_entropy(logits, labels)
        return SimpleNamespace(logits=logits, loss=loss)


def test_tokenized_dataset_shapes():
    ds = TokenizedTextDataset(["a b c", "d"], [1, 0], FakeTokenizer(), max_length=5)
    item = ds[0]
    assert item["input_ids"].shape == (5,)
    assert item["attention_mask"].shape == (5,)
    assert int(item["attention_mask"].sum()) == 3
    assert len(ds) == 2


def test_tokenized_dataset_mismatch():
    with pytest.raises(ValueError):
        TokenizedTextDataset(["a"], [1, 0], FakeTokenizer())


def test_training_step_gradients():
    model = TinyClassifier()
    ds = TokenizedTextDataset(["a b", "c d"], [1, 0], FakeTokenizer(), max_length=6)
    batch = next(iter(DataLoader(ds, batch_size=2)))
    out = model(**batch)
    out.loss.backward()
    assert any(p.grad is not None for p in model.parameters())


def test_eval_metrics_confusion():
    from src.evaluation.metrics import confusion_matrix, per_class_metrics
    cm = confusion_matrix(torch.tensor([0, 1, 1]), torch.tensor([0, 1, 0]), 2)
    metrics = per_class_metrics(cm)
    assert cm == [[1, 1], [0, 1]]
    assert 0.0 <= metrics["macro"]["f1"] <= 1.0


def test_checkpoint_roundtrip(tmp_path):
    model = TinyClassifier()
    path = tmp_path / "m.pt"
    torch.save({"model_state_dict": model.state_dict()}, path)
    new_model = TinyClassifier()
    new_model.load_state_dict(torch.load(path)["model_state_dict"])
    for a, b in zip(model.parameters(), new_model.parameters()):
        assert torch.allclose(a, b)


def test_prediction_labels():
    from predict_sentiment_finetuned import predict
    model = TinyClassifier().eval()
    results = predict(["good movie"], FakeTokenizer(), model, max_length=6)
    assert results[0]["label"] in ("NEGATIVE", "POSITIVE")
    assert 0.0 <= results[0]["score"] <= 1.0
