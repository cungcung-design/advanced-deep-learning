# DeepVision AI Studio — Frontend (`frontend/`)

Next.js `16.4.6` (App Router, Turbopack), React `19.3.0`, and TypeScript frontend for **DeepVision AI Studio**.

For full project documentation, backend setup, and architecture, see the root [README.md](file:///d:/Developer/Projects/advanced-deep-learning/README.md) and `docs/`.

---

## 1. Environment Configuration

Create `frontend/.env.local` (optional if the FastAPI backend is running at `http://localhost:8000/api/v1`):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## 2. Scripts

Run from `frontend/` (on Windows PowerShell, use `npm.cmd`):

```powershell
# Install dependencies
npm.cmd install

# Start development server on http://localhost:3000
npm.cmd run dev

# Run TypeScript typecheck
npm.cmd run typecheck

# Run ESLint
npm.cmd run lint

# Run Vitest unit & component test suite (67 tests across 16 files)
npm.cmd test

# Clean production build and start production server
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npm.cmd run build
npm.cmd run start -- -p 3000
```

---

## 3. Application Routes

- `/` — Dashboard
- `/datasets` — Datasets Catalog, Split Statistics & Live 5-Check Validation
- `/training` — Background Model Training Workspace
- `/evaluation` — Held-Out Model Evaluation & Confusion Matrix Workspace
- `/playground` — Image Classification AI Playground
- `/nlp` — NLP Playground (Sentiment, 768-D Embeddings, NER)
- `/registry` — Model Registry & Artifact Inspector
- `/settings` — System Health, Readiness, Runtime, Storage & Local Preferences
