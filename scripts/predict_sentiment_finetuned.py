"""Predict sentiment with the fine-tuned IMDb DistilBERT checkpoint."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

LABELS = {0: "NEGATIVE", 1: "POSITIVE"}


def predict(texts, tokenizer, model, max_length=128):
    enc = tokenizer(texts, return_tensors="pt", truncation=True, padding=True, max_length=max_length)
    with torch.inference_mode():
        logits = model(**enc).logits
        probs = torch.softmax(logits, dim=-1)
    results = []
    for text, row in zip(texts, probs):
        p, i = row.max(0)
        results.append({"text": text, "label": LABELS[i.item()], "score": p.item()})
    return results


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", nargs="+", required=True)
    parser.add_argument("--config", default="configs/distilbert_imdb.json")
    args = parser.parse_args()
    cfg = json.loads((ROOT / args.config).read_text())
    ckpt = ROOT / cfg["checkpoint_path"]
    if not ckpt.exists():
        raise FileNotFoundError(f"Checkpoint not found: {ckpt}")
    tokenizer = AutoTokenizer.from_pretrained(cfg["model_name"])
    model = AutoModelForSequenceClassification.from_pretrained(cfg["model_name"], num_labels=2)
    model.load_state_dict(torch.load(ckpt, map_location="cpu")["model_state_dict"])
    model.eval()
    for r in predict(args.text, tokenizer, model, cfg["max_length"]):
        print(f"{r['label']} ({r['score']:.4f}) | {r['text']}")


if __name__ == "__main__":
    main()
