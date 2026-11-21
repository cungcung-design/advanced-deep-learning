"""Unified NLP inference service combining all Milestone 4 components."""
from __future__ import annotations

from pathlib import Path
from typing import Sequence

import threading

import torch
from transformers import (
    AutoModelForSequenceClassification,
    AutoModelForTokenClassification,
    AutoTokenizer,
)

from .huggingface import (
    DEFAULT_EMBEDDING_MODEL,
    DEFAULT_SENTIMENT_MODEL,
    extract_embeddings as _extract_embeddings,
    predict_sentiment as _predict_pretrained,
)
from .imdb import TokenizedTextDataset  # noqa: F401  (kept for re-use)

DEFAULT_FINETUNED_CHECKPOINT = "artifacts/distilbert_imdb_finetuned.pt"
DEFAULT_NER_MODEL = "elastic/distilbert-base-uncased-finetuned-conll03-english"


def _as_list(texts) -> list[str]:
    if isinstance(texts, str):
        texts = [texts]
    texts = list(texts)
    if not texts:
        raise ValueError("texts must not be empty")
    if any(not isinstance(t, str) or not t.strip() for t in texts):
        raise ValueError("each text must be a non-empty string")
    return texts


class NLPService:
    """Lazily loaded, cached NLP inference service (CPU-only)."""

    def __init__(
        self,
        finetuned_checkpoint: str | Path = DEFAULT_FINETUNED_CHECKPOINT,
        pretrained_sentiment_model: str = DEFAULT_SENTIMENT_MODEL,
        embedding_model: str = DEFAULT_EMBEDDING_MODEL,
        ner_model: str = DEFAULT_NER_MODEL,
        local_files_only: bool = False,
        device: str = "cpu",
    ) -> None:
        self.finetuned_checkpoint = Path(finetuned_checkpoint)
        self.pretrained_sentiment_model = pretrained_sentiment_model
        self.embedding_model = embedding_model
        self.ner_model = ner_model
        self.local_files_only = local_files_only
        self.device = torch.device(device)
        self._cache: dict[str, tuple] = {}
        self._cache_lock = threading.RLock()

    def _load_finetuned(self):
        key = "finetuned"
        with self._cache_lock:
            if key not in self._cache:
                if not self.finetuned_checkpoint.exists():
                    raise FileNotFoundError(f"Checkpoint not found: {self.finetuned_checkpoint}")
                tokenizer = AutoTokenizer.from_pretrained(DEFAULT_EMBEDDING_MODEL, local_files_only=self.local_files_only)
                model = AutoModelForSequenceClassification.from_pretrained(DEFAULT_EMBEDDING_MODEL, num_labels=2, local_files_only=self.local_files_only)
                state = torch.load(self.finetuned_checkpoint, map_location="cpu")
                model.load_state_dict(state["model_state_dict"])
                model.to(self.device).eval()
                self._cache[key] = (tokenizer, model)
            return self._cache[key]

    def _load_pretrained_sentiment(self):
        key = "pretrained_sentiment"
        with self._cache_lock:
            if key not in self._cache:
                tokenizer = AutoTokenizer.from_pretrained(self.pretrained_sentiment_model, local_files_only=self.local_files_only)
                model = AutoModelForSequenceClassification.from_pretrained(self.pretrained_sentiment_model, local_files_only=self.local_files_only)
                model.to(self.device).eval()
                self._cache[key] = (tokenizer, model)
            return self._cache[key]

    def _load_embeddings(self):
        key = "embeddings"
        with self._cache_lock:
            if key not in self._cache:
                from transformers import AutoModel

                tokenizer = AutoTokenizer.from_pretrained(self.embedding_model, local_files_only=self.local_files_only)
                model = AutoModel.from_pretrained(self.embedding_model, local_files_only=self.local_files_only)
                model.to(self.device).eval()
                self._cache[key] = (tokenizer, model)
            return self._cache[key]

    def _load_ner(self):
        key = "ner"
        with self._cache_lock:
            if key not in self._cache:
                tokenizer = AutoTokenizer.from_pretrained(self.ner_model, local_files_only=self.local_files_only)
                model = AutoModelForTokenClassification.from_pretrained(self.ner_model, local_files_only=self.local_files_only)
                model.to(self.device).eval()
                self._cache[key] = (tokenizer, model)
            return self._cache[key]

    def clear_cache(self) -> None:
        """Drop cached tokenizers and models; safe for concurrent callers."""
        with self._cache_lock:
            self._cache.clear()

    @property
    def cached_tasks(self) -> list[str]:
        with self._cache_lock:
            return sorted(self._cache)

    def predict_sentiment(self, text: str, model: str = "finetuned") -> dict:
        """Predict sentiment with the fine-tuned or pretrained model."""
        [text] = _as_list([text])
        if model == "finetuned":
            tokenizer, clf = self._load_finetuned()
            enc = tokenizer(text, return_tensors="pt", truncation=True, padding=True, max_length=128)
            with torch.inference_mode():
                probs = torch.softmax(clf(**enc).logits, dim=-1)[0]
            label_map = {0: "NEGATIVE", 1: "POSITIVE"}
            idx = int(probs.argmax())
            return {"task": "sentiment", "model": "distilbert_imdb_finetuned", "text": text, "label": label_map[idx], "score": float(probs[idx])}
        if model == "pretrained":
            tokenizer, clf = self._load_pretrained_sentiment()
            results = _predict_pretrained([text], tokenizer=tokenizer, model=clf)
            return {"task": "sentiment", "model": self.pretrained_sentiment_model, **results[0]}
        raise ValueError("model must be 'finetuned' or 'pretrained'")

    def predict_sentiment_batch(self, texts: Sequence[str], model: str = "finetuned") -> list[dict]:
        texts = _as_list(texts)
        return [self.predict_sentiment(t, model=model) for t in texts]

    def extract_embeddings(self, texts: Sequence[str]) -> torch.Tensor:
        texts = _as_list(texts)
        tokenizer, encoder = self._load_embeddings()
        return _extract_embeddings(texts, tokenizer=tokenizer, model=encoder)

    def extract_entities(self, text: str) -> list[dict]:
        """Extract named entities with text, label, and confidence."""
        [text] = _as_list([text])
        tokenizer, model = self._load_ner()
        enc = tokenizer(text, return_tensors="pt", truncation=True, max_length=256, return_offsets_mapping=True)
        offsets = enc.pop("offset_mapping")[0].tolist()
        with torch.inference_mode():
            logits = model(**enc).logits[0]
            probs = torch.softmax(logits, dim=-1)

        entities: list[dict] = []
        cur = None
        prev_end = None
        for (start, end), prob, idx in zip(offsets, probs, probs.argmax(-1).tolist()):
            if start == end:
                continue
            label = model.config.id2label[idx]
            score = float(prob[idx])
            if label == "O":
                if cur:
                    entities.append(cur)
                    cur = None
                continue
            prefix, _, kind = label.partition("-")
            if cur is None or prefix == "B" or cur["label"] != kind:
                if cur:
                    entities.append(cur)
                cur = {"text": text[start:end], "label": kind, "score": score}
            else:
                sep = "" if prev_end == start else " "
                cur["text"] += sep + text[start:end]
                cur["score"] = min(cur["score"], score)
            prev_end = end
        if cur:
            entities.append(cur)
        return entities
