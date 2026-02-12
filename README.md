# Large Upload Take-Home

Chunked CSV upload with data preview — Next.js App Router.

**Live:** [https://decibel-upload.netlify.app/upload](https://decibel-upload.netlify.app/upload)

## Prerequisites

- Node.js 18+ (Node 20 recommended)
- npm (included with Node)

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the Upload page.

## Generate a large sample CSV (optional)

```bash
npm run gen:csv
```

Creates `public/sample-large.csv` (~10 MB) for testing chunked uploads.

## Tests (Vitest)

```bash
npm run test          # run once
npm run test:watch    # watch mode
```

**Test suites:**

| File | What it tests |
|------|---------------|
| `hooks/uploadReducer.test.ts` | State machine transitions (idle → uploading → finalizing → done/error/canceled) |
| `lib/csv.test.ts` | CSV parsing, type inference, quoted fields, CRLF |
| `lib/uploadValidation.test.ts` | File validation (type, size, empty) and user-facing error messages |
| `components/UploadWizard.test.tsx` | Phase stepper, file selection, validation display, upload trigger |
| `components/DataPreviewTable.test.tsx` | No-session fallback, fetch + render preview with columns/rows |
| `app/api/upload/upload.integration.test.ts` | Full API flow: init → chunk → finalize → GET preview |

## Project structure

```
app/
  page.tsx                  → redirects to /upload
  upload/page.tsx           → upload page (UploadWizard)
  preview/page.tsx          → data preview page (DataPreviewTable)
  api/upload/
    init/route.ts           → POST: create session
    chunk/route.ts          → POST: receive a chunk
    finalize/route.ts       → POST: assemble + preview; GET: fetch preview
components/
  UploadWizard.tsx          → upload flow UI (phases, progress, errors)
  DataPreviewTable.tsx      → data preview (summary, issues, table)
hooks/
  useChunkedUpload.ts       → upload hook (chunking, retry, cancel)
  uploadReducer.ts          → upload state machine (discriminated union)
lib/
  csv.ts                    → CSV parser + type inference
  storage.ts                → file system helpers for chunks
  types.ts                  → shared TypeScript types
  uploadValidation.ts       → file validation + error message mapping
```

## Deploying to Netlify

- **Build command:** `npm run build`
- **Publish directory:** `.next` (Netlify’s Next.js plugin usually sets this)
- **E401 “Unable to authenticate” during install:** This repo only uses the public npm registry. If you see E401, open your Netlify site → **Site configuration** → **Environment variables** and **remove** `NPM_TOKEN` and/or `NODE_AUTH_TOKEN` if they are set (an invalid or expired token causes this). Then trigger a new deploy.

## Key decisions

See [`DECISIONS.md`](./DECISIONS.md) for:
- What was changed and why
- What was intentionally not done
- Tradeoffs
- Backend asks
