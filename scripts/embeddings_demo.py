"""Extract sentence embeddings with a pretrained DistilBERT encoder."""
from __future__ import annotations
import sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.nlp import extract_embeddings

texts = ["Deep learning on CPU", "Transformers for NLP"]
t0 = time.perf_counter()
emb = extract_embeddings(texts)
print(f"Embedding shape: {tuple(emb.shape)}")
print(f"Norm[0]: {emb[0].norm().item():.4f}")
print(f"Elapsed: {time.perf_counter()-t0:.2f}s")
