"""Demonstrate the Transformer encoder text pipeline."""
from __future__ import annotations

import sys
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.nlp import TransformerEncoder, Tokenizer, Vocabulary, pad_sequences

TEXTS = [
    "Transformers use self attention to model tokens.",
    "Attention helps models focus on relevant context.",
    "Small CPU experiments are practical.",
]


def main() -> None:
    tokenizer = Tokenizer()
    vocab = Vocabulary.build_from_texts(TEXTS)
    encoded = [vocab.encode(tokenizer.tokenize(t)) for t in TEXTS]
    input_ids, mask = pad_sequences(encoded, max_length=12, pad_id=vocab.pad_id)

    model = TransformerEncoder(
        vocab_size=len(vocab),
        embed_dim=32,
        num_heads=4,
        num_layers=2,
        ff_dim=64,
        max_len=12,
        dropout=0.1,
        padding_idx=vocab.pad_id,
    )
    model.eval()
    with torch.inference_mode():
        output = model(input_ids, mask)

    print(f"Vocab size: {len(vocab)}")
    print(f"Input IDs shape: {tuple(input_ids.shape)}")
    print(f"Attention mask shape: {tuple(mask.shape)}")
    print(f"Encoder output shape: {tuple(output.shape)}")
    print(f"Finite: {bool(torch.isfinite(output).all())}")
    print(f"Mean abs activation: {output.abs().mean().item():.6f}")


if __name__ == "__main__":
    main()
