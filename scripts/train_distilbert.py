"""Fine-tune DistilBERT for IMDb sentiment classification (CPU)."""
from __future__ import annotations

import argparse
import json
import random
import sys
import time
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader
from transformers import AutoModelForSequenceClassification, AutoTokenizer

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.nlp.imdb import TokenizedTextDataset, load_imdb_subsets
from src.utils.device import get_device


def set_seed(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="configs/distilbert_imdb.json")
    args = parser.parse_args()
    cfg = json.loads((ROOT / args.config).read_text())
    set_seed(cfg["seed"])
    device = get_device()
    print(f"Device: {device}")

    train_raw, val_raw, _ = load_imdb_subsets(cfg["train_size"], cfg["val_size"], cfg["test_size"], cfg["seed"])
    tokenizer = AutoTokenizer.from_pretrained(cfg["model_name"])
    model = AutoModelForSequenceClassification.from_pretrained(cfg["model_name"], num_labels=2).to(device)

    if cfg.get("freeze_backbone"):
        for name, param in model.named_parameters():
            if not (name.startswith("classifier") or name.startswith("pre_classifier")):
                param.requires_grad = False

    train_ds = TokenizedTextDataset([r["text"] for r in train_raw], [r["label"] for r in train_raw], tokenizer, cfg["max_length"])
    val_ds = TokenizedTextDataset([r["text"] for r in val_raw], [r["label"] for r in val_raw], tokenizer, cfg["max_length"])
    train_loader = DataLoader(train_ds, batch_size=cfg["batch_size"], shuffle=True, num_workers=cfg["num_workers"])
    val_loader = DataLoader(val_ds, batch_size=cfg["batch_size"], shuffle=False, num_workers=cfg["num_workers"])

    optimizer = torch.optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=cfg["learning_rate"], weight_decay=cfg["weight_decay"])
    best_val_acc = -1.0
    start = time.perf_counter()
    for epoch in range(cfg["epochs"]):
        model.train()
        total_loss, correct, total = 0.0, 0, 0
        for batch in train_loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            optimizer.zero_grad()
            outputs = model(**batch)
            loss = outputs.loss
            loss.backward()
            optimizer.step()
            total_loss += loss.item() * batch["labels"].size(0)
            correct += (outputs.logits.argmax(-1) == batch["labels"]).sum().item()
            total += batch["labels"].size(0)
        train_loss = total_loss / total
        train_acc = correct / total

        model.eval()
        val_loss, val_correct, val_total = 0.0, 0, 0
        with torch.inference_mode():
            for batch in val_loader:
                batch = {k: v.to(device) for k, v in batch.items()}
                outputs = model(**batch)
                val_loss += outputs.loss.item() * batch["labels"].size(0)
                val_correct += (outputs.logits.argmax(-1) == batch["labels"]).sum().item()
                val_total += batch["labels"].size(0)
        val_loss /= val_total
        val_acc = val_correct / val_total
        print(f"Epoch {epoch+1}/{cfg['epochs']} | train_loss {train_loss:.4f} train_acc {train_acc:.4f} | val_loss {val_loss:.4f} val_acc {val_acc:.4f}")
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            torch.save({"model_state_dict": model.state_dict(), "config": cfg}, ROOT / cfg["checkpoint_path"])
            print(f"Saved best checkpoint (val_acc={val_acc:.4f})")
    print(f"Best val_acc: {best_val_acc:.4f}")
    print(f"Duration: {time.perf_counter()-start:.1f}s")


if __name__ == "__main__":
    main()
