# DeepVision AI Studio — UI/UX Design System

## 1. Design Direction

Dark-first, high-contrast, technical AI studio designed for clarity and zero visual clutter. Every number, badge, and status indicator reflects real backend responses.

---

## 2. Visual Foundations

### Color Palette (Implemented Tokens)
| Role | Hex / Tailwind | Usage |
| --- | --- | --- |
| App Background | `#0B0C10` | Main viewport background (`AppShell`) |
| Sidebar / Header Surface | `#0E1016` | Fixed desktop sidebar, mobile navigation drawer |
| Card Surface | `#11131A` | Primary workspace cards, tables, and sheets |
| Recessed / Input Surface | `#141722` / `#10121A` | Nested metric boxes, form inputs, path rows, code blocks |
| Hairline Borders | `border-white/[0.06]` to `border-white/10` | Card, table, and section dividers |
| Primary Text | `text-white` / `text-zinc-100` | Page titles, metric values, primary labels |
| Secondary Text | `text-zinc-300` / `text-zinc-400` | Descriptions, table cells, secondary metadata |
| Muted Text | `text-zinc-500` / `text-zinc-600` | Captions, timestamps, helper notes |
| Primary Accent | `indigo-500` / `indigo-400` | Active navigation, primary CTA buttons, focus rings, progress bars |
| Secondary Accent | `violet-500` / `sky-400` | Secondary KPI icon badges, embedding norms |
| Semantic Status | `emerald-400` / `amber-300` / `red-400` | Available/Succeeded (`emerald`), Queued/Missing/Degraded (`amber`), Failed/Invalid (`red`) |

> **Theme Policy:** Dark mode is fixed across the application (`<html lang="en" className="... dark">` in [layout.tsx](file:///d:/Developer/Projects/advanced-deep-learning/frontend/src/app/layout.tsx) and `<Toaster theme="dark" />` in [providers.tsx](file:///d:/Developer/Projects/advanced-deep-learning/frontend/src/components/providers.tsx)). No light-mode switcher is exposed.

### Typography
- **UI & Headings**: `Geist` (`--font-geist-sans`) with tight tracking on headings (`tracking-tight`).
- **Code, IDs, Paths & Metrics**: `Geist Mono` (`--font-geist-mono`) with `tabular-nums` for aligned numerical columns, percentages, sizes, latencies, and vector dimensions.

### Layout & Spacing
- **Page Container**: `max-w-[1600px]` centered within `AppShell` (`p-4 sm:p-7 xl:p-9`).
- **Cards**: `rounded-2xl` or `rounded-xl` with `border-white/[0.07] bg-[#11131A] shadow-none`.
- **Overflow Prevention**: All multi-column grids and flex rows use `min-w-0` on children and `break-all` or `truncate` on long IDs and Windows filesystem paths to guarantee `0 px` horizontal overflow at desktop (`1440×900`), tablet (`900×900`), and mobile (`390×844`).

---

## 3. Global Navigation (`AppShell`)

Implemented in [app-shell.tsx](file:///d:/Developer/Projects/advanced-deep-learning/frontend/src/components/layout/app-shell.tsx):

- **Desktop Sidebar (`lg:block`)**: Fixed left sidebar (`264px` expanded, collapsible to `76px` icon-only mode). Grouped into three sections:
  - **Overview**: Dashboard (`/`), Datasets (`/datasets`), Model Training (`/training`), Model Evaluation (`/evaluation`)
  - **Workspace**: AI Playground (`/playground`), NLP Playground (`/nlp`), Model Registry (`/registry`)
  - **System**: Settings (`/settings`)
- **Mobile Navigation (`lg:hidden`)**: Slide-over drawer triggered from the sticky top header menu button, with backdrop blur and auto-close on route selection.
- **Sticky Top Header**: Displays the active workspace title, breadcrumb (`DeepVision AI Studio / Workspace`), and a `Local environment` status pill. *(Note: No global search bar or theme toggle is present in the top bar.)*

---

## 4. Shared UI Primitives (`frontend/src/components/ui/`)

Built on `@base-ui/react` and Tailwind CSS:
- **Layout & Containers**: `Card`, `Sheet` (slide-over detail drawers), `Dialog` (creation & confirmation modals), `Tabs`, `Separator`, `Table`
- **Controls & Inputs**: `Button`, `Input`, `Textarea`, `Label`, `Progress`
- **Feedback & Status**: `Alert` (`default`, `destructive`, `warning`, `info`), `Badge`, `Skeleton`, `Toaster` (`sonner`)

---

## 5. Shipped Workspace UX Specifications

1. **Dashboard (`/`)** — Hero banner with quick actions (`/training`, `/playground`), 4 KPI cards (`API Status`, `Datasets`, `Registered Models`, `Active Training`), recent training activity list with normalized `0–100%` progress bars for active runs, `Workspace health` card distinguishing `/health` liveness from `/health/ready` readiness and artifact storage writability, and 4 quick-access navigation tiles.
2. **Datasets (`/datasets`)** — 4 KPI summary cards, search and availability/type/task filters, desktop table + mobile cards, and a slide-over detail sheet showing `/statistics` split totals, class chips, preprocessing config, live 5-check dataset validation (`POST /datasets/validate`), copy-only local paths, and links to `/training` and `/evaluation`.
3. **Model Training (`/training`)** — 4 KPI summary cards, search/state/model/dataset filter toolbar, preset-driven **New Training Run** dialog with inline Zod validation (`epochs`, `batch_size`, `learning_rate`, `weight_decay`, `val_fraction`, `seed`, `num_workers`, fixed/editable `image_size`), live progress polling, slide-over job detail sheet with latest epoch metrics, incremental log viewer, copyable artifact paths, and cooperative cancellation dialog.
4. **Model Evaluation (`/evaluation`)** — 4 KPI summary cards, available models strip, **Run Evaluation** dialog (`model`, `dataset`, `batch_size`, `max_samples`, `num_workers`), side-by-side **Compare Runs** dialog, and a slide-over detail sheet with overall/macro metrics, per-class Precision/Recall/F1/Support table, 10×10 / 2×2 confusion matrix heatmap, incremental logs, and cooperative cancellation.
5. **AI Playground (`/playground`)** — Live image model selector showing architecture, dataset, input image size, and availability; Top-K (`1–10`) selector; drag-and-drop PNG/JPEG/WebP dropzone (`5 MB` limit) with local preview and `URL.revokeObjectURL()` cleanup; real classification result card with predicted class, confidence, inference latency, image dimensions/format, Top-K probability bars, and session-only prediction history.
6. **NLP Playground (`/nlp`)** — Task tabs for **Sentiment Analysis** (auto-selecting the available fine-tuned IMDb model, example prompts, `10,000`-char limit, label/confidence/latency), **Text Embeddings** (`1–16` batch lines, 768-D vector dimension, L2 norm, first-8-dimension preview, copy full vector JSON, zero-safe pairwise cosine similarity matrix), and **Named Entity Recognition** (entity chips with label and confidence, or clear unavailable-cache notice when not cached locally), plus session-only history.
7. **Model Registry (`/registry`)** — 4 KPI summary cards (including total checkpoint storage), search and status/architecture/task/source (`Catalog` vs `Trained Job`) filters, desktop table + mobile cards, and a slide-over detail sheet with reported metrics (`Not reported` when null), copy-only filesystem paths, missing/invalid checkpoint warnings, related evaluations (scoped to the latest 50 loaded evaluations), and compatible workspace navigation links.
8. **Settings (`/settings`)** — 4 KPI diagnostics cards, **Backend Connection & Readiness** card (copyable `API_BASE`, liveness, and individual readiness probes with structured HTTP `503` degraded support), **Runtime & Compute Environment** card (CPU-only notice, Python/PyTorch/Transformers versions, CPU cores/threads, clamped host memory bar), **Local Storage & Filesystem Paths** card (copy-only `artifact_root` and `data_root`, file counts/sizes, disk capacity bar), **Local Preferences & Configuration Scope** card (browser-local 30s auto-refresh switch, off by default, reset button, environment-managed config notice, fixed dark theme badge), and **Registered Model Capabilities** table/cards with `/registry` link.

---

## 6. Responsive Breakpoints & States

- **Desktop (`>= 1024px`, verified at `1440×900`)**: Persistent left sidebar, 4-column KPI grids, desktop data tables (`hidden lg:block`), 2-column workspace layouts, slide-over `Sheet` drawers (`sm:max-w-2xl`).
- **Tablet (`768px–1023px`, verified at `900×900`)**: Collapsible drawer navigation, 2-column KPI grids, card list views (`lg:hidden`).
- **Mobile (`< 768px`, verified at `390×844`)**: Compact sticky header with drawer menu, single-column stacked cards, full-width slide-over sheets, and `0 px` horizontal overflow.
- **Standardized States**:
  - **Loading**: Layout-matched `Skeleton` placeholders.
  - **Empty / Filtered-Empty**: Dashed border container with icon, explanation, and primary action or **Reset filters** button.
  - **Offline (`isNetworkError`)**: Dedicated `WifiOff` alert card with **Retry connection** action.
  - **API / Validation Error**: Structured `Alert` (`variant="destructive"` or `"warning"`) surfacing backend `error.code` and message with **Retry** action.
