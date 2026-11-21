"""Demonstrate the unified NLP service across tasks."""
from __future__ import annotations

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.nlp import NLPService

TEXTS = [
    "The film was a wonderful, moving experience.",
    "A boring and disappointing waste of time.",
]
NER_TEXT = "Barack Obama visited Paris with Angela Merkel in 2015."


def main() -> None:
    service = NLPService()
    t0 = time.perf_counter()
    print("== Fine-tuned sentiment ==")
    for r in service.predict_sentiment_batch(TEXTS, model="finetuned"):
        print(f"{r['label']} ({r['score']:.4f}) | {r['text']}")
    print("\n== Pretrained sentiment ==")
    for r in service.predict_sentiment_batch(TEXTS, model="pretrained"):
        print(f"{r['label']} ({r['score']:.4f}) | {r['text']}")
    print("\n== Embeddings ==")
    emb = service.extract_embeddings(TEXTS)
    print(f"shape={tuple(emb.shape)} norm0={emb[0].norm().item():.4f}")
    print("\n== Named entities ==")
    for e in service.extract_entities(NER_TEXT):
        print(f"{e['label']:6s} {e['score']:.4f} | {e['text']}")
    print(f"\nElapsed: {time.perf_counter()-t0:.2f}s")


if __name__ == "__main__":
    main()
