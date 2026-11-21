"""Sentiment analysis with a pretrained DistilBERT model."""
from __future__ import annotations
import sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.nlp import predict_sentiment

TEXTS = ["I love this project and the results look great!", "This is a terrible and disappointing experience."]
t0 = time.perf_counter()
for r in predict_sentiment(TEXTS):
    print(f"{r['label']} ({r['score']:.4f}) | {r['text']}")
print(f"Elapsed: {time.perf_counter()-t0:.2f}s")
