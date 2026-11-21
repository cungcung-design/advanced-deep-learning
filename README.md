# Advanced Deep Learning (Weeks 9–12)

A local-first, CPU-compatible deep learning project covering PyTorch
foundations, CNNs, transfer learning, and Transformers/NLP.

This is Week 9 of a 16-week AI Engineer roadmap. The focus of Week 9 is
PyTorch foundations: tensors, autograd, neural network fundamentals, and
CNN architectures.

## Environment

- **Python**: 3.13.15 (64-bit)
- **Hardware**: ThinkPad X1 Carbon Gen 10, Intel i7-1265U, 32 GB RAM
- **GPU**: None (Intel integrated graphics — no NVIDIA CUDA)
- **Device**: CPU-only (PyTorch `+cpu` build)
- **OS**: Windows 11

## Project Structure

```
advanced-deep-learning/
├── .gitignore
├── requirements.txt
├── verify_env.py
├── README.md
├── pytest.ini
├── src/
│   ├── __init__.py
│   ├── datasets.py         # Dataset loading (MNIST, CIFAR-10, CIFAR-100)
│   ├── preprocessing.py    # Transforms and augmentation
│   ├── utils/
│   │   ├── __init__.py
│   │   └── device.py       # CPU/CUDA device selection
│   ├── models/
│   │   ├── __init__.py
│   │   ├── cnn.py          # SimpleCNN, MNISTCNN
│   │   └── transfer.py     # Pretrained ResNet18 adapter
│   └── training/
│       ├── __init__.py
│       ├── trainer.py      # Train/validate loop + checkpoints
│       └── evaluator.py    # Test evaluation + per-class metrics
├── experiments/            # Experiment scripts (Weeks 9-12)
├── data/
│   ├── raw/                # Raw datasets (gitignored)
│   ├── processed/          # Processed datasets (gitignored)
│   └── .gitkeep
├── checkpoints/            # Model checkpoints (gitignored)
│   └── .gitkeep
├── logs/                   # Training logs (gitignored)
│   └── .gitkeep
├── tests/
│   ├── __init__.py
│   └── test_basics.py      # Week 9 foundation tests
└── docs/
    └── architecture.md
```

## Setup

### 1. Create virtual environment

```powershell
cd D:\Developer\Projects\Python\advanced-deep-learning
python -m venv .venv
.venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```powershell
pip install -r requirements.txt
```

`requirements.txt` installs the CPU-only PyTorch wheel (`torch==2.15.0+cpu`,
`torchvision==0.24.0+cpu`) plus NumPy and pytest. No CUDA binaries are
downloaded, keeping the image small for CPU-only development.

### 3. Verify the environment

```powershell
python verify_env.py
```

This checks Python, PyTorch, Torchvision, NumPy, device selection, tensor
operations, autograd, and a small NN forward/backward pass.

### 4. Run the test suite

```powershell
pytest -v
```

## Roadmap (Weeks 9–12)

| Week | Topics |
|------|--------|
| 9 | PyTorch foundations, tensors, autograd, neural networks, CNN architecture |
| 10 | CNN training, image preprocessing/augmentation, regularization, transfer learning |
| 11 | Transformers, attention, tokenization, embeddings, NLP with pretrained models |
| 12 | Practical DL application, evaluation, error analysis, integration |

Do not skip or simplify these topics.

## Milestone 1 (PyTorch Foundations)

Small MNIST classification experiment.

Training command:
```powershell
.venv\Scripts\Activate.ps1
python scripts/train.py
```

Testing command:
```powershell
pytest -v
```

Structure includes src/data, src/evaluation, configs, scripts, artifacts.

Datasets (`data/`), checkpoints (`checkpoints/`), and logs (`logs/`) are
gitignored. Only source code, configuration, and tests are tracked.

## CIFAR-10 Model Comparison (Milestone 3)

| Model | Test Acc | Macro F1 | Params | Checkpoint | Latency |
|---|---:|---:|---:|---|---:|
| CifarCNN | 0.7416 | 0.7417 | 2,474,506 | artifacts/cifar10_improved.pt | 5.5 ms |
| ResNet18 feature extraction | 0.7411 | 0.7394 | 11,181,642 | artifacts/resnet18_feature_extractor.pt | 73.9 ms |
| ResNet18 fine-tuned | 0.8644 | 0.8639 | 11,181,642 | artifacts/resnet18_finetuned.pt | 30.2 ms |

Consolidated report: artifacts/cifar10_model_comparison.json

Commands:
```powershell
python scripts/compare_models.py
pytest -v
```

## NLP Foundations (Milestone 4, Task 1)

Modules under `src/nlp/`:
- tokenizer.py: text normalization and regex tokenization.
- vocabulary.py: PAD/UNK-aware token/ID mapping, build/save/load.
- embeddings.py: padding/truncation, attention masks, token and sinusoidal positional embeddings.

Demo:
```powershell
python scripts/nlp_demo.py
pytest -v
```

Observed demo output: vocab size 27, input IDs (3, 12), attention mask (3, 12), embedded tensor (3, 12, 32). Full suite: 45 passed.

## Transformer Encoder (Milestone 4, Task 2)

Modules:
- src/nlp/attention.py: scaled dot-product attention + multi-head self-attention.
- src/nlp/transformer.py: pre-norm encoder blocks and configurable encoder stack.

Demo:
```powershell
python scripts/transformer_demo.py
```

Observed: vocab 21; IDs (3,12); mask (3,12); encoder output (3,12,32); finite True. Full suite: 56 passed.

## Hugging Face Pretrained Transformers (Milestone 4, Task 3)

Dependency: `transformers>=5.0,<6.0` (CPU inference, no CUDA required).

Integration module: `src/nlp/huggingface.py`
- `load_sentiment_pipeline` / `load_embedding_model`
- `tokenize_batch`
- `predict_sentiment`
- `extract_embeddings`

Models:
- Sentiment: distilbert-base-uncased-finetuned-sst-2-english
- Embeddings: distilbert-base-uncased

Cache: Hugging Face cache at `C:\Users\X1CarbonGen10\.cache\huggingface\hub`; pass `local_files_only=True` for offline use.

Commands:
```powershell
python scripts/sentiment_demo.py
python scripts/embeddings_demo.py
python scripts/tokenizer_compare.py
pytest -v
```

Measured demo output: POSITIVE 0.9999, NEGATIVE 0.9998; embedding shape (2, 768). Full suite: 62 passed.

## Fine-tuned DistilBERT Sentiment (Milestone 4, Task 4)

Dataset: IMDb (`stanfordnlp/imdb`), deterministic subset: 1000 train, 150 validation, 300 test. Labels: 0=NEGATIVE, 1=POSITIVE. Source: IMDb movie reviews, public research dataset.

Model: `distilbert-base-uncased` with 2-class sequence-classification head, CPU training, max length 128, batch 16, lr 2e-5, 1 epoch.

Commands:
```powershell
python scripts/train_distilbert.py
python scripts/evaluate_distilbert.py
python scripts/predict_sentiment_finetuned.py --text "This movie was wonderful."
pytest -v
```

Results: train_loss 0.6440, train_acc 0.6280; val_loss 0.4309, val_acc 0.8333; test accuracy 0.7867, macro precision 0.7920, recall 0.7842, F1 0.7845. Training duration 393.8s. Checkpoint: artifacts/distilbert_imdb_finetuned.pt. Full suite: 68 passed.

## Unified NLP Application Service (Milestone 4, Task 5)

Module: `src/nlp/service.py` (`NLPService`)

Supported tasks:
- Fine-tuned IMDb sentiment (`distilbert_imdb_finetuned`)
- Pretrained SST-2 sentiment (`distilbert-base-uncased-finetuned-sst-2-english`)
- Text embeddings (`distilbert-base-uncased`)
- NER (`elastic/distilbert-base-uncased-finetuned-conll03-english`)

Features: lazy model loading, per-instance cache, batch processing, CPU inference, structured dict outputs, input validation, local checkpoint support, `local_files_only` offline mode.

Demo:
```powershell
python scripts/nlp_app_demo.py
```

Observed output:
- Fine-tuned: POSITIVE 0.8018, NEGATIVE 0.7451
- Pretrained: POSITIVE 0.9999, NEGATIVE 0.9998
- Embeddings: (2, 768), norm0 7.9129
- NER: PER Barack Obama 0.9873; LOC Paris 0.9987; PER Angela Merkel 0.9946

Full suite: 75 passed.

## Full-Stack Integration (Milestone 5)

DeepVision AI Studio will expose the existing ML/DL/NLP layers through a
FastAPI backend and a Next.js/React/TypeScript frontend.

- Architecture: `docs/fullstack-architecture.md`
- API contracts: `docs/api-contracts.md`
- UI/UX design system: `docs/ui-ux-design-system.md`

Planned pages: Dashboard, Datasets, Model Training, Model Evaluation,
AI Playground, NLP Playground, Model Registry, Settings.

Planned stack: FastAPI, Pydantic, SQLAlchemy (SQLite first), PyTorch,
Torchvision, Transformers; Next.js, React, TypeScript, Tailwind CSS,
shadcn/ui, TanStack Query, React Hook Form, Zod, lucide-react; Docker.

Integration order:
1. Backend skeleton, health/readiness, settings, registry read APIs.
2. Dataset and dashboard services backed by real artifacts.
3. Background training jobs and evaluation APIs.
4. Image and NLP inference APIs over existing `src/` code.
5. Frontend design system and shared layout.
6. Eight pages, in nav order.
7. Docker packaging, end-to-end verification, documentation.

## Backend API (Milestone 5, Task 2)

FastAPI application: `src/api/`.

Start:
```powershell
.venv\Scripts\Activate.ps1
python -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000
```

Endpoints:
- GET /health, GET /api/v1/health, GET /api/v1/health/ready
- GET /api/v1/settings, /settings/runtime, /settings/storage, /settings/models
- GET /api/v1/registry/models, GET /api/v1/registry/models/{model_id}

Storage: SQLite `deepvision.db` for app metadata; artifact roots are validated against `artifacts/`, `data/`, `configs/`. Existing artifacts are read-only.

Run tests:
```powershell
pytest -v
```

Observed: 6 registry models discovered; readiness OK; full suite 86 passed.

## Dataset Management APIs (Milestone 5, Task 3)

Endpoints:
- GET /api/v1/datasets
- GET /api/v1/datasets/{dataset_id}
- GET /api/v1/datasets/{dataset_id}/statistics
- POST /api/v1/datasets/validate `{ "dataset_id": "cifar10" }`

Verified locally:
| Dataset | Available | Train | Test | Classes | Input |
|---|---|---:|---:|---:|---|
| MNIST | yes | 60000 | 10000 | 10 | 1x28x28 |
| CIFAR-10 | yes | 50000 | 10000 | 10 | 3x32x32 |
| IMDb | yes (HF cache) | 25000 | 25000 | 2 | text, max 128 |

Validation checks supported ID, required local files, split totals, class metadata, and input spec. Unsupported IDs return 404. The API never downloads datasets.

Storage rules: existing `data/raw` and HF cache are read-only; no automatic import/upload in this task (deferred to a dedicated safe import task). Full suite: 95 passed.

## Background Training APIs (Milestone 5, Task 4)

Endpoints:
- GET /api/v1/training/presets
- POST /api/v1/training/jobs
- GET /api/v1/training/jobs
- GET /api/v1/training/jobs/{job_id}
- POST /api/v1/training/jobs/{job_id}/cancel
- GET /api/v1/training/jobs/{job_id}/logs?since=N

Architecture:
- `src/api/training/catalog.py`: supported models, dataset compatibility, config validation.
- `src/api/training/pipelines.py`: adapters over existing `src/` training code (MNIST, CIFAR-10 CNN, ResNet18).
- `src/api/training/service.py`: durable job lifecycle, background worker, cancellation, logs, artifacts.
- `src/api/routers/training.py`, `src/api/schemas_training.py`: HTTP layer and schemas.
- `src/api/db.py`: `TrainingJobRecord` table (`training_jobs`) in SQLite.

Behavior:
- States: QUEUED -> RUNNING -> SUCCEEDED | FAILED | CANCELLED; persisted in SQLite.
- One worker executes jobs sequentially on CPU; jobs report `queue_position` while queued.
- Cancellation is cooperative: queued jobs stop immediately, running jobs check between batches.
- Logs are line-addressable for incremental polling via `since`/`next_since`.
- Artifacts per job: `artifacts/app/<job_id>/{best.pt,history.json,metrics.json,metadata.json,config.json,training.log}`.
- Unsupported models/datasets and invalid configs return 4xx before any job starts.
- Jobs interrupted by process exit are not resumed automatically; create a new job.

Supported models: `mnist_cnn` (MNIST), `cifar_cnn`, `resnet18_feature_extraction`, `resnet18_finetuning` (CIFAR-10).

Tests: `tests/test_api_training.py` injects a fake pipeline, uses a temp SQLite DB, and runs no real training (10 tests). Full suite: 105 passed.

## Model Evaluation APIs (Milestone 5, Task 5)

Endpoints:
- GET /api/v1/evaluations/presets
- POST /api/v1/evaluations
- GET /api/v1/evaluations
- GET /api/v1/evaluations/{evaluation_id}
- GET /api/v1/evaluations/{evaluation_id}/results
- GET /api/v1/evaluations/{evaluation_id}/logs?since=N
- POST /api/v1/evaluations/{evaluation_id}/cancel

Architecture:
- `src/api/evaluation/catalog.py`: supported combinations and config validation.
- `src/api/evaluation/pipelines.py`: real checkpoint loading and held-out-split inference (MNIST, CIFAR-10 CNN, ResNet18, DistilBERT).
- `src/api/evaluation/metrics.py`: accuracy, per-class P/R/F1/support, macro averages, confusion matrix, zero-division-safe.
- `src/api/evaluation/service.py`: durable queue, background worker, cancellation, progress, logs, isolated artifacts.
- `src/api/routers/evaluations.py`, `src/api/schemas_evaluation.py`: HTTP layer and schemas.
- `src/api/db.py`: `EvaluationRecord` table (`evaluation_records`) in SQLite.

Supported combinations:
- `mnist_cnn` on MNIST (1x28x28, MNIST normalization).
- `cifar10_custom_cnn`, `cifar10_custom_cnn_baseline` on CIFAR-10 (3x32x32, CIFAR normalization).
- `resnet18_feature_extraction` on CIFAR-10 (Resize/CenterCrop 224, ImageNet normalization).
- `resnet18_finetuned` on CIFAR-10 (Resize/CenterCrop 128, ImageNet normalization).
- `distilbert_imdb_finetuned` on IMDb (DistilBERT tokenizer, max length 128).

Behavior:
- Evaluations always use the held-out test split; historical evaluation JSON is never substituted.
- States: QUEUED -> RUNNING -> SUCCEEDED | FAILED | CANCELLED, with queued/running progress and incremental logs.
- One background worker runs evaluations sequentially; history is persisted in SQLite and survives restarts.
- Every evaluation gets `artifacts/app/evaluations/<evaluation_id>/` with `results.json`, `metrics.json`, `evaluation.json`, `config.json`, and `evaluation.log`; existing checkpoints are read-only.
- Config: `batch_size` 1-512, `max_samples` optional, `num_workers` 0-8. Unknown config fields are rejected.
- Cancellation is cooperative between batches; cancelled runs report no partial metrics.
- Interrupted evaluations are marked `FAILED` with `RESTART_INTERRUPTED`; they cannot resume mid-run.
- API paths are reported relative to the artifact root, and failures expose safe messages rather than stack traces or absolute paths.

Real-checkpoint verification (sample-limited, CPU):
- MNIST CNN, 300 test samples: accuracy 0.9933, macro F1 0.9914, 10x10 confusion matrix.
- CIFAR-10 custom CNN, 200 test samples: accuracy 0.7300, macro F1 0.7232, 10x10 confusion matrix.

Tests: `tests/test_api_evaluations.py` uses a synthetic pipeline plus tiny synthetic models, never runs full CIFAR-10/IMDb evaluations, and covers creation, transitions, listing, metrics, confusion matrices, invalid inputs, checkpoint failures, persistence, isolation, and cancellation (21 tests). Full suite: 126 passed.

## Image & NLP Inference APIs (Milestone 5, Task 6)

Endpoints:
- GET /api/v1/inference/image/models
- POST /api/v1/inference/image (multipart: `file`, `model_id`, `top_k`)
- GET /api/v1/inference/nlp/models
- POST /api/v1/inference/nlp/sentiment
- POST /api/v1/inference/nlp/embeddings
- POST /api/v1/inference/nlp/ner

Architecture:
- `src/api/inference/image.py`: upload validation, model-specific preprocessing, lazy checkpoint cache, CPU inference.
- `src/api/inference/nlp.py`: adapters over the existing `NLPService`, local-cache availability, safe error mapping.
- `src/api/routers/inference.py`, `src/api/schemas_inference.py`: HTTP layer and schemas.
- `src/nlp/service.py`: model loading is now guarded by a re-entrant cache lock; added `clear_cache()` and `cached_tasks`.
- `requirements.txt`: added `python-multipart` for multipart uploads.

Image models:
- `mnist_cnn`: grayscale, 28x28, MNIST normalization.
- `cifar10_custom_cnn`, `cifar10_custom_cnn_baseline`: RGB, 32x32, CIFAR normalization.
- `resnet18_feature_extraction`: RGB, resize/center crop 224, ImageNet normalization.
- `resnet18_finetuned`: RGB, resize/center crop 128, ImageNet normalization.

Image behavior:
- Accepts PNG/JPEG/WebP, maximum 5 MB and 25 megapixels; MIME, decoded format, corruption, and dimensions are validated.
- Returns predicted class/index, confidence, top-k predictions, inference time, and image metadata.
- Registered checkpoints only; arbitrary paths and uploaded checkpoints are rejected.
- Models load lazily once per model ID under a lock; cache entries refresh when the checkpoint fingerprint changes.
- Missing checkpoints return 503 `MODEL_UNAVAILABLE`; corrupted/incompatible checkpoints return 503 `MODEL_LOAD_ERROR` with safe messages.

NLP tasks:
- Sentiment: fine-tuned `distilbert_imdb_finetuned` or pretrained SST-2.
- Embeddings: mean-pooled `distilbert-base-uncased`, 768 dimensions.
- NER: `elastic/distilbert-base-uncased-finetuned-conll03-english`.
- Text limit 10,000 characters; embedding batches 1-16; blank text rejected.
- API uses `local_files_only=True`; requests never download models. Missing cache entries return 503 `MODEL_UNAVAILABLE`.
- `NLPService` caches each tokenizer/model once under a lock; inference is serialized on CPU.

Real verification (local checkpoints/cache, CPU):
- MNIST image classification: predicted `0`, confidence 0.5501, 4.2 ms.
- CIFAR-10 custom CNN: predicted `cat`, 8.2 ms.
- Fine-tuned IMDb sentiment: POSITIVE, 0.7774.
- Embeddings: 2x768 finite values.
- NER: extracted PER/LOC/ORG entities with scores.

Tests: `tests/test_api_inference.py` covers valid image inference, top-k, formats, corruption, oversized uploads, invalid models, missing/corrupt checkpoints, preprocessing shapes, model caching, sentiment, embeddings, NER, text limits, unavailable models, schemas, and thread-safe NLP caching (22 tests). Full suite: 148 passed.
