# Decisions

## What I changed and why

### Upload experience (UX)

- **Explicit phase stepper**  
  Added a visible flow: **Select → Validate → Upload → Finalize → Ready**. Each step is reflected in the UI so users know where they are. “Success” is only shown after the **Finalize** step completes, so we never claim the file is ready before the server has assembled it.

- **Validation before upload**  
  File type (CSV), non-empty, and size (≤100 MB) are checked on selection and again on “Start upload”. Errors are shown inline with clear, actionable copy (e.g. “Please choose a CSV file”, “File is too large…”).

- **Trustworthy progress and messaging**  
  Progress is shown only during Upload and Finalize. Copy is phase-specific: e.g. “Uploading your file… part 3 of 10”, “Almost done — saving your file…”, “Your file is ready.” Error states get a short “What you can do” block that encourages retry or choosing another file.

- **User-facing error mapping**  
  Raw API/fetch errors are mapped to non-technical messages (e.g. “Part of the file didn’t upload. You can try again.”, “Connection problem. Check your internet and try again.”) so users get guidance instead of stack traces.

- **Cancel and reset**  
  Cancel stops the in-flight upload (AbortController). After error, cancel, or success, “Start over” / “Upload another file” resets state so the user can retry or switch file without confusion.

### Client-side robustness

- **Single state model (no boolean soup)**  
  Upload state is a discriminated union: `idle | uploading | finalizing | done | error | canceled`. Transitions are explicit in a reducer; the UI and hook both key off `phase`, which keeps behavior predictable and avoids conflicting flags.

- **Chunk retry**  
  Each chunk is retried up to 3 times with a 1s delay. Only after all retries fail do we transition to `error` with a message that includes part index and total parts. Abort is respected so cancel doesn’t get stuck in retries.

- **Cancellation**  
  One `AbortController` per run; cancel calls `abort()`. The upload loop checks `signal.aborted` and exits without dispatching success. A `runningRef` guards against double-start.

- **Ordering**  
  Chunks are still sent sequentially (init → chunk 0..N → finalize). Order is guaranteed; no reordering or parallel uploads, which keeps the current backend contract and avoids partial-state complexity in the UI.

### Data preview

- **Wide datasets**  
  For many columns we show the first 12 names plus “and N more” and a scrollable table. The first column is sticky on horizontal scroll so users don’t lose context. Summary line states row and column counts and hints to scroll when wide.

- **Schema / data issues**  
  We derive and show a “Things to check” section: duplicate column names, columns that are empty in the preview, and columns with mixed/unknown types. Severity is info vs warning; we don’t block, we inform.

- **Readable types**  
  Inferred types are shown with friendly labels (Number, Text, Yes/No, Mixed or empty) next to each column name in the “What’s in your file” block.

- **Controlled preview size**  
  We show the first 50 rows and cap the table height with scroll. We explicitly say “First 50 rows (preview)” and “Showing the first 50 of N rows” so users know it’s a sample.

---

## What I intentionally did not do

- **Resumable uploads**  
  Would require backend support (e.g. “which chunks do you have?” and accepting out-of-order chunks). Out of scope for the timebox and current API.

- **Parallel chunk uploads**  
  Would speed things up but complicates progress, retry, and cancellation semantics. Kept sequential for clarity and to match the existing backend behavior.

- **Byte-based progress**  
  Progress is still “chunks uploaded / total chunks”, not bytes. More accurate progress would need either backend reporting or reading file in chunks without uploading (extra complexity). Left as a known limitation.

- **Pause**  
  We have cancel (abort). True pause/resume would need resumable uploads and more state; skipped.

- **Heavy UI polish**  
  Kept styling minimal and functional (borders, spacing, clear hierarchy) to stay within the timebox while keeping the flow clear.

---

## Tradeoffs

| Decision | Tradeoff |
|----------|----------|
| Discriminated union state | Slightly more boilerplate in the reducer and type checks, but one source of truth and no invalid combinations (e.g. “uploading” and “done” at once). |
| Sequential chunks | Slower than parallel for large files on good connections, but simpler progress, retry, and cancel logic and no reordering on the backend. |
| Chunk-based progress | Progress bar can “jump” in big chunks (e.g. 1 MB). Byte-based would be smoother but needs more work; chunk count is honest and understandable. |
| Preview row/column caps | Users don’t see the full dataset in the UI, but we avoid loading 100MB into the DOM; we state the cap clearly. |
| Sticky first column only | One sticky column is enough to orient in wide tables without a complex “freeze pane” UX. |
| Error mapping in the UI | We might hide some rare backend messages; we prioritize “what to do next” over technical detail for non-technical users. |

---

## What I would ask the backend for next

1. **Resumability**  
   - Endpoint or field that returns “which chunk indices have been received for this session?” so the client can send only missing chunks after a disconnect or refresh.  
   - Optionally: accept chunks out of order and reassemble by index so we can add parallel uploads later without changing the contract.

2. **Progress or checksums (optional)**  
   - If the backend tracks bytes received per session, a small “progress” or “bytes received” field could support byte-based progress without the client re-reading the file.  
   - Chunk checksums (e.g. in headers) would allow the server to reject bad chunks and let the client retry that chunk only.

3. **Session metadata**  
   - Returning `filename` and `size` (and maybe `totalChunks`) from the finalize or a small “session status” endpoint would let the preview page show “Preview of X.csv” and align client and server on expected shape without re-uploading.

4. **Rate limiting / retry-after**  
   - If the backend ever returns 429 or 503, a `Retry-After` header (or a structured error with backoff) would let the client do smarter retries instead of fixed 1s delay.

None of these are required for the current flow; they’re the next improvements I’d request for production use.
