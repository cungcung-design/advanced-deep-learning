"""Evaluate fine-tuned DistilBERT on the IMDb test subset."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import torch
from torch.utils.data import DataLoader
from transformers import AutoModelForSequenceClassification, AutoTokenizer

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.evaluation.metrics import confusion_matrix, per_class_metrics, save_json
from src.nlp.imdb import TokenizedTextDataset, load_imdb_subsets


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="configs/distilbert_imdb.json")
    args = parser.parse_args()
    cfg = json.loads((ROOT / args.config).read_text())
    ckpt_path = ROOT / cfg["checkpoint_path"]
    if not ckpt_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {ckpt_path}")

    tokenizer = AutoTokenizer.from_pretrained(cfg["model_name"])
    model = AutoModelForSequenceClassification.from_pretrained(cfg["model_name"], num_labels=2)
    state = torch.load(ckpt_path, map_location="cpu")
    model.load_state_dict(state["model_state_dict"])
    model.eval()

    _, _, test_raw = load_imdb_subsets(cfg["train_size"], cfg["val_size"], cfg["test_size"], cfg["seed"])
    test_ds = TokenizedTextDataset([r["text"] for r in test_raw], [r["label"] for r in test_raw], tokenizer, cfg["max_length"])
    loader = DataLoader(test_ds, batch_size=cfg["batch_size"], shuffle=False)

    preds, targets = [], []
    with torch.inference_mode():
        for batch in loader:
            outputs = model(input_ids=batch["input_ids"], attention_mask=batch["attention_mask"])
            preds.append(outputs.logits.argmax(-1))
            targets.append(batch["labels"])
    preds = torch.cat(preds)
    targets = torch.cat(targets)
    acc = (preds == targets).float().mean().item()
    cm = confusion_matrix(preds, targets, 2)
    metrics = per_class_metrics(cm)
    metrics["accuracy"] = acc
    out = ROOT / cfg["evaluation_path"]
    save_json({"accuracy": acc, "confusion_matrix": cm, "per_class": metrics, "checkpoint": str(ckpt_path)}, out)
    print(f"Test accuracy: {acc:.4f}")
    print(f"Macro precision: {metrics['macro']['precision']:.4f}")
    print(f"Macro recall: {metrics['macro']['recall']:.4f}")
    print(f"Macro F1: {metrics['macro']['f1']:.4f}")
    print(f"Confusion matrix: {cm}")
    print(f"Saved: {out}")


if __name__ == "__main__":
    main()
