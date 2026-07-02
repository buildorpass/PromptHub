# PromptHub — Frontend

Next.js 14 App Router frontend for the PromptHub prompt management platform.

## Prerequisites

- Node.js 18+
- npm 9+
- Backend running at `http://localhost:8000` (see `../backend/`)

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Opens at [http://localhost:3000](http://localhost:3000). Auto-redirects to `/library`.

## Production build

```bash
npm run build
npm run start
```

## Environment

```env
# .env.local (already created)
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

Change `NEXT_PUBLIC_API_URL` to point to a remote backend.

## Pages

| Route | Description |
|---|---|
| `/library` | Folder tree + prompt list with search, tag filter, and new-prompt dialog |
| `/editor/[promptId]` | Three-column: version history sidebar · prompt editor tabs · inline run panel |
| `/editor/[promptId]/diff` | Line-level diff between any two versions; restore to create a new version |
| `/comparison` | Select prompt + models → concurrent fan-out → side-by-side result columns with cost/latency/rating |
| `/test-cases` | Define test cases with assertions; run against models; view pass/fail history |
| `/assets` | CRUD for reusable `{{asset:name}}` content blocks |
| `/pricing` | Inline-editable model pricing table (rates drive all cost calculations) |
| `/analytics` | Cost by model, cost by prompt, efficiency table, recent run feed |

## Project structure

```
src/
├── app/
│   ├── layout.tsx              Root layout: QueryClientProvider, ToastProvider, Sidebar
│   ├── globals.css             Dark theme, custom scrollbars, brand CSS variables
│   ├── library/page.tsx
│   ├── editor/[promptId]/
│   │   ├── page.tsx
│   │   └── diff/page.tsx
│   ├── comparison/page.tsx
│   ├── test-cases/page.tsx
│   ├── assets/page.tsx
│   ├── pricing/page.tsx
│   └── analytics/page.tsx
│
├── components/
│   ├── ui/                     Primitive components
│   │   ├── button.tsx          Variants: default (orange), secondary, ghost, destructive, outline
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   ├── label.tsx
│   │   ├── badge.tsx
│   │   ├── dialog.tsx          Portal-based modal
│   │   ├── sheet.tsx           Side drawer
│   │   ├── select.tsx
│   │   ├── checkbox.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── skeleton.tsx
│   │   └── toast.tsx           Context-based toast provider (success/error/warning/info)
│   │
│   └── shared/                 Composed components
│       ├── ModelBadge.tsx      Colored per provider (orange=OpenAI, violet=Anthropic, cyan=DeepSeek)
│       ├── StatusBadge.tsx     Run status: pending/running/completed/failed
│       ├── CostDisplay.tsx     Formats "$0.000023" with input/output breakdown tooltip
│       ├── TokenCount.tsx      "142 in / 89 out" in mono font
│       ├── VersionTag.tsx      "v3" badge
│       ├── PageHeader.tsx      Page title + optional action button
│       ├── EmptyState.tsx      Centered message + optional CTA
│       ├── LoadingSpinner.tsx  Animated ring in orange-500
│       ├── Sidebar.tsx         Left nav with active-state indicators
│       └── Providers.tsx       QueryClientProvider + ToastProvider wrapper
│
├── hooks/                      TanStack Query hooks per resource
│   ├── usePrompts.ts           usePrompts, usePrompt, useCreatePrompt, useUpdatePrompt, useDeletePrompt
│   ├── useVersions.ts          useVersions, useVersion, useCreateVersion, useRestoreVersion, useVersionDiff
│   ├── useRuns.ts              useCreateRun, useRuns, useRun, useRateResult
│   ├── useFolders.ts           useFolders, useCreateFolder, useUpdateFolder, useDeleteFolder
│   ├── useAssets.ts            useAssets, useAsset, useCreateAsset, useUpdateAsset, useDeleteAsset
│   ├── usePricing.ts           usePricing, useCreatePricing, useUpdatePricing, useDeletePricing
│   ├── useTestCases.ts         useTestCases, useTestCase, useCreateTestCase, useRunTestCase, useTestCaseHistory
│   └── useModels.ts            useModels
│
├── lib/
│   ├── api.ts                  Central fetch wrapper with X-User-Id header
│   ├── queryClient.ts          TanStack Query client (30s staleTime)
│   └── utils.ts                cn(), timeAgo(), formatCost(), formatLatency(), extractVariables(), parseTags()
│
└── types/index.ts              TypeScript interfaces matching all backend Pydantic schemas
```

## Design system

Dark developer-tool aesthetic — intentionally not the typical AI-product blue gradient look.

| Token | Value | Usage |
|---|---|---|
| `brand-bg` | `#0c0c0c` | Page background |
| `brand-surface` | `#161616` | Cards, panels |
| `brand-elevated` | `#1f1f1f` | Hover surfaces, footers |
| `brand-border` | `#2a2a2a` | All borders (1px, no shadows) |
| `brand-primary` | `#f97316` | Buttons, active states, accent |
| `brand-secondary` | `#a78bfa` | Tags, secondary badges |
| `brand-text-primary` | `#fafafa` | Main text |
| `brand-text-secondary` | `#a1a1aa` | Supporting text |
| `brand-text-muted` | `#52525b` | Labels, timestamps |

All colors are available as `brand-*` Tailwind utilities via `tailwind.config.ts`.

Prompt content, token counts, and cost values use `font-mono`. UI text uses Inter.

## API integration

All API calls go through `src/lib/api.ts`:

```typescript
// Usage:
api.get<T>(path)
api.post<T>(path, body)
api.put<T>(path, body)
api.delete<T>(path)
```

**Paginated vs plain-array endpoints:**
- Most list endpoints return `{ items, total, page, page_size }` → hooks use `select: (d) => d.items`
- These return plain arrays (no `select` needed): `GET /models`, `GET /prompts/{id}/versions`, `GET /test-cases/{id}/history`

## Template variable detection

`extractVariables(content: string): string[]` in `utils.ts` scans prompt content for `{{variable_name}}` tokens (excluding `{{asset:*}}` tokens) and returns unique variable names. Used by the editor to auto-populate the variable input panel.

## Authentication

Currently stubbed via `X-User-Id: dev-user` header in `src/lib/api.ts`. To plug in real auth:

```typescript
// src/lib/api.ts
const HEADERS = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${getToken()}`,  // replace stub here
};
```

No page-level changes needed.
