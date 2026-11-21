# DeepVision AI Studio — API Contracts (v1)

Base URL: `/api/v1`. All responses are JSON. Errors use a consistent envelope.

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "human readable", "details": {} } }
```

## 0. Health & Readiness

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness probe |
| GET | `/ready` | DB and artifact-root readiness |

`GET /health` → `{ "status": "ok", "version": "1.0.0" }`

## 1. Dashboard

| Method | Path | Purpose |
|---|---|---|
| GET | `/dashboard/stats` | Real counts and recent activity |

```json
{
  "datasets": 2,
  "models": 5,
  "training_runs": 3,
  "evaluations": 4,
  "best_cifar10_accuracy": 0.8644,
  "best_nlp_f1": 0.7845,
  "recent_runs": [
    { "run_id": "run_...", "model": "resnet18", "status": "SUCCEEDED", "created_at": "..." }
  ]
}
```

## 2. Datasets

| Method | Path | Purpose |
|---|---|---|
| GET | `/datasets` | List datasets |
| GET | `/datasets/{id}` | Dataset detail |
| POST | `/datasets/validate` | Validate an import request |
| POST | `/datasets/import` | Register dataset metadata |

Dataset schema:
```json
{
  "id": "cifar10",
  "name": "CIFAR-10",
  "task": "image_classification",
  "classes": 10,
  "train_size": 50000,
  "test_size": 10000,
  "source": "torchvision",
  "path": "data/raw",
  "metadata": { "image_size": 32, "channels": 3 }
}
```

Import request: `{ "name": str, "task": str, "path": str, "source": str }`

## 3. Model Training

| Method | Path | Purpose |
|---|---|---|
| GET | `/training/presets` | Allowed model/dataset/config presets |
| POST | `/training/jobs` | Create background training job |
| GET | `/training/jobs` | List jobs |
| GET | `/training/jobs/{job_id}` | Status and metrics |
| GET | `/training/jobs/{job_id}/logs` | Incremental logs (`?since=line`) |
| POST | `/training/jobs/{job_id}/cancel` | Cooperative cancellation |

Supported models: `cifar_cnn` (CIFAR-10), `resnet18_feature_extraction` (CIFAR-10),
`resnet18_finetuning` (CIFAR-10), `mnist_cnn` (MNIST). Requesting an unsupported
model or an incompatible dataset returns 400 with the supported options.

Create request:
```json
{
  "model": "cifar_cnn",
  "dataset": "cifar10",
  "config": {
    "epochs": 1,
    "batch_size": 128,
    "learning_rate": 0.001,
    "weight_decay": 0.0005,
    "val_fraction": 0.1,
    "seed": 42,
    "num_workers": 0,
    "image_size": 32
  }
}
```

Config fields: `epochs` 1-20, `batch_size` 1-512, `learning_rate` > 0,
`weight_decay` >= 0, `val_fraction` 0-0.5, `seed`, `num_workers` 0-8,
`image_size` 28-224. Omitted fields use preset defaults.

Job response:
```json
{
  "job_id": "job_01",
  "model": "cifar_cnn",
  "dataset": "cifar10",
  "state": "RUNNING",
  "current_epoch": 1,
  "total_epochs": 2,
  "current_batch": 60,
  "total_batches": 120,
  "progress": 0.25,
  "metrics": { "train_loss": 1.1, "train_acc": 0.6, "val_loss": 1.0, "val_acc": 0.65 },
  "created_at": "2026-11-19T14:00:00Z",
  "started_at": "2026-11-19T14:00:01Z",
  "completed_at": null,
  "elapsed_seconds": 12.4,
  "cancel_requested": false,
  "queue_position": null,
  "device": "cpu",
  "artifact_dir": "artifacts/app/job_01",
  "checkpoint_path": "artifacts/app/job_01/best.pt",
  "history_path": "artifacts/app/job_01/history.json",
  "metrics_path": "artifacts/app/job_01/metrics.json",
  "metadata_path": "artifacts/app/job_01/metadata.json",
  "config_path": "artifacts/app/job_01/config.json",
  "error": null
}
```

States: `QUEUED` -> `RUNNING` -> `SUCCEEDED` | `FAILED` | `CANCELLED`.
Jobs are persisted in SQLite (`training_jobs`), so states survive API restarts.

Cancellation: `POST /training/jobs/{job_id}/cancel` marks `cancel_requested` and
stops a queued job immediately; a running job checks the flag between batches and
finalizes as `CANCELLED`. Cancelling a terminal job returns 409.

Logs: `GET /training/jobs/{job_id}/logs?since=N` returns lines from index `N`,
`next_since`, `total_lines`, and `complete` (true for terminal states).

Artifacts per job under `artifacts/app/<job_id>/`: `best.pt`, `history.json`,
`metrics.json`, `metadata.json`, `config.json`, `training.log`.

Restart limitation: jobs left `QUEUED`/`RUNNING` when the process exits are not
automatically resumed; create a new job instead.

CPU reference (1 epoch, batch 32): MNIST under 1 minute; CIFAR-10 CNN a few
minutes; ResNet18 transfer learning longer. Tests inject a fake pipeline and never
run real training.

Error responses use `{"error": {"code": str, "message": str, "details": ...}}` with
codes such as `NOT_FOUND` (unsupported model/job), `VALIDATION_ERROR` (invalid
config or model/dataset mismatch), `CONFLICT` (artifact directory exists),
`CANCELLED` (job already terminal), and `INVALID_PATH`. A failed job stores
`TRAINING_FAILED` in its `error` field.

## 4. Model Evaluation

| Method | Path | Purpose |
|---|---|---|
| GET | `/evaluations/presets` | Supported model/dataset combinations and default config |
| POST | `/evaluations` | Run a registered checkpoint on a held-out test split |
| GET | `/evaluations` | List evaluation history (`?state=SUCCEEDED&limit=50`) |
| GET | `/evaluations/{evaluation_id}` | Status and metric summary |
| GET | `/evaluations/{evaluation_id}/results` | Full metrics, per-class values, confusion matrix |
| GET | `/evaluations/{evaluation_id}/logs` | Incremental logs (`?since=line`) |
| POST | `/evaluations/{evaluation_id}/cancel` | Cooperative cancellation |

Supported combinations:

| Model ID | Dataset | Preprocessing |
|---|---|---|
| `mnist_cnn` | `mnist` | 1x28x28, mean 0.1307 / std 0.3081 |
| `cifar10_custom_cnn` | `cifar10` | 3x32x32, CIFAR mean/std |
| `cifar10_custom_cnn_baseline` | `cifar10` | 3x32x32, CIFAR mean/std |
| `resnet18_feature_extraction` | `cifar10` | Resize/CenterCrop 224, ImageNet mean/std |
| `resnet18_finetuned` | `cifar10` | Resize/CenterCrop 128, ImageNet mean/std |
| `distilbert_imdb_finetuned` | `imdb` | `distilbert-base-uncased`, max length 128 |

Evaluation always uses the held-out test split (`train=False` for MNIST/CIFAR-10
and the official IMDb `test` split). Training data is never evaluated, and
existing evaluation JSON files are never reused.

Create request:
```json
{
  "model": "mnist_cnn",
  "dataset": "mnist",
  "config": { "batch_size": 64, "max_samples": 1000, "num_workers": 0 }
}
```

Config fields: `batch_size` 1-512, `max_samples` optional 1-100000 (omit or
`null` for the full test split), `num_workers` 0-8. Unknown fields are rejected.

Evaluation response:
```json
{
  "evaluation_id": "eval_4f1c2a9b7d3e5061",
  "model": "mnist_cnn",
  "dataset": "mnist",
  "architecture": "MNISTCNN",
  "task": "image_classification",
  "state": "SUCCEEDED",
  "progress": 1.0,
  "samples_evaluated": 1000,
  "total_samples": 1000,
  "metrics": {
    "accuracy": 0.993,
    "macro_precision": 0.9915,
    "macro_recall": 0.9917,
    "macro_f1": 0.9914
  },
  "created_at": "2026-11-20T02:10:00Z",
  "started_at": "2026-11-20T02:10:00Z",
  "completed_at": "2026-11-20T02:10:09Z",
  "elapsed_seconds": 8.6,
  "cancel_requested": false,
  "queue_position": null,
  "device": "cpu",
  "artifact_dir": "app/evaluations/eval_4f1c2a9b7d3e5061",
  "source_checkpoint": "artifacts/mnist_baseline.pt",
  "results_path": "app/evaluations/eval_4f1c2a9b7d3e5061/results.json",
  "metrics_path": "app/evaluations/eval_4f1c2a9b7d3e5061/metrics.json",
  "metadata_path": "app/evaluations/eval_4f1c2a9b7d3e5061/evaluation.json",
  "error": null
}
```

Results response:
```json
{
  "evaluation_id": "eval_4f1c2a9b7d3e5061",
  "model": "mnist_cnn",
  "dataset": "mnist",
  "task": "image_classification",
  "state": "SUCCEEDED",
  "classes": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
  "sample_count": 1000,
  "evaluation_seconds": 8.4,
  "accuracy": 0.993,
  "macro_precision": 0.9915,
  "macro_recall": 0.9917,
  "macro_f1": 0.9914,
  "macro": { "precision": 0.9915, "recall": 0.9917, "f1": 0.9914 },
  "per_class": {
    "0": { "precision": 0.99, "recall": 1.0, "f1": 0.995, "support": 98 }
  },
  "confusion_matrix": [[97, 0, "..."], "..."],
  "device": "cpu",
  "completed_at": "2026-11-20T02:10:09Z",
  "artifact_dir": "app/evaluations/eval_4f1c2a9b7d3e5061"
}
```

Confusion matrix rows are true labels and columns are predicted labels in
`classes` order. Per-class zero-support classes report 0.0 precision, recall,
and F1. `macro` averages all classes.

States: `QUEUED` -> `RUNNING` -> `SUCCEEDED` | `FAILED` | `CANCELLED`.
Evaluation records are persisted in SQLite (`evaluation_records`), so history
survives API restarts. Results and logs are written per evaluation under
`artifacts/app/evaluations/<evaluation_id>/`; the API reports paths relative to
the artifact root and never exposes absolute filesystem paths.

Cancellation: queued evaluations stop immediately. Running evaluations check the
cancel flag between batches and finalize as `CANCELLED`. Cancelling a terminal
evaluation returns 409. No partial metrics are reported for cancelled runs.

Limitations: interrupted `QUEUED`/`RUNNING` evaluations are re-queued or marked
`FAILED` with `RESTART_INTERRUPTED`; they cannot resume mid-run. `max_samples`
limits reported sample count. CPU-only DistilBERT and ResNet evaluations can be
slow on the full test split. Evaluation accepts only the fixed registry catalog;
arbitrary user model files are rejected. Checkpoints are trusted local project
artifacts and are never overwritten.

Evaluation error codes include `MODEL_UNAVAILABLE`, `DATASET_UNAVAILABLE`,
`CHECKPOINT_MISSING`, `INVALID_CHECKPOINT`, `INCOMPATIBLE_CHECKPOINT`,
`RESULTS_NOT_AVAILABLE`, `RESTART_INTERRUPTED`, and `EVALUATION_FAILED`.

## 5. AI Playground (Image)

| Method | Path | Purpose |
|---|---|---|
| GET | `/inference/image/models` | Supported image models and checkpoint availability |
| POST | `/inference/image` | Multipart image classification |

Supported models: `mnist_cnn`, `cifar10_custom_cnn`,
`cifar10_custom_cnn_baseline`, `resnet18_feature_extraction`,
`resnet18_finetuned`. Only registry checkpoints are accepted; uploaded model
files and filesystem paths are rejected.

Form fields: `file` (required), `model_id` (required), `top_k` (1-10, default 3).

Upload limits and validation:
- PNG, JPEG, or WebP MIME types only; actual decoded format must match.
- Maximum upload size: 5 MB.
- Maximum decoded image size: 25 megapixels.
- Corrupted, truncated, empty, or unsupported images return 400/415 before inference.

Preprocessing:

| Model | Input processing |
|---|---|
| `mnist_cnn` | Convert to grayscale, resize 28x28, MNIST normalization |
| `cifar10_custom_cnn(_baseline)` | Convert to RGB, resize 32x32, CIFAR normalization |
| `resnet18_feature_extraction` | Convert to RGB, resize 224, center crop 224, ImageNet normalization |
| `resnet18_finetuned` | Convert to RGB, resize 128, center crop 128, ImageNet normalization |

Response:
```json
{
  "model_id": "mnist_cnn",
  "predicted_class": "0",
  "class_index": 0,
  "confidence": 0.5501,
  "top_k": [
    { "class_index": 0, "label": "0", "probability": 0.5501 },
    { "class_index": 6, "label": "6", "probability": 0.1422 }
  ],
  "inference_ms": 4.193,
  "image": { "width": 28, "height": 28, "format": "PNG" }
}
```

Model loading is lazy and cached per model ID. The cache is invalidated when the
checkpoint file fingerprint changes. Loading is guarded by a lock; inference
runs on CPU with `torch.inference_mode()`. Missing checkpoints return
`MODEL_UNAVAILABLE` (503); unreadable or architecture-incompatible checkpoints
return `MODEL_LOAD_ERROR` (503) without exposing loader internals.

## 6. NLP Playground

| Method | Path | Purpose |
|---|---|---|
| GET | `/inference/nlp/models` | NLP tasks/models and local cache availability |
| POST | `/inference/nlp/sentiment` | Fine-tuned or pretrained sentiment |
| POST | `/inference/nlp/embeddings` | Mean-pooled DistilBERT embeddings |
| POST | `/inference/nlp/ner` | Named entity recognition |

API resources are local-cache only (`local_files_only=True`); an API request never
downloads a model. Missing local model files return `MODEL_UNAVAILABLE` (503).

Supported tasks:
- Sentiment: `distilbert_imdb_finetuned` (checkpoint) or
  `distilbert-base-uncased-finetuned-sst-2-english` (pretrained cache).
- Embeddings: `distilbert-base-uncased`, mean-pooled, 768 dimensions.
- NER: `elastic/distilbert-base-uncased-finetuned-conll03-english`.

Text limits: 1-10,000 characters per text; blank/whitespace-only text is
rejected. Embedding batches accept 1-16 texts.

Sentiment request and response:
```json
{ "text": "A wonderful film", "model": "finetuned" }
```
```json
{
  "task": "sentiment",
  "model_id": "distilbert_imdb_finetuned",
  "label": "POSITIVE",
  "score": 0.7774,
  "inference_ms": 2616.571
}
```

Embeddings request and response:
```json
{ "texts": ["first text", "second text"] }
```
```json
{
  "task": "embeddings",
  "model_id": "distilbert-base-uncased",
  "count": 2,
  "dimension": 768,
  "embeddings": [[0.12, -0.03, "..."]],
  "inference_ms": 378.133
}
```

NER request and response:
```json
{ "text": "Barack Obama visited Paris." }
```
```json
{
  "task": "ner",
  "model_id": "elastic/distilbert-base-uncased-finetuned-conll03-english",
  "entities": [
    { "text": "Barack Obama", "label": "PER", "score": 0.9846 },
    { "text": "Paris", "label": "LOC", "score": 0.9990 }
  ],
  "inference_ms": 409.466
}
```

`NLPService` lazily loads and caches tokenizers/models under a re-entrant lock,
so concurrent API requests load each task at most once. Inference calls are
serialized on CPU to keep latency predictable and avoid contention. Unavailable
models and loader failures are translated to safe error responses.

## 7. Model Registry

| Method | Path | Purpose |
|---|---|---|
| GET | `/registry/models` | List model versions |
| GET | `/registry/models/{id}` | Architecture, dataset, metrics |
| POST | `/registry/models` | Register an existing checkpoint (no overwrite) |
| DELETE | `/registry/models/{id}` | Soft-delete record only |

Model record:
```json
{
  "id": "resnet18_finetuned",
  "name": "ResNet18 fine-tuned",
  "architecture": "resnet18",
  "task": "image_classification",
  "dataset": "cifar10",
  "checkpoint_path": "artifacts/resnet18_finetuned.pt",
  "parameters": 11181642,
  "image_size": 128,
  "metrics": { "accuracy": 0.8644, "macro_f1": 0.8639 },
  "created_at": "..."
}
```

## 8. Settings

| Method | Path | Purpose |
|---|---|---|
| GET | `/settings/runtime` | Device, threads, versions |
| GET | `/settings/storage` | Artifact/data sizes |
| GET | `/settings/models` | Model configuration |
| PATCH | `/settings` | Non-destructive app settings |

```json
{
  "device": "cpu",
  "torch_version": "2.15.0+cpu",
  "transformers_version": "5.23.0",
  "cpu_count": 12,
  "threads": 8,
  "artifact_root": "artifacts",
  "data_root": "data"
}
```

## 9. Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Invalid input or incompatible model/dataset |
| `NOT_FOUND` | 404 | Missing evaluation/model/dataset |
| `CONFLICT` | 409 | Duplicate registration / artifact exists |
| `MODEL_UNAVAILABLE` | 409 / 503 | Checkpoint or local model cache unavailable |
| `DATASET_UNAVAILABLE` | 409 | Dataset files are not available locally |
| `FILE_TOO_LARGE` | 413 | Upload exceeds the 5 MB limit |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Upload MIME type is not PNG/JPEG/WebP |
| `INVALID_IMAGE` | 400 | Image is empty, corrupted, or unsupported |
| `INFERENCE_FAILED` | 500 | Model returned invalid inference output |
| `CHECKPOINT_MISSING` | job error | Checkpoint disappeared before evaluation |
| `INVALID_CHECKPOINT` | job error | Checkpoint is corrupted or has no state dict |
| `INCOMPATIBLE_CHECKPOINT` | job error | State dict does not match the architecture |
| `RESULTS_NOT_AVAILABLE` | 409 | Evaluation has no successful results |
| `EVALUATION_FAILED` | job error | Isolated evaluation runner failure |
| `RESTART_INTERRUPTED` | job error | Backend restarted during evaluation |
| `MODEL_LOAD_ERROR` | 500 / 503 | Checkpoint/model load failure |
| `TRAINING_FAILED` | 500 | Training runner failure |
| `CANCELLED` | 409 | Job already cancelled/completed |

## Dataset Endpoints (implemented)

`GET /api/v1/datasets` returns the local registry. Example item:
```json
{
  "dataset_id": "cifar10",
  "available": true,
  "train_size": 50000,
  "test_size": 10000,
  "num_classes": 10,
  "classes": ["airplane", "automobile", "bird", "cat", "deer", "dog", "frog", "horse", "ship", "truck"],
  "input": {"channels": 3, "height": 32, "width": 32}
}
```

`GET /api/v1/datasets/mnist/statistics`:
```json
{
  "expected_val_size": 6000,
  "expected_train_after_split": 54000
}
```

`POST /api/v1/datasets/validate`:
```json
{ "dataset_id": "cifar10" }
```
Returns `valid`, `status`, per-check results, and `missing_files`.
