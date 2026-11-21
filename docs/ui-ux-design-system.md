# DeepVision AI Studio — UI/UX Design System

## 1. Design Direction

Premium, dark-first AI SaaS. Calm, technical, high-contrast where it matters;
never a generic student dashboard. Content density is moderate, with generous
whitespace, refined borders, and restrained motion.

Keywords: precise, quiet, confident, computational, editorial.

## 2. Foundations

### Color
| Token | Value | Use |
|---|---|---|
| `bg-base` | `#0B0C10` | App background |
| `bg-raised` | `#11131A` | Cards, panels |
| `bg-overlay` | `#171A24` | Popovers, modals |
| `border-subtle` | `#242835` | Hairline borders |
| `text-primary` | `#F4F5F7` | Headings, primary text |
| `text-secondary` | `#A3A8B8` | Body, labels |
| `text-muted` | `#6E7485` | Captions, metadata |
| `accent-indigo` | `#6366F1` | Primary actions, focus |
| `accent-violet` | `#8B5CF6` | Highlights, charts |
| `success` | `#22C55E` | Success states |
| `warning` | `#F59E0B` | Warnings |
| `danger` | `#EF4444` | Errors, destructive actions |

Gradients are subtle: indigo-to-violet only on primary CTAs and active nav.

### Typography
- Display/headings: **Geist Sans** or **Inter Tight**
- Body/UI: **Inter**
- Code/metrics: **JetBrains Mono**
- Scale: 12 / 14 / 16 / 20 / 24 / 32 / 40 px
- Headings use tight tracking; metrics use tabular numerals.

### Spacing & Radius
- 4px base grid; common steps 8/12/16/24/32/48.
- Cards: 16px radius. Inputs/buttons: 10px. Pills: full radius.
- Page container: max-width 1440px, 32px desktop gutters, 16px mobile.

### Elevation
- Cards: `bg-raised` + 1px subtle border + soft shadow.
- Modals: overlay blur 8px, shadow `0 24px 80px rgba(0,0,0,.55)`.

## 3. Navigation

- **Sidebar** (desktop): 264px, collapsible to 72px. Logo top, eight nav items
  with lucide icons, active item with indigo left indicator and subtle gradient.
- **Top bar**: page title, breadcrumb, global search, CPU status pill, theme.
- **Mobile**: sidebar becomes sheet drawer; sticky compact header.

Nav order: Dashboard, Datasets, Model Training, Model Evaluation, AI Playground,
NLP Playground, Model Registry, Settings.

## 4. Component System

- `Card`, `StatCard`, `SectionHeader`, `DataTable`, `Badge`, `Tabs`,
  `Dialog`, `Sheet`, `Toast`, `Progress`, `Skeleton`, `EmptyState`,
  `ErrorState`, `MetricChart`, `ConfusionMatrix`, `Dropzone`, `CodeBlock`.
- shadcn/ui primitives restyled with the tokens above.
- Charts: Recharts or shadcn charts; indigo/violet series on charcoal.

## 5. Page UX Requirements

1. **Dashboard** — stat cards, recent runs table, dataset/model summaries,
   best-accuracy trend, quick actions.
2. **Datasets** — searchable list, detail drawer, class distribution,
   validation/import workflow with inline errors.
3. **Model Training** — 3-step form (model, dataset, config), live progress,
   log stream, cancel, checkpoint link.
4. **Model Evaluation** — model selector, metric cards, confusion matrix,
   per-class table, compare mode.
5. **AI Playground** — drag-and-drop image, model select, top-k bars,
   latency and confidence.
6. **NLP Playground** — tabs for Sentiment / Embeddings / NER, batch textarea,
   result cards, entity chips.
7. **Model Registry** — version table, architecture/metadata detail,
   evaluation links, checkpoint path with copy action.
8. **Settings** — runtime, CPU/memory, storage, model config, app preferences.

## 6. States

- **Loading:** skeletons matching final layout, never spinners alone.
- **Empty:** icon, one-line explanation, primary action.
- **Error:** what failed, why, retry action, request id.
- **Success:** toast + inline confirmation for mutating actions.
- **Long jobs:** persistent progress card, elapsed time, log drawer.

## 7. Responsiveness

- Desktop ≥1280: sidebar + 12-col grid.
- Tablet 768–1279: collapsed sidebar, 8-col grid, cards stack 2-up.
- Mobile <768: drawer nav, single column, sticky primary action.

## 8. Accessibility & Quality

- WCAG AA contrast for text and controls.
- Visible focus rings in indigo.
- All interactive elements keyboard-reachable.
- Charts include text summaries and accessible labels.
- Motion respects `prefers-reduced-motion`.

## 9. Implementation Guardrails

- No placeholder metrics: every number comes from an API response.
- No lorem ipsum in shipped pages.
- Shared layout, tokens, and primitives before page implementation.
- Eight pages and premium responsive UI are mandatory scope.
