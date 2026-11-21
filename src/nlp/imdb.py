"""Deterministic IMDb subset loading and tokenized dataset."""
from __future__ import annotations

import random
from typing import List, Sequence

import torch
from torch.utils.data import Dataset


def load_imdb_subsets(train_size: int, val_size: int, test_size: int, seed: int = 42):
    """Load deterministic IMDb subsets; labels: 0=NEGATIVE, 1=POSITIVE."""
    from datasets import load_dataset

    if min(train_size, val_size, test_size) <= 0:
        raise ValueError("subset sizes must be positive")
    ds = load_dataset("stanfordnlp/imdb")
    total_needed = train_size + val_size + test_size
    pool = ds["train"].shuffle(seed=seed).select(range(total_needed))
    train = pool.select(range(train_size))
    val = pool.select(range(train_size, train_size + val_size))
    test = pool.select(range(train_size, train_size + test_size))
    return train, val, test


class TokenizedTextDataset(Dataset):
    """Wrap text/label records with a Hugging Face tokenizer."""

    def __init__(self, texts: Sequence[str], labels: Sequence[int], tokenizer, max_length: int = 128) -> None:
        if len(texts) != len(labels):
            raise ValueError("texts and labels must have the same length")
        self.encodings = tokenizer(
            list(texts),
            truncation=True,
            padding="max_length",
            max_length=max_length,
            return_tensors="pt",
        )
        self.labels = torch.tensor(list(labels), dtype=torch.long)

    def __len__(self) -> int:
        return len(self.labels)

    def __getitem__(self, idx: int) -> dict:
        return {
            "input_ids": self.encodings["input_ids"][idx],
            "attention_mask": self.encodings["attention_mask"][idx],
            "labels": self.labels[idx],
        }
