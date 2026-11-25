# DeepVision AI Studio — Advanced Deep Learning Platform

A local-first, CPU-compatible deep learning platform combining PyTorch vision models, transfer learning, custom Transformer/NLP foundations, Hugging Face inference, a FastAPI backend (`src/api/`), and an eight-route Next.js 16 / React 19 / TypeScript workspace (`frontend/`).

---

## 1. Project Overview & Capabilities

DeepVision AI Studio turns the repository's PyTorch and NLP modules into an interactive local AI studio with zero cloud or GPU dependency:

- **PyTorch & Vision Foundations**: Custom CNNs (`MNISTCNN`, `CifarCNN`), data augmentation, and transfer learning with `ResNet18` (feature extraction and fine-tuning).
- **NLP & Transformer Foundations**: Custom regex tokenizer, vocabulary builder, token + sinusoidal positional embeddings, multi-head self-attention encoder, and fine-tuned + pretrained `DistilBERT` pipelines.
- **FastAPI Backend (`/api/v1`)**: Health and readiness probes, read-only system/storage/runtime diagnostics, dataset catalog and 5-check local validator, durable background training and evaluation workers backed by SQLite, model registry discovery, and thread-safe CPU image and NLP inference.
- **Eight-Route Next.js Frontend**:
  1. **Dashboard (`/`)** — Live API status, service readiness (`/health/ready`), dataset/model/job KPIs, recent training activity with normalized `0–100%` progress, and workspace quick links.
  2. **Datasets (`/datasets`)** — MNIST, CIFAR-10, and IMDb catalog, search and filtering, slide-over detail sheet with split statistics, class labels, preprocessing metadata, copyable local paths, and live 5-check dataset validation.
  3. **Model Training (`/training`)** — Preset-driven job creation, hyperparameter validation, live progress and epoch metrics polling, incremental line-indexed log streaming, and cooperative cancellation.
  4. **Model Evaluation (`/evaluation`)** — Held-out test split evaluation, accuracy and macro Precision/Recall/F1 cards, per-class metrics table, interactive confusion matrix, side-by-side run comparison, and incremental logs.
  5. **AI Playground (`/playground`)** — Drag-and-drop PNG/JPEG/WebP upload (5 MB max), model availability selector, Top-K probability bars, inference latency, and session-only prediction history.
  6. **NLP Playground (`/nlp`)** — Sentiment analysis, batch mean-pooled 768-D embeddings with pairwise cosine similarity, and Named Entity Recognition (NER) with local-cache availability detection.
  7. **Model Registry (`/registry`)** — Fixed catalog and dynamically discovered trained-job checkpoints, availability/missing/invalid status, reported metrics, copyable filesystem references, related evaluations, and compatible workspace links.
  8. **Settings (`/settings`)** — Live liveness and readiness probes (including structured HTTP `503` degraded-probe display), Python/PyTorch/Transformers runtime versions, CPU/memory/storage telemetry, model capability matrix, and an opt-in browser-local 30s diagnostics auto-refresh toggle.

---

## 2. Technology Stack

| Layer | Technologies |
| --- | --- |
| **ML / DL / NLP** | Python 3.13+ (verified on Python 3.14.10), PyTorch `2.15.0+cpu`, Torchvision, Hugging Face `transformers`, `datasets`, NumPy |
| **Backend API** | FastAPI, Uvicorn, Pydantic v2, SQLAlchemy 2.1 + SQLite (`deepvision.db`), `python-multipart` |
| **Frontend UI** | Next.js `16.4.6` (App Router, Turbopack), React `19.3.0`, TypeScript 5, Tailwind CSS 4, shadcn/ui (`@base-ui/react`), Lucide Icons |
| **State & Validation** | TanStack Query v5, React Hook Form, Zod v4 |
| **Testing** | Pytest (`148` backend tests), Vitest + React Testing Library (`67` frontend tests across `16` test files) |

---

## 3. Project Directory Structure

```text
advanced-deep-learning/
├── artifacts/                  # Pretrained checkpoints (*.pt), evaluation JSONs, and app/<id>/ job outputs
├── configs/                    # JSON training & model configurations (MNIST, CIFAR-10, ResNet18, DistilBERT)
├── data/
│   └── raw/                    # Local torchvision datasets (MNIST, CIFAR-10; gitignored)
├── docs/
│   ├── api-contracts.md        # Verified FastAPI v1 REST contracts
│   ├── architecture.md         # Core ML/DL package architecture
│   ├── fullstack-architecture.md # Full-stack backend + frontend architecture
│   ├── task-7d-training-workspace-inspection.md
│   └── ui-ux-design-system.md  # Dark-first UI/UX design system reference
├── frontend/                   # Next.js 16 application
│   ├── package.json
│   ├── vitest.config.ts
│   └── src/
│       ├── app/                # 8 App Router pages (/, /datasets, /training, /evaluation, /playground, /nlp, /registry, /settings)
│       ├── components/         # Shared layout (AppShell), shadcn/ui primitives, and workspace feature components
│       ├── lib/                # API client, Zod schemas, endpoints, query keys, TanStack Query hooks, domain helpers
│       └── test/               # Vitest setup
├── scripts/                    # Standalone CLI training, evaluation, and NLP demo scripts
├── src/
│   ├── api/                    # FastAPI application (main.py, config.py, db.py, errors.py, schemas*.py)
│   │   ├── evaluation/         # Held-out evaluation catalog, metrics, pipelines, background worker
│   │   ├── inference/          # Lazy-cached CPU image and NLP inference adapters
│   │   ├── routers/            # health, settings, datasets, registry, training, evaluations, inference
│   │   ├── services/           # artifacts, datasets, health, registry, settings
│   │   └── training/           # Training presets catalog, pipelines, background worker
│   ├── data/                   # MNIST data loader utilities
│   ├── evaluation/             # Core classification metrics
│   ├── models/                 # MNISTCNN, CifarCNN, ResNet18 transfer learning adapters
│   ├── nlp/                    # Tokenizer, vocabulary, embeddings, Transformer encoder, HF & IMDb service
│   ├── training/               # Core PyTorch trainer and evaluator loops
│   ├── utils/                  # Device selection and seed reproducibility helpers
│   ├── datasets.py             # Dataset registry and validation helpers
│   └── preprocessing.py        # Image transforms and normalization
├── tests/                      # 148 pytest unit and API integration tests
├── pytest.ini
├── requirements.txt
└── verify_env.py
```

---

## 4. Setup & Running Locally

### Backend Setup (FastAPI)

1. **Create and activate a virtual environment** from the repository root:
   ```powershell
   python -m venv .venv
   .venv\Scripts\Activate.ps1
   ```
2. **Install Python dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```
   > **Windows Application Control Note:** If Windows Application Control blocks compiled SQLAlchemy Cython extensions (`.pyd`), install SQLAlchemy in pure-Python mode:
   > ```powershell
   > $env:DISABLE_SQLALCHEMY_CEXT="1"
   > pip install --no-binary sqlalchemy --force-reinstall sqlalchemy
   > ```
3. **Verify the ML environment**:
   ```powershell
   python verify_env.py
   ```
4. **Start the FastAPI server** (defaults to `http://127.0.0.1:8000`):
   ```powershell
   .venv\Scripts\python.exe -m uvicorn src.api.main:app --host 127.0.0.1 --port 8000
   ```
   Interactive OpenAPI documentation is available at `http://127.0.0.1:8000/docs`.

### Frontend Setup (Next.js)

1. **Install Node dependencies**:
   ```powershell
   cd frontend
   npm.cmd install
   ```
2. **Configure environment variables** (optional if backend runs on `http://localhost:8000/api/v1`):
   Create `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
   ```
3. **Run the development server**:
   ```powershell
   npm.cmd run dev
   ```
   Open `http://localhost:3000`.
4. **Build and run for production**:
   ```powershell
   Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
   npm.cmd run build
   npm.cmd run start -- -p 3000
   ```

---

## 5. Environment Variables

### Backend (`src/api/config.py`)

All backend settings are loaded once at process startup into a frozen `Settings` dataclass. Changing any variable requires restarting the FastAPI server.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DEEPVISION_DATABASE_URL` | `sqlite:///<repo>/deepvision.db` | SQLAlchemy database URL for training and evaluation job records |
| `DEEPVISION_ARTIFACT_ROOT` | `<repo>/artifacts` | Root directory for model checkpoints, evaluation JSONs, and `app/` run outputs |
| `DEEPVISION_DATA_ROOT` | `<repo>/data` | Root directory for local datasets (`data/raw/MNIST`, `data/raw/cifar-10-batches-py`) |
| `DEEPVISION_CONFIG_ROOT` | `<repo>/configs` | Root directory for JSON model/training configuration files |
| `DEEPVISION_CORS_ORIGINS` | `http://localhost:3000` | Comma-separated list of allowed CORS origins |
| `HF_HOME` | Standard Hugging Face cache (`~/.cache/huggingface`) | Optional Hugging Face cache location for IMDb dataset and pretrained DistilBERT models |

### Frontend (`frontend/src/lib/api/client.ts`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api/v1` | Base URL for all frontend `/api/v1/*` requests |

---

## 6. Testing & Verification Commands

### Backend Test Suite (`148` tests)
```powershell
.venv\Scripts\python.exe -m pytest -q
```

### Frontend Verification Suite (`typecheck`, `lint`, `67` Vitest tests, `build`)
```powershell
cd frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm.cmd run build
```

---

## 7. Supported Datasets & Models

### Datasets (`/api/v1/datasets`)
| Dataset ID | Name | Type / Task | Train / Test | Val Fraction | Classes | Input Spec |
| --- | --- | --- | --- | --- | --- | --- |
| `mnist` | MNIST | `image` / `image_classification` | `60,000` / `10,000` | `0.1` (`6,000` val) | `10` (`0`–`9`) | `1 × 28 × 28` |
| `cifar10` | CIFAR-10 | `image` / `image_classification` | `50,000` / `10,000` | `0.1` (`5,000` val) | `10` | `3 × 32 × 32` |
| `imdb` | IMDb Movie Reviews | `text` / `sentiment_analysis` | `25,000` / `25,000` | `0.1` (`2,500` val) | `2` (`NEGATIVE`, `POSITIVE`) | `Text · max 128 tokens` |

### Registered Catalog Models (`/api/v1/registry/models`)
| Model ID | Display Name | Architecture | Task | Checkpoint Path | Reported Test Accuracy |
| --- | --- | --- | --- | --- | --- |
| `cifar10_custom_cnn` | CIFAR-10 Custom CNN | `CifarCNN` | `image_classification` | `artifacts/cifar10_improved.pt` | `74.16%` |
| `cifar10_custom_cnn_baseline` | CIFAR-10 Custom CNN (1 epoch baseline) | `CifarCNN` | `image_classification` | `artifacts/cifar10_best.pt` *(optional)* | `54.35%` |
| `mnist_cnn` | MNIST CNN Baseline | `MNISTCNN` | `image_classification` | `artifacts/mnist_baseline.pt` | Evaluated on demand |
| `resnet18_feature_extraction` | ResNet18 Feature Extraction | `ResNet18` | `image_classification` | `artifacts/resnet18_feature_extractor.pt` | `74.11%` |
| `resnet18_finetuned` | ResNet18 Fine-tuned | `ResNet18` | `image_classification` | `artifacts/resnet18_finetuned.pt` | `86.44%` |
| `distilbert_imdb_finetuned` | DistilBERT IMDb Sentiment | `DistilBERT` | `sentiment_analysis` | `artifacts/distilbert_imdb_finetuned.pt` | `78.67%` |

Completed training jobs under `artifacts/app/<job_id>/` that write `model.json` and `checkpoint.pt` are also dynamically discovered by `/api/v1/registry/models` as `job_<id>` entries.

---

## 8. Application Routes

| Route | Workspace | Primary Backend Endpoints Used |
| --- | --- | --- |
| `/` | Dashboard | `GET /health`, `GET /health/ready`, `GET /settings`, `GET /datasets`, `GET /registry/models`, `GET /training/jobs`, `GET /evaluations` |
| `/datasets` | Datasets | `GET /datasets`, `GET /datasets/{id}`, `GET /datasets/{id}/statistics`, `POST /datasets/validate` |
| `/training` | Model Training | `GET /training/presets`, `GET /training/jobs`, `POST /training/jobs`, `GET /training/jobs/{id}`, `GET /training/jobs/{id}/logs`, `POST /training/jobs/{id}/cancel`, `GET /datasets` |
| `/evaluation` | Model Evaluation | `GET /evaluations/presets`, `GET /evaluations`, `POST /evaluations`, `GET /evaluations/{id}`, `GET /evaluations/{id}/results`, `GET /evaluations/{id}/logs`, `POST /evaluations/{id}/cancel`, `GET /registry/models` |
| `/playground` | AI Playground | `GET /inference/image/models`, `POST /inference/image` |
| `/nlp` | NLP Playground | `GET /inference/nlp/models`, `POST /inference/nlp/sentiment`, `POST /inference/nlp/embeddings`, `POST /inference/nlp/ner` |
| `/registry` | Model Registry | `GET /registry/models`, `GET /registry/models/{id}`, `GET /evaluations` |
| `/settings` | Settings | `GET /health`, `GET /health/ready`, `GET /settings` |

---

## 9. Important Operational Limitations

- **Read-Only Settings, Datasets & Registry**: The backend does not expose endpoints to mutate settings (`PATCH /settings`), upload/import/delete datasets, or register/delete/download model checkpoints from the browser. Paths displayed in the UI are copy-only local filesystem references.
- **No Automatic Network Downloads at Runtime**: Dataset validation/loading and Hugging Face NLP inference use local files/caches (`download=False`, `local_files_only=True`). Uncached pretrained Hugging Face models (`distilbert-base-uncased-finetuned-sst-2-english` or `elastic/distilbert-base-uncased-finetuned-conll03-english`) report `available: false` and return HTTP `503 MODEL_UNAVAILABLE` until cached locally.
- **Sequential Single-Worker Queues**: Training and evaluation each run on a dedicated single-thread background worker (`max_queue = 4` pending jobs) to prevent CPU contention. Jobs interrupted by a backend process exit are marked `FAILED` (`RESTART_INTERRUPTED`) on next startup and cannot resume mid-epoch.
- **Trained Job Checkpoints**: Dynamically discovered `job_<id>` checkpoints appear in the Model Registry for inspection, while the Evaluation and AI Playground endpoints operate on the fixed catalog model IDs.
- **Fixed Dark Theme**: The frontend ships a single dark-first design system (`className="dark"`); no light-mode theme switcher is implemented.
