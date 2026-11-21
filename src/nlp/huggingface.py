"""Hugging Face pretrained model integration (CPU-friendly)."""
from __future__ import annotations

from typing import Iterable, List, Sequence

import torch
from transformers import AutoModel, AutoModelForSequenceClassification, AutoTokenizer

DEFAULT_SENTIMENT_MODEL = "distilbert-base-uncased-finetuned-sst-2-english"
DEFAULT_EMBEDDING_MODEL = "distilbert-base-uncased"


def _validate_texts(texts: Sequence[str]) -> List[str]:
    if isinstance(texts, str):
        texts = [texts]
    texts = list(texts)
    if not texts:
        raise ValueError("texts must not be empty")
    if any(not isinstance(t, str) or not t.strip() for t in texts):
        raise ValueError("each text must be a non-empty string")
    return texts


def load_sentiment_pipeline(model_name: str = DEFAULT_SENTIMENT_MODEL, local_files_only: bool = False):
    """Load a pretrained sequence-classification tokenizer and model on CPU."""
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name, local_files_only=local_files_only)
        model = AutoModelForSequenceClassification.from_pretrained(model_name, local_files_only=local_files_only)
    except OSError as exc:
        raise OSError(f"Could not load '{model_name}'. Check network/cache access. Original error: {exc}") from exc
    model.to("cpu").eval()
    return tokenizer, model


def tokenize_batch(texts: Sequence[str], tokenizer, max_length: int = 128, padding: bool = True) -> dict:
    """Tokenize a batch and return model-ready tensors."""
    texts = _validate_texts(texts)
    return tokenizer(
        texts,
        return_tensors="pt",
        padding=padding,
        truncation=True,
        max_length=max_length,
    )


@torch.inference_mode()
def predict_sentiment(
    texts: Sequence[str],
    tokenizer=None,
    model=None,
    model_name: str = DEFAULT_SENTIMENT_MODEL,
    max_length: int = 128,
    local_files_only: bool = False,
) -> List[dict]:
    """Return predicted sentiment label and confidence for each text."""
    texts = _validate_texts(texts)
    if tokenizer is None or model is None:
        tokenizer, model = load_sentiment_pipeline(model_name, local_files_only)
    model.eval()
    batch = tokenize_batch(texts, tokenizer, max_length=max_length)
    outputs = model(**batch)
    probs = torch.softmax(outputs.logits, dim=-1)
    scores, indices = probs.max(dim=-1)
    results = []
    for text, idx, score in zip(texts, indices.tolist(), scores.tolist()):
        results.append({
            "text": text,
            "label": model.config.id2label.get(idx, str(idx)),
            "score": score,
        })
    return results


def load_embedding_model(model_name: str = DEFAULT_EMBEDDING_MODEL, local_files_only: bool = False):
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name, local_files_only=local_files_only)
        model = AutoModel.from_pretrained(model_name, local_files_only=local_files_only)
    except OSError as exc:
        raise OSError(f"Could not load '{model_name}'. Check network/cache access. Original error: {exc}") from exc
    model.to("cpu").eval()
    return tokenizer, model


@torch.inference_mode()
def extract_embeddings(
    texts: Sequence[str],
    tokenizer=None,
    model=None,
    model_name: str = DEFAULT_EMBEDDING_MODEL,
    max_length: int = 128,
    local_files_only: bool = False,
) -> torch.Tensor:
    """Mean-pooled last-hidden-state embeddings shaped [batch, hidden_dim]."""
    texts = _validate_texts(texts)
    if tokenizer is None or model is None:
        tokenizer, model = load_embedding_model(model_name, local_files_only)
    model.eval()
    batch = tokenize_batch(texts, tokenizer, max_length=max_length)
    outputs = model(**batch)
    hidden = outputs.last_hidden_state
    mask = batch["attention_mask"].unsqueeze(-1).to(hidden.dtype)
    summed = (hidden * mask).sum(dim=1)
    counts = mask.sum(dim=1).clamp(min=1)
    return summed / counts
