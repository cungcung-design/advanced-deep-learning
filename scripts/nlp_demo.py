"""Demonstrate the text-to-tensor NLP pipeline."""
from __future__ import annotations

import sys
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.nlp import TokenEmbedding, Tokenizer, Vocabulary, normalize_text, pad_sequences, PositionalEmbedding

TEXTS = [
    "Deep learning models learn representations from data.",
    "Transformers use attention to model token interactions!",
    "CPU-only NLP is practical for small experiments.",
]


def main() -> None:
    tokenizer = Tokenizer()
    vocab = Vocabulary.build_from_texts(TEXTS, min_freq=1)
    print(f"Normalized: {normalize_text(TEXTS[0])}")
    print(f"Tokens: {tokenizer.tokenize(TEXTS[0])}")
    print(f"Vocab size: {len(vocab)}")

    ids: list[list[int]] = [vocab.encode(tokenizer.tokenize(t)) for t in TEXTS]
    input_ids, mask = pad_sequences(ids, max_length=12, pad_id=vocab.pad_id)
    print(f"Input IDs shape: {tuple(input_ids.shape)}")
    print(f"Attention mask shape: {tuple(mask.shape)}")
    print(f"Decoded: {vocab.decode(input_ids[0].tolist())}")

    tok_emb = TokenEmbedding(len(vocab), embed_dim=32, padding_idx=vocab.pad_id)
    pos_emb = PositionalEmbedding(max_len=12, embed_dim=32)
    x = pos_emb(tok_emb(input_ids))
    print(f"Embedded shape: {tuple(x.shape)}")
    print(f"Padding embedding zero: {bool(torch.allclose(tok_emb.embedding.weight[vocab.pad_id], torch.zeros(32)))}")


if __name__ == "__main__":
    main()
