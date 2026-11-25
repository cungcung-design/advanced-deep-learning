# DeepVision AI Studio — API Contracts (v1)

Base URL: `/api/v1` (mounted in [src/api/main.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/main.py)). All responses are JSON.

## Error Envelope

All domain and validation errors return a consistent JSON structure ([src/api/errors.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/errors.py), [src/api/schemas.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/schemas.py)):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable explanation",
    "details": {}
  }
}
```

---

## 0. Health & Readiness

Implemented in [src/api/routers/health.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/routers/health.py) and [src/api/services/health.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/services/health.py). Mounted at both the root (`/health`, `/health/ready`) and under `/api/v1` (`/api/v1/health`, `/api/v1/health/ready`).

| Method | Path | Success / Degraded Status | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/health` (and `/health`) | `200 OK` | Liveness probe |
| `GET` | `/api/v1/health/ready` (and `/health/ready`) | `200 OK` / `503 Service Unavailable` | SQLite database and artifact-root write probe |

### `GET /api/v1/health` → `HealthResponse`
```json
{
  "status": "ok",
  "version": "1.0.0",
  "app": "DeepVision AI Studio"
}
```

### `GET /api/v1/health/ready` → `ReadinessResponse`
```json
{
  "status": "ready",
  "database": true,
  "artifact_root": true,
  "artifact_root_writable": true
}
```

- **HTTP 503 Degraded Readiness Behavior**: When any check fails (`database`, `artifact_root`, or `artifact_root_writable`), the endpoint returns **HTTP `503`** with the **exact same `ReadinessResponse` JSON body** (`"status": "not_ready"` and boolean flags per probe) rather than an error envelope. Clients must parse `503` bodies as structured readiness telemetry rather than treating them as a generic network failure.
- **Write Probe Side Effect**: Each call to `/health/ready` writes and unlinks a temporary `.write_probe` file inside `artifact_root`.

---

## 1. Settings & System Diagnostics (Read-Only)

Implemented in [src/api/routers/settings.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/routers/settings.py) and [src/api/services/settings.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/services/settings.py). All endpoints are read-only (`GET`); no `PATCH`, `PUT`, or `POST` mutation endpoint exists.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/settings` | Full runtime, host memory, storage, and model capability payload |
| `GET` | `/api/v1/settings/runtime` | Python, PyTorch, Transformers, device, CPU cores, threads, platform |
| `GET` | `/api/v1/settings/storage` | Artifact/data root paths, byte sizes, file counts, and disk capacity |
| `GET` | `/api/v1/settings/models` | Registered models and their supported task capabilities |

### `GET /api/v1/settings` → `SettingsResponse`
```json
{
  "runtime": {
    "app_version": "1.0.0",
    "python_version": "3.14.10",
    "torch_version": "2.15.0+cpu",
    "transformers_version": "5.24.0",
    "device": "cpu",
    "cuda_available": false,
    "cpu_count": 16,
    "threads": 8,
    "platform": "Windows-11-10.0.26300-SP0"
  },
  "memory": {
    "total_bytes": 34002464768,
    "available_bytes": 12283252736
  },
  "storage": {
    "artifact_root": "<repo>/artifacts",
    "artifact_bytes": 464622578,
    "artifact_files": 39,
    "data_root": "<repo>/data",
    "data_bytes": 423256955,
    "data_files": 19,
    "disk_total_bytes": 647239823360,
    "disk_free_bytes": 634226057216
  },
  "models": [
    {
      "model_id": "resnet18_finetuned",
      "display_name": "ResNet18 Fine-tuned",
      "task": "image_classification",
      "capabilities": ["predict", "evaluate", "top_k"]
    }
  ]
}
```

Nullable fields: `torch_version`, `transformers_version`, `cpu_count`, `threads`, `memory.total_bytes`, `memory.available_bytes`, `storage.disk_total_bytes`, and `storage.disk_free_bytes` may be `null` depending on platform support.

---

## 2. Datasets

Implemented in [src/api/routers/datasets.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/routers/datasets.py), [src/api/schemas_datasets.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/schemas_datasets.py), and [src/api/services/datasets.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/services/datasets.py).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/datasets` | List all registered datasets (`mnist`, `cifar10`, `imdb`) |
| `GET` | `/api/v1/datasets/{dataset_id}` | 20-field dataset summary and metadata (`404 NOT_FOUND` if unknown) |
| `GET` | `/api/v1/datasets/{dataset_id}/statistics` | Split totals, expected validation split, file count, and size |
| `POST` | `/api/v1/datasets/validate` | Execute 5 local integrity checks without downloading files |

> **Note:** No dataset import, upload, edit, or delete endpoint exists.

### `GET /api/v1/datasets` → `DatasetListResponse`
Returns `{ "datasets": DatasetSummary[], "count": 3 }`.

### `GET /api/v1/datasets/{dataset_id}` → `DatasetSummary`
```json
{
  "dataset_id": "mnist",
  "display_name": "MNIST",
  "description": "Handwritten digit classification dataset.",
  "dataset_type": "image",
  "task": "image_classification",
  "source": "torchvision",
  "available": true,
  "status": "available",
  "missing_files": [],
  "local_path": "<repo>/data/raw/MNIST",
  "local_size_bytes": 66544770,
  "local_file_count": 8,
  "train_size": 60000,
  "test_size": 10000,
  "val_fraction": 0.1,
  "num_classes": 10,
  "classes": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
  "input": { "channels": 1, "height": 28, "width": 28 },
  "preprocessing": {
    "normalize_mean": [0.1307],
    "normalize_std": [0.3081],
    "augmentation": "RandomAffine"
  },
  "config_path": "<repo>/configs/mnist_cpu.json"
}
```

### `GET /api/v1/datasets/{dataset_id}/statistics` → `DatasetStatistics`
```json
{
  "dataset_id": "mnist",
  "available": true,
  "local_size_bytes": 66544770,
  "local_file_count": 8,
  "train_size": 60000,
  "test_size": 10000,
  "expected_val_size": 6000,
  "expected_train_after_split": 54000,
  "num_classes": 10,
  "classes": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
}
```

### `POST /api/v1/datasets/validate` → `ValidationResponse`
Request body (`ValidateRequest`):
```json
{ "dataset_id": "mnist" }
```
Response:
```json
{
  "dataset_id": "mnist",
  "valid": true,
  "status": "valid",
  "checks": [
    { "name": "supported_id", "passed": true },
    { "name": "local_files", "passed": true },
    { "name": "split_totals", "passed": true },
    { "name": "class_metadata", "passed": true },
    { "name": "input_spec", "passed": true }
  ],
  "missing_files": []
}
```

---

## 3. Model Training

Implemented in [src/api/routers/training.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/routers/training.py), [src/api/schemas_training.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/schemas_training.py), and `src/api/training/`.

| Method | Path | Success | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/training/presets` | `200` | Allowed model/dataset presets and default hyperparameters |
| `POST` | `/api/v1/training/jobs` | `201` | Enqueue a background CPU training job |
| `GET` | `/api/v1/training/jobs` | `200` | List training jobs (`?limit=50`, range `1–200`, newest first) |
| `GET` | `/api/v1/training/jobs/{job_id}` | `200` | Job status, normalized progress (`0..1`), metrics, and paths |
| `GET` | `/api/v1/training/jobs/{job_id}/logs` | `200` | Incremental log lines (`?since=0&limit=500`, `limit` `1–2000`) |
| `POST` | `/api/v1/training/jobs/{job_id}/cancel` | `200` | Cooperative cancellation (`409 CANCELLED` if already terminal) |

Supported presets (`GET /api/v1/training/presets`):
- `cifar_cnn` (`cifar10`, fixed `image_size: 32`)
- `resnet18_feature_extraction` (`cifar10`, default `image_size: 128`)
- `resnet18_finetuning` (`cifar10`, default `image_size: 128`)
- `mnist_cnn` (`mnist`, fixed `image_size: 28`)

### Create Request (`CreateTrainingJobRequest`)
```json
{
  "model": "mnist_cnn",
  "dataset": "mnist",
  "config": {
    "epochs": 1,
    "batch_size": 64,
    "learning_rate": 0.001,
    "weight_decay": 0.0005,
    "val_fraction": 0.1,
    "seed": 42,
    "num_workers": 0,
    "image_size": 28
  }
}
```
Validation limits (`TrainingConfig`): `epochs` `1–20`, `batch_size` `1–512`, `learning_rate` `> 0` (`<= 10`), `weight_decay` `>= 0` (`<= 1`), `val_fraction` `> 0` and `< 0.5`, `seed` integer, `num_workers` `0–8`, `image_size` `28–224`.

### Job Response (`TrainingJobResponse`)
```json
{
  "job_id": "job_a6fba186c0a34ff0",
  "model": "mnist_cnn",
  "dataset": "mnist",
  "state": "SUCCEEDED",
  "current_epoch": 1,
  "total_epochs": 1,
  "current_batch": 844,
  "total_batches": 844,
  "progress": 1.0,
  "metrics": {
    "train_loss": 0.2145,
    "train_acc": 0.9352,
    "val_loss": 0.1381,
    "val_acc": 0.9572
  },
  "created_at": "2026-11-24T05:10:00+00:00",
  "started_at": "2026-11-24T05:10:01+00:00",
  "completed_at": "2026-11-24T05:10:35+00:00",
  "elapsed_seconds": 34.1,
  "cancel_requested": false,
  "queue_position": null,
  "device": "cpu",
  "artifact_dir": "app/job_a6fba186c0a34ff0",
  "checkpoint_path": "app/job_a6fba186c0a34ff0/checkpoint.pt",
  "history_path": "app/job_a6fba186c0a34ff0/history.json",
  "metrics_path": "app/job_a6fba186c0a34ff0/metrics.json",
  "metadata_path": "app/job_a6fba186c0a34ff0/job.json",
  "config_path": "app/job_a6fba186c0a34ff0/config.json",
  "error": null
}
```
- `progress` is a normalized float in `[0.0, 1.0]`. Frontend views multiply by `100` to display percentages.
- Pending queue capacity is `4` jobs (a 5th queued job returns `409 QUEUE_FULL` with `details: { "max_queue": 4 }`).
- Artifacts are written to `artifacts/app/<job_id>/` (`checkpoint.pt`, `history.json`, `metrics.json`, `job.json`, `config.json`, `training.log`, and `model.json` on success).

---

## 4. Model Evaluation

Implemented in [src/api/routers/evaluations.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/routers/evaluations.py), [src/api/schemas_evaluation.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/schemas_evaluation.py), and `src/api/evaluation/`.

| Method | Path | Success | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/evaluations/presets` | `200` | Supported model/dataset combinations and default config |
| `POST` | `/api/v1/evaluations` | `201` | Enqueue held-out test split evaluation |
| `GET` | `/api/v1/evaluations` | `200` | List evaluations (`?state=SUCCEEDED&limit=50`, `limit` `1–200`) |
| `GET` | `/api/v1/evaluations/{evaluation_id}` | `200` | Evaluation status and summary metrics |
| `GET` | `/api/v1/evaluations/{evaluation_id}/results` | `200` | Per-class metrics, macro averages, and confusion matrix |
| `GET` | `/api/v1/evaluations/{evaluation_id}/logs` | `200` | Incremental log lines (`?since=0&limit=500`, `limit` `1–2000`) |
| `POST` | `/api/v1/evaluations/{evaluation_id}/cancel` | `200` | Cooperative cancellation |

Supported presets: `mnist_cnn` (`mnist`), `cifar10_custom_cnn` (`cifar10`), `cifar10_custom_cnn_baseline` (`cifar10`), `resnet18_feature_extraction` (`cifar10`), `resnet18_finetuned` (`cifar10`), `distilbert_imdb_finetuned` (`imdb`).

Config (`EvaluationConfig`, strict — unknown fields rejected with `422`): `batch_size` `1–512`, `max_samples` `1–100000` or `null`, `num_workers` `0–8`.

---

## 5. AI Playground (Image Inference)

Implemented in [src/api/routers/inference.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/routers/inference.py), [src/api/schemas_inference.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/schemas_inference.py), and [src/api/inference/image.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/inference/image.py).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/inference/image/models` | List image models and local checkpoint availability |
| `POST` | `/api/v1/inference/image` | Multipart image classification (`file`, `model_id`, `top_k` `1–10`) |

### `GET /api/v1/inference/image/models` → `ImageModelListResponse`
```json
{
  "models": [
    {
      "model_id": "mnist_cnn",
      "display_name": "MNIST CNN Baseline",
      "architecture": "MNISTCNN",
      "dataset": "mnist",
      "image_size": 28,
      "available": true
    }
  ],
  "count": 5
}
```
Validation limits: PNG, JPEG, or WebP; max `5 MB` (`413 FILE_TOO_LARGE`); max `25 megapixels`; decoded format must match MIME (`400 INVALID_IMAGE` / `415 UNSUPPORTED_MEDIA_TYPE`). Missing checkpoints return `503 MODEL_UNAVAILABLE`.

---

## 6. NLP Playground (Text Inference)

Implemented in [src/api/routers/inference.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/routers/inference.py), [src/api/schemas_inference.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/schemas_inference.py), and [src/api/inference/nlp.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/inference/nlp.py).

| Method | Path | Request Body | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/inference/nlp/models` | None | List NLP models (`task`, `kind`, `available`) |
| `POST` | `/api/v1/inference/nlp/sentiment` | `{ "text": str, "model": "finetuned" \| "pretrained" }` | Sentiment classification (`1–10000` chars) |
| `POST` | `/api/v1/inference/nlp/embeddings` | `{ "texts": string[] }` (`1–16` non-empty texts) | Mean-pooled 768-D embeddings |
| `POST` | `/api/v1/inference/nlp/ner` | `{ "text": str }` (`1–10000` chars) | CoNLL-03 Named Entity Recognition |

All NLP requests run with `local_files_only=True`. Missing local checkpoints or Hugging Face cache entries return `503 MODEL_UNAVAILABLE`.

---

## 7. Model Registry (Read-Only)

Implemented in [src/api/routers/registry.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/routers/registry.py), [src/api/schemas.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/schemas.py), and [src/api/services/registry.py](file:///d:/Developer/Projects/advanced-deep-learning/src/api/services/registry.py).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/registry/models` | List all catalog models and discovered trained-job checkpoints |
| `GET` | `/api/v1/registry/models/{model_id}` | Single model record (`404 NOT_FOUND` if unknown) |

> **Note:** No `POST`, `DELETE`, or checkpoint download endpoint exists.

### `GET /api/v1/registry/models/{model_id}` → `RegistryModel`
```json
{
  "model_id": "resnet18_finetuned",
  "display_name": "ResNet18 Fine-tuned",
  "architecture": "ResNet18",
  "task": "image_classification",
  "artifact_path": "<repo>/artifacts/resnet18_finetuned.pt",
  "checkpoint_size_bytes": 112011286,
  "config_path": "<repo>/configs/resnet18_finetuning_optimized.json",
  "evaluation_path": "<repo>/artifacts/resnet18_finetuned_evaluation.json",
  "metrics": {
    "accuracy": 0.8644,
    "macro_f1": 0.8639,
    "macro_precision": 0.8647,
    "macro_recall": 0.8644
  },
  "available": true,
  "status": "available",
  "error": null
}
```
When a checkpoint file is absent on disk, `available` is `false`, `status` is `"missing"` (or `"invalid"` if unreadable), `checkpoint_size_bytes` is `null`, and `error` reports `"Checkpoint file not found"`.

---

## 8. Error Codes Summary

| Code | HTTP Status | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | `422` | Invalid request payload, hyperparameter out of bounds, or incompatible model/dataset |
| `NOT_FOUND` | `404` | Unknown dataset, model, training job, evaluation, or API route |
| `CONFLICT` | `409` | Artifact directory collision |
| `QUEUE_FULL` | `409` | Pending training or evaluation queue has reached capacity (`max_queue: 4`) |
| `CANCELLED` | `409` | Job or evaluation has already reached a terminal state |
| `RESULTS_NOT_AVAILABLE` | `409` | Evaluation has not completed with `SUCCEEDED` results |
| `DATASET_UNAVAILABLE` | `409` | Required local dataset files are missing |
| `MODEL_UNAVAILABLE` | `409` / `503` | Model checkpoint or local Hugging Face cache is missing |
| `MODEL_LOAD_ERROR` | `500` / `503` | Checkpoint is corrupted or incompatible with the model architecture |
| `INVALID_IMAGE` | `400` | Uploaded image is empty, corrupted, exceeds 25 MP, or mismatches MIME format |
| `FILE_TOO_LARGE` | `413` | Uploaded image exceeds the 5 MB limit |
| `UNSUPPORTED_MEDIA_TYPE` | `415` | Uploaded file MIME type is not `image/png`, `image/jpeg`, or `image/webp` |
| `INFERENCE_FAILED` | `500` | Inference pipeline returned invalid output |
| `INVALID_PATH` | `400` | Path escapes the configured allowed roots (`artifacts/`, `data/`, `configs/`) |
| `TRAINING_FAILED` / `EVALUATION_FAILED` | Job `error` field | Background worker caught an execution failure |
| `RESTART_INTERRUPTED` | Job `error` field | Job or evaluation was `RUNNING` when the backend process exited |
