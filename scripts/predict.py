"""Predict class for an image using trained CIFAR-10 model."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import torch
from PIL import Image
from torchvision import transforms

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.models import CifarCNN, get_pretrained_resnet18
from src.utils.device import get_device

CLASS_NAMES = ["airplane", "automobile", "bird", "cat", "deer", "dog", "frog", "horse", "ship", "truck"]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--config", default="configs/cifar10.json")
    parser.add_argument("--checkpoint", default=None)
    args = parser.parse_args()

    with open(ROOT / args.config) as f:
        cfg = json.load(f)
    ckpt_path = ROOT / (args.checkpoint or cfg["checkpoint_path"])
    device = get_device()

    model_name = cfg.get("model", "cifar_cnn")
    if model_name == "resnet18":
        model = get_pretrained_resnet18(num_classes=10, freeze_backbone=False).to(device)
    else:
        model = CifarCNN().to(device)
    checkpoint = torch.load(ckpt_path, map_location=device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    size = cfg.get("image_size", 32)
    if model_name == "resnet18":
        mean, std = (0.485, 0.456, 0.406), (0.229, 0.224, 0.225)
    else:
        mean, std = (0.4914, 0.4822, 0.4465), (0.2023, 0.1994, 0.2010)
    transform = transforms.Compose([
        transforms.Resize((size, size)),
        transforms.ToTensor(),
        transforms.Normalize(mean, std),
    ])
    image = Image.open(args.image).convert("RGB")
    tensor = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        outputs = model(tensor)
        probs = torch.softmax(outputs, dim=1)[0]
        top3_prob, top3_idx = torch.topk(probs, 3)

    print(f"Predicted: {CLASS_NAMES[top3_idx[0].item()]} ({top3_prob[0].item():.4f})")
    print("Top-3:")
    for p, i in zip(top3_prob, top3_idx):
        print(f"  {CLASS_NAMES[i.item()]}: {p.item():.4f}")


if __name__ == "__main__":
    main()


