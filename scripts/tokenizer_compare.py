"""Compare regex tokenizer and Hugging Face subword tokenization."""
from __future__ import annotations
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from transformers import AutoTokenizer
from src.nlp import Tokenizer

text = "Transformers tokenize subword units efficiently!"
print("Regex:", Tokenizer().tokenize(text))
tok = AutoTokenizer.from_pretrained("distilbert-base-uncased")
enc = tok(text)
print("HF tokens:", tok.convert_ids_to_tokens(enc["input_ids"]))
print("HF ids:", enc["input_ids"])
print("HF mask:", enc["attention_mask"])
