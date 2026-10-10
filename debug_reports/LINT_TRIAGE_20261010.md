# ALICE lint triage register — 2026-10-10

**Task:** kanban `t_544572fd` (card 7) — triage the lint baseline into a classified register and a fix plan. **No code changed in this card.**
**Author:** Kuro (Mode B, `#alice`). **Operator decision required on every class-A-to-E call below** — this register proposes, it does not rule.
**Tree:** `alan` @ `2a4b740` (card 6's HEAD, on top of card 5's `3b191e4`). Remote `refs/heads/alan` still `c6021602881baf5c69137579a4ac58ece7717966` — no push, no PR.
**Tooling:** `agy` (Antigravity CLI) with a non-Claude engine only. No Claude Code, no `claude` CLI, no Claude model was used.

---

## 1. What this register is built from

| Input | File | Notes |
| --- | --- | --- |
| Card 4 baseline | `debug_reports/lint_gate_npm_run_lint_after_20261010.txt` | 0 errors / **98 warnings**, tree `cb3ac3a` |
| Post-card-6 re-run | `debug_reports/lint_triage_post_card6_20261010.txt` | 0 errors / **91 warnings**, tree `2a4b740` — this is the population triaged below |
| Gates on the triaged tree | `debug_reports/gates_lint_triage_20261010.txt` | raw `npx tsc --noEmit`, `npm test`, `npm run build` |

Command for the re-run was exactly `npm run lint` (`eslint .`) with no config change. Both files were parsed programmatically (rule, file, line, column) and the two sets diffed on `file:line:rule`, so the delta below is not eyeballed.

### 1.1 The delta — 98 → 91, and why

Card 6's deletion of 15 dead files removed exactly **7** findings. Zero findings were added and **zero were relocated across the file set** (the per-file totals of every surviving file are identical pre- and post-deletion).

| File deleted by card 6 | Findings removed | Rule(s) |
| --- | --- | --- |
| `components/clinical-folder-tree.tsx` | 5 | `no-unused-vars` @4:23, @4:43, @15:3, @16:3 (4) + `set-state-in-effect` @23:5 (1) |
| `components/ui/use-mobile.tsx` | 1 | `set-state-in-effect` @14:5 |
| `components/ui/use-toast.ts` | 1 | `no-unused-vars` @18:7 (`actionTypes`) |
| **Total** | **7** | |

**These 7 are moot** (class E-moot) and are deliberately **excluded from the debt totals in §2** — they were about code that no longer exists. Card 6's handoff predicted this exactly ("the 14 set-state-in-effect sites of the brief are now 12"): 14 − 2 (clinical-folder-tree, use-mobile.tsx) = **12**.

> Note on the brief's arithmetic: the brief says "14 `react-hooks/set-state-in-effect` sites (13 files)". The baseline is 14 sites in **13** files (`DynamicTaskForm.tsx` held two, at 345 and 461). Post-card-6 it is **12 sites in 11 files**. §6 buckets those 12.

### 1.2 Rule totals

| Rule | Baseline (98) | Post-card-6 (91) | Moot (7) |
| --- | --- | --- | --- |
| `@typescript-eslint/no-explicit-any` | 51 | 51 | 0 |
| `@typescript-eslint/no-unused-vars` | 21 | 16 | 5 |
| `react-hooks/set-state-in-effect` | 14 | 12 | 2 |
| `@typescript-eslint/no-unused-expressions` | 4 | 4 | 0 |
| `react/no-unescaped-entities` | 2 | 2 | 0 |
| `import/no-anonymous-default-export` | 2 | 2 | 0 |
| `react-hooks/exhaustive-deps` | 2 | 2 | 0 |
| `react-hooks/refs` | 1 | 1 | 0 |
| `react-hooks/purity` | 1 | 1 | 0 |
| **Total** | **98** | **91** | **7** |

---

## 2. Class counts (the register's population: 91 findings, 28 files)

| Class | Meaning | Findings | % of 91 |
| --- | --- | --- | --- |
| **A** | Correctness bug — real, reachable, wrong behaviour | **0** | 0 % |
| **B** | Real defect, low impact | **16** | 17.6 % |
| **C** | Dead code (unused binding / expression / whole file) | **19** | 20.9 % |
| **D** | Type/style debt — no behaviour | **54** | 59.3 % |
| **E** | False positive, config gap, or moot | **2** (in-population) + **7 moot** | 2.2 % |
| **Total** | | **91** | 100 % |

**Class A is empty, and that is a finding, not an omission.** Every one of the 91 warnings was traced to its code path; none produces wrong behaviour that a user can reach today. The two candidates that come closest are the `ReflectionCanvas` imperative-handle deps and the `ReflectionCanvas` ref read — both are proved unreachable in §5.2 and §5.4 and are recorded as class B with the reachability proof, not waved into class D.

Class C is higher than a naive reading suggests because the brief's own example (`'err' is defined but never used`) is one *finding*, while `sessionContext`/`setSessionContext` and `reflectionPrompt`/`setReflectionPrompt` are two findings each on a single line — the "six unused values" of the brief are in fact **seven names across five findings** (§5.5).

---

## 3. Register — class B (16)

Real defects. All are true; none can bite a clinician today. The "reachable?" column is the load-bearing one.

| # | Location | Rule | What it actually is | Reachable? | Recommended action | Effort | Bites a clinician? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B1 | `components/canvas/ReflectionCanvas.tsx:567` | `react-hooks/exhaustive-deps` | `useImperativeHandle(ref, …, [background])` omits `clientId` and `submissionId`. The handle closes over the **props as of the last `background` change**, then falls back to them when `uploadReflection()` is called with no arguments (`submissionIdParam \|\| submissionId`). If the props change after mount, the fallback values are stale. | **No — zero callers.** `uploadReflection` is declared in the interface (`:85`) and defined (`:513`) but never invoked anywhere in the repo. | Add `clientId, submissionId` to the deps array. **This is the single highest-value fix in the register** — it is the one latent mis-attribution path: if a caller is later added that omits the arguments, a reflection image could be attached to the wrong client/submission. | S | **Not today.** Would be a clinical-record-integrity defect the moment a caller relies on the fallbacks. |
| B2 | `components/canvas/ReflectionCanvas.tsx:254` | `react-hooks/set-state-in-effect` | `setIsDark(mq.matches)` — the *initial* read of `prefers-color-scheme`, then subscribed via `change`. | Yes (the canvas mounts on the practice page). | Genuine external-system sync, but the modern idiom is `useSyncExternalStore`. Behaviour is correct; the cost is one extra render on mount. | S | No. |
| B3 | `hooks/use-mobile.ts:14` | `react-hooks/set-state-in-effect` | `setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)` — same matchMedia-initial-read shape. Note the state starts `undefined` and is coerced by `!!isMobile`, which is deliberately hydration-safe. | Yes (`components/ui/sidebar.tsx:8` imports it — though see E-note in §7). | `useSyncExternalStore`, or accept. | S | No. |
| B4 | `components/ui/sidebar.tsx:611` | `react-hooks/purity` | `Math.random()` inside `React.useMemo(…, [])` in `SidebarMenuSkeleton` — an impure call during render. | **No — `SidebarMenuSkeleton` has zero importers**, and `components/ui/sidebar.tsx` itself has **zero importers** repo-wide (see §5.3). | Delete the file (preferred — it is an unreferenced shadcn kit), or hoist the width into a state/effect if a skeleton is genuinely wanted. | S | No. Unreachable. |
| B5 | `components/ui/carousel.tsx:98` | `react-hooks/set-state-in-effect` | `onSelect(api)` inside an effect — notifying the parent of the embla instance and registering listeners. | **No — `components/ui/carousel.tsx` has zero importers.** | Same as B4: unreferenced kit file. If kept, the rule is arguably over-eager here (see §8, class E debate). | S | No. Unreachable. |
| B6 | `app/practitioner/tasks/[id]/review/page.tsx:1288` | `react-hooks/set-state-in-effect` | `useEffect(() => { fetchBundle(); }, [fetchBundle])` where `fetchBundle` opens with synchronous `setFetchError(null); setLoading(true)` (`:1253–1255`). | Yes — this is the clinician review screen. | Both pre-sets are **no-ops** (they set the values the state already holds, so React bails out of the re-render). Fix = drop the two synchronous pre-sets, or keep them and accept. | S | No. |
| B7 | `components/ClientLanding.tsx:89` | `react-hooks/set-state-in-effect` | `useEffect(() => { fetchClients() }, [])` — `fetchClients` opens with `setLoading(true)` (`:57`). | Yes. | `setLoading` is already `true` on mount (`:76`-equivalent initial state) → bail-out, no cascading render. Drop the pre-set or accept. | S | No. |
| B8 | `components/client-view.tsx:30` | `react-hooks/set-state-in-effect` | `setIsLoading(true)` synchronously, then `fetchVignettes()`. | Yes (`app/dashboard/page.tsx:7`). | `isLoading` is already initialised `true` (`:26`) → the call is a no-op. Drop it. | S | No. |
| B9 | `components/main-content.tsx:90` | `react-hooks/set-state-in-effect` | `useEffect(() => { fetchVignettes() }, [client.id, selectedSessionId])` — `fetchVignettes` opens with `setIsLoading(true); setError(null)`. | Yes. | Standard "fetch on dependency change". The synchronous pre-sets are the flagged part. | S | No. |
| B10 | `components/main-content.tsx:91` | `react-hooks/exhaustive-deps` | The same effect omits `fetchVignettes` from its deps. | Yes. | `fetchVignettes` is redefined each render but closes only over `client.id` (in the deps) and module constants → behaviour is correct today. Hoist it into a `useCallback`, or accept with a comment. | S | No. |
| B11 | `components/tasks/DynamicTaskForm.tsx:345` | `react-hooks/set-state-in-effect` | `useEffect(() => { if (externalSubmissionId) setSubmissionId(externalSubmissionId) }, [externalSubmissionId])` — mirroring a prop into state. | Yes. | **Genuine cascading-render risk** (bucket 6a). The state is already seeded from the same prop in its initialiser (`:339`) → the effect is redundant. Delete the effect. | S | No. |
| B12 | `components/tasks/DynamicTaskForm.tsx:461` | `react-hooks/set-state-in-effect` | `useEffect(() => { if (!persist) return; triggerAutoSave(); … })` — a debounced autosave (`triggerAutoSave` sets `setSaveStatus("saving")` and arms a 1200 ms timer). | Yes. | This is an **intended side effect**, not state derivation. `triggerAutoSave` is already a `useCallback`; the effect's `exhaustive-deps` disable comment is deliberate. Leave, or scope the rule. | S | No. |
| B13 | `components/vignette-generator.tsx:154` | `react-hooks/set-state-in-effect` | Sets `setDegradedWarning(null)`, `setStep(1)`, `setSessionInput("")`, `setAnalysis(null)`, `setPracticePackage(null)` when `!session`; otherwise hydrates from the session (bucket 6a). | Yes — the practitioner's generator. | **Genuine cascading-render risk.** This is the deliberate hydration latch that card 4's design and 15 hydration-guard tests protect (`lib/session-hydration.ts`). Any change here must keep those tests green; the safest remediation is `useReducer`/derived state for the `!session` reset, or leave and document. | M | No, but this is the effect where a careless fix could break session hydration (regression risk, not clinical risk). |
| B14 | `components/dashboard-shell.tsx:52` | `react-hooks/set-state-in-effect` | `useEffect(() => setDrawerOpen(false), [selectedClientId, selectedSessionId])` — close the mobile drawer when navigation changes. | Yes. | Bucket 6a-adjacent. It is a navigation side effect on prop change; a `key`-based remount or moving it into the selection handler would clear it. | S | No. |
| B15 | `hooks/use-clinical-workspace.ts:33` | `react-hooks/set-state-in-effect` | `useLayoutEffect` picking the first client/case/session when the selection is absent or stale. | Yes. | Bucket 6a. Guarded (`clients.length === 0` returns; an existing valid selection returns). Behaviour is correct; it is a derived-default pattern. | S | No. |
| B16 | `components/canvas/ReflectionCanvas.tsx:244` | `react-hooks/refs` | `useState(strokesRef.current.length)` — a ref read during render. See §5.2 for the full trigger and the stale-value answer. | Yes (canvas renders). | Initialise from the prop instead of the ref: `useState(() => initialData?.strokes?.length ?? 0)`. Removes the ref read and is equivalent. | S | No. |

---

## 4. Register — class C (19) and class D (54)

### 4.1 Class C — dead code (19)

| # | Location | Rule | What it is | Evidence it is dead | Action | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | `components/vignette-generator.tsx:28` | `no-unused-vars` | `generateStructuredTask` imported from `@/lib/tasks`, never called. `upsertTaskDraft` from the same import **is** used. | Introduced by `0953b90`; `git log -S` shows no call site since. The live call path is `apiFetch(.../generate/structured-task)` at `:370` / `:465`. | Drop `generateStructuredTask` from the import. | S |
| C2 | `components/vignette-generator.tsx:47` | `no-unused-vars` | `getDefaultActivity(modalities)` — a client-side modality→activity map, never called. | Added by `80ebb57`, never wired. **Deliberate redundancy, not a missing feature:** the app posts `activityFormat: "auto"` (`:374`) and the Worker owns the mapping (`documentation.md:306–307`, `:516`). Server returns `task_type`, client stores it (`:422`). | Delete the helper. If modality→activity mapping is ever wanted client-side, it belongs on a backlog card — it must not diverge from the Worker's rule. | S |
| C3 | `components/vignette-generator.tsx:132` | `no-unused-vars` **×2** | `sessionContext` / `setSessionContext` state pair, never read, never set. | Declared `0953b90`; `git log -S 'setSessionContext('` returns **nothing**, i.e. it was never called even once. Name is unrelated to the API payload field of the same name (`:373`). | Delete both. | S |
| C4 | `components/vignette-generator.tsx:135` | `no-unused-vars` **×2** | `reflectionPrompt` / `setReflectionPrompt` state pair, never read, never set. | Declared `0953b90`, never used since. Distinct from the `"reflection_prompt"` task-type string. | Delete both. | S |
| C5 | `components/vignette-generator.tsx:239` | `no-unused-vars` | `catch (err)` in `handleHeidiImport` — the binding is never read (the catch body just alerts). | In-file. | `catch {` (optional catch binding). | S |
| C6 | `app/api/analyze/session/route.ts:6` | `no-unused-vars` | `clientId` destructured from the body, never used. | In-file. (Separately worth noting to the operator: this whole route is a legacy local-Ollama stub — `http://localhost:11434/api/generate`, model `llama3` — not the app's AI path, which goes to `CLINICAL_AI_API_BASE`. That is a file-lifecycle question, out of this card's scope.) | Drop `clientId` from the destructure. | S |
| C7 | `app/layout.tsx:10` | `no-unused-vars` | `const geistMono = Geist_Mono({…})` — loaded, never applied. **See §5.1: the fix is to apply it, not delete it.** | Built CSS proves the consequence. | Apply it (see §5.1). | S |
| C8 | `components/canvas/ReflectionCanvas.tsx:49` | `no-unused-vars` | `Upload` imported from `lucide-react`, never used. | In-file. | Drop from the import. | S |
| C9 | `components/canvas/ReflectionCanvas.tsx:67` | `no-unused-vars` | `drawBackground` imported from `./canvasUtils`, never used in this file (the util still has its own callers — do not delete the export). | In-file. | Drop from the import only. | S |
| C10 | `components/canvas/canvasUtils.ts:119` | `no-unused-vars` | `const prev = pts[pts.length - 2]` — a leftover of the smoothing loop, never read. | In-file (line 120–122 use `last`, not `prev`). | Delete the line. | S |
| C11 | `components/main-content.tsx:29` | `no-unused-vars` | `activeTab` prop destructured and typed (`:33`) but never used inside `MainContent`, which keeps its own `tab` state (`:38`). The caller **does** pass it (`app/dashboard/page.tsx:73`). | Repo-wide grep: `activeTab` is consumed only by `dashboard-sidebar.tsx`. | Remove from the destructure + prop type (and optionally stop passing it). | S |
| C12 | `components/sidebar/EditableName.tsx:14` | `no-unused-vars` | `loading` state is written (`setLoading` at `:24`, `:26`) but never read. | In-file. | Delete the state pair, keep the awaits. | S |
| C13 | `hooks/use-toast.ts:18` | `no-unused-vars` | `actionTypes` — a `as const` object whose runtime value is never read; only `typeof actionTypes` is used (`:32`). | In-file. Note this is upstream shadcn's own shape, so it is vendored, not authored here. | Convert to a plain type (`type ActionType = { ADD_TOAST: 'ADD_TOAST'; … }`) and delete the const, **or** leave (it is TS-elided from output anyway). | S |
| C14 | `tests/worker.test.mjs:13` | `no-unused-vars` | `copyFile` imported from `node:fs/promises`, never used (the harness now drives the Worker through esbuild). | In-file. | Drop `copyFile` from the import. | S |
| C15 | `components/main-content.tsx:194` | `no-unused-expressions` | The file's last line is a bare empty template literal (`` `` ``). | `od -c` on the file tail: `} \r \n ` ` ` ` with no trailing newline. | Delete the stray token. | S |
| C16 | `components/sidebar/CaseNode.tsx:108` | `no-unused-expressions` | Same stray empty template literal at EOF. | Same byte-level proof. | Delete the stray token. | S |
| C17 | `components/sidebar/ClientNode.tsx:57` | `no-unused-expressions` | Same stray empty template literal at EOF. | Same byte-level proof. | Delete the stray token. | S |

Rows C3 and C4 carry two findings each (19 findings across 17 rows).

### 4.2 Class D — type/style debt (54)

No behaviour. Every row below is mechanically safe.

| # | Location(s) | Rule | Findings | What it is | Action | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| D1 | `stores/useClientNavStore.ts` @113,119,125,152,191,195,263,271,303,334,358,382,407,420,438,467,500,539,581,589 | `no-explicit-any` | 20 | Latent `any` on store action return types (`Promise<any>`), the session normaliser (`s: any`) and action payloads. One file holds 39 % of all `any`. | Type the store's action signatures; reuse the `Session`/`Client` types it already defines. | L |
| D2 | `components/vignette-generator.tsx` @40,54,64,134,135,211,407,417,418,495,504,505,672 | `no-explicit-any` | 13 | `riskFlags: any[]`, `extractHomeworkList(task: any)`, `generatedTaskData: any`, and a run of `x as any` casts bridging the generator to the `StructuredTask`/`PracticePackage` types. | Replace with the real `StructuredTask`/`PracticePackage` types; the `as any` casts at `:417/:418/:504/:505` are the ones worth removing (they defeat the schema types). | M |
| D3 | `workers/mcp-gateway/src/index.ts` @2,48,107,186,218 | `no-explicit-any` | 5 | `env: any` on the Worker handler and `any` on the MCP tool payloads. | Type `env` (the binding shape is small) and the tool args. | M |
| D4 | `app/practice/[sessionId]/page.tsx` @11,45,124,276 | `no-explicit-any` | 4 | A **local** `type PracticePackage = { homework: any[] }` shadowing `@/lib/practice-package`, `getTaskLabel(item: any)`, `catch (err: any)`, `homework.map((item: any…)`. | Import the shared type instead of the local shadow; type the catch as `unknown` and narrow. | M |
| D5 | `app/dashboard/page.tsx` @39,40 | `no-explicit-any` | 2 | `client: any, options?: any` in the `onSelectClient` callback. | Use `Client`. | S |
| D6 | `components/ClientLanding.tsx` @19,20 | `no-explicit-any` | 2 | Same `onSelectClient` signature on the other side of the boundary. | Use `Client`. | S |
| D7 | `app/signup/page.tsx:112` | `no-explicit-any` | 1 | `catch (err: any)`. | `unknown` + narrow. | S |
| D8 | `app/api/analyze/session/route.ts:33` | `no-explicit-any` | 1 | `catch (error: any)` then `error.message`. | `unknown` + narrow. | S |
| D9 | `components/client-view.tsx:20` | `no-explicit-any` | 1 | `practice_package?: any` in `AssignedMaterial`. | Use `PracticePackage`. | S |
| D10 | `components/main-content.tsx:26` | `no-explicit-any` | 1 | `type Vignette = any`. | Define or import `Vignette`. | S |
| D11 | `components/tasks/DynamicTaskForm.tsx:109` | `no-explicit-any` | 1 | `initialData?: any` on the public props. | Type it as the task union. | S |
| D12 | `app/forgot-password/page.tsx:63` | `react/no-unescaped-entities` | 1 | `we'll` in JSX text. | `we&apos;ll` (or `{"we'll"}`). | S |
| D13 | `components/tasks/ThreeCsForm.tsx:314` | `react/no-unescaped-entities` | 1 | `don't` in JSX text. | `don&apos;t`. | S |
| D14 | `components/canvas/ReflectionCanvas.tsx:489` | `no-unused-expressions` | 1 | `e.shiftKey ? handleRedo() : handleUndo();` — a ternary used as a statement. **It works** (both branches have side effects), so this is style, not dead code. | `if (e.shiftKey) handleRedo(); else handleUndo();` | S |

D1–D14 total 20+13+5+4+2+2+1+1+1+1+1+1+1+1 = **54** findings.

---

## 5. The five mandated investigations

### 5.1 `app/layout.tsx:10` — `geistMono` loaded and never applied

**Verdict: a real defect with a user-visible (typographic) consequence. The correct fix for this app is to apply it, not delete it.**

The code path, end to end:

- `app/layout.tsx:2` imports `Geist_Mono`; `:10` builds `const geistMono = Geist_Mono({ subsets: ["latin"] })`; `:47` applies only `${geist.className} antialiased` to `<body>`. `geistMono` is never referenced → Next tree-shakes the generated font class out of the page.
- `app/globals.css:84` (inside `@theme inline`) declares `--font-mono: 'Geist Mono', 'Geist Mono Fallback';` — **literal family names**, not a `var(--font-…)` reference and **without a generic `monospace` keyword**.
- The **built stylesheet proves the consequence**. `npm run build` emitted
  `.font-mono{font-family:Geist Mono,Geist Mono Fallback}`
  and **no `Geist Mono` `@font-face` anywhere** in `.next/static/chunks/*.css` (only `Geist Fallback` / `Geist Mono` appear as bare family names; the sans `Geist` is applied via `geist.className`, the mono one is not). Nothing loads the mono webfont, so on a clinician's machine the browser resolves neither family and falls through to its **default font — which is proportional, not monospace**, because the stack names no generic fallback.

**Is the mono font intended anywhere?** Yes — it is used, and it is intended to be Geist Mono:

| Consumer | Line |
| --- | --- |
| `app/practitioner/tasks/[id]/review/page.tsx` | `:277` (clinical value), `:343`, `:365`, `:573`, `:872`, `:886` (codes / monospaced data) |
| `components/ui/chart.tsx` | `:236` (`tabular-nums` metric) |
| `components/canvas/ReflectionCanvas.tsx` | `:639` (icon glyph) |

**Correct fix = apply it.** Minimal wiring: give the loader a CSS variable —
`Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })` — point the theme at it (`--font-mono: var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace`), and add `${geistMono.variable}` to the `<html>`/`<body>` class. That preserves the design intent (the theme names Geist Mono) and clears the warning.

The defensible alternative is to **remove** the loader and give `--font-mono` a system stack (`ui-monospace, SFMono-Regular, Menlo, monospace`) — zero bytes downloaded. It is *correct* but contradicts the theme's stated intent, so it is the fallback option: **the operator owns this call.** Either way the class is C (a dead binding today), but the consequence is bigger than "unused variable", which is why it is called out here rather than buried in the table.

### 5.2 `components/canvas/ReflectionCanvas.tsx:244` — ref read during render

```tsx
// Force re-render only for UI counters (undo/redo availability)
const [historyLen, setHistoryLen] = useState(strokesRef.current.length);   // :244
const [redoLen,    setRedoLen]    = useState(0);                           // :245
```

**Trigger.** The `useState` initialiser argument is **evaluated on every render**, not just the first — React discards all but the first result. So `strokesRef.current.length` is read during render on every pass. The rule (`react-hooks/refs`) fires because a ref is handed to a function (`useState`) whose result can be observed during render.

**Can the undo/redo counters display a stale value? No — not from this line.** Every mutation of `strokesRef` is paired with a counter update, so the counters track the ref exactly:

| Mutation | Counter update |
| --- | --- |
| commit a stroke (`strokesRef.current = [...strokesRef.current, stroke]`, `:413`) | `setHistoryLen(…)` `:417`, `setRedoLen(0)` `:418` |
| undo (`:457`) | `:459`, `:460` |
| redo (`:468`) | `:470`, `:471` |
| clear (`:477`) | `:479`, `:480` |

The counters are rendered at `:647` (`Undo (${historyLen})`), `:648` (disabled), `:656`/`:657` (redo), `:669` (clear disabled) and `:712–714` (stroke count). The initial value is correct at mount because `strokesRef` is seeded from `initialData?.strokes ?? []` (`:234`) in the same render. **Class B, no user-visible effect** — the clean fix is `useState(() => initialData?.strokes?.length ?? 0)`, which reads the prop rather than the ref (note the sandboxed `() =>` form also keeps the read out of the render path).

One genuine-but-separate observation, recorded because it is adjacent: if `initialData` **changes after mount**, `strokesRef` is never re-synced (a ref is seeded once), so the canvas would not adopt new strokes. That is not what the lint rule is reporting and no caller does it today, but a fix for B16 is a good moment to decide whether the canvas should react to an `initialData` change at all.

### 5.3 `components/ui/sidebar.tsx` — `Math.random()` during render

```tsx
// Random width between 50 to 90%.
const width = React.useMemo(() => {
  return `${Math.floor(Math.random() * 40) + 50}%`   // :611
}, [])
```

**Can it produce a server/client mismatch? Yes, unconditionally — if the component renders on the server.** `useMemo(…, [])` computes once per *instance*, but the server computes one value and the client computes a different one; the width is then applied as an inline style (`max-w-(--skeleton-width)`), so React would report a hydration mismatch and drop/repair the subtree. Memoisation does not help here, because the two environments are different instances; it only stabilises the value *within* one environment.

**But it cannot fire today, for two independent reasons:**

1. `SidebarMenuSkeleton` (`:602`) is defined and exported (`:717`) and has **zero importers** repo-wide.
2. `components/ui/sidebar.tsx` **itself has zero importers** — a repo-wide search for `ui/sidebar` (excluding `node_modules`, `.next`, `scratch`) returns only the comment in `eslint.config.mjs:30`. The app's actual sidebar is `components/dashboard-sidebar.tsx` (imported by `components/dashboard-shell.tsx:3`) plus `components/sidebar/*`.

**Class B (real defect, unreachable).** Recommended action: delete the file — it is an unreferenced shadcn kit, and deleting it clears this finding *and* B5 without any behavioural risk. Do not "fix" the `Math.random` in a file nothing renders.

### 5.4 The 14 (now 12) `react-hooks/set-state-in-effect` sites

Bucketed as the brief requires — **not one blob.** Bucket 6a is the real cascading-render risk; 6c is legitimate external-system synchronisation.

| Bucket | Site | Line | Shape | Verdict |
| --- | --- | --- | --- | --- |
| **6a — derives state from props** (real cascading-render risk) | `components/tasks/DynamicTaskForm.tsx` | 345 | mirrors `externalSubmissionId` prop into state | Risk real; the state initialiser at `:339` already seeds the same value → **the effect is redundant**. (B11) |
| | `components/vignette-generator.tsx` | 154 | mirrors the `session` prop into `step`/`sessionInput`/`analysis`/`practicePackage` | Risk real, **but this is the deliberate hydration latch** guarded by `lib/session-hydration.ts` and 15 tests. Fix only with those tests green. (B13) |
| | `hooks/use-clinical-workspace.ts` | 33 | derives a default selection from `hierarchy` | Risk real but fully guarded (returns early when the selection is valid). (B15) |
| | `components/dashboard-shell.tsx` | 52 | resets `drawerOpen` when the selection changes | Risk real; a navigation side effect on prop change. (B14) |
| **6b — derives state from fetch** | `app/practitioner/tasks/[id]/review/page.tsx` | 1288 | `fetchBundle()` | Sets state after `await`; the only synchronous part (`setLoading(true)`, `setFetchError(null)`) is a no-op bail-out. (B6) |
| | `components/ClientLanding.tsx` | 89 | `fetchClients()` | Same shape; `setLoading(true)` is a no-op. (B7) |
| | `components/client-view.tsx` | 30 | `setIsLoading(true)` + `fetchVignettes()` | Same; `isLoading` already `true`. (B8) |
| | `components/main-content.tsx` | 90 | `fetchVignettes()` | Same. (B9) |
| **6c — legitimate external-system synchronisation** | `components/canvas/ReflectionCanvas.tsx` | 254 | initial read of `matchMedia("(prefers-color-scheme: dark)")`, then subscribed | Correct pattern; `useSyncExternalStore` is the modern idiom. (B2) |
| | `hooks/use-mobile.ts` | 14 | initial read of a width `matchMedia`, then subscribed | Correct pattern; deliberately starts `undefined` to be hydration-safe. (B3) |
| **6d — other (side effect / callback)** | `components/tasks/DynamicTaskForm.tsx` | 461 | debounced autosave (`triggerAutoSave`) | An intended side effect, not state derivation. (B12) |
| | `components/ui/carousel.tsx` | 98 | `onSelect(api)` — notifies the parent and registers listeners | Callback registration against the embla instance; the rule cannot see through the callback prop. Unreachable file. (B5) |

Bucket counts: **6a = 4, 6b = 4, 6c = 2, 6d = 2 → 12**, in 11 files (`DynamicTaskForm.tsx` holds two).

### 5.5 `components/vignette-generator.tsx` — the unused values: dead, or parked mid-feature?

Git history was checked first, as required. The brief lists seven names under the phrase "six unused values"; they are **seven names across five findings** (two pairs share a line).

| Name | Line | Last touched by | Was it ever used? | Verdict |
| --- | --- | --- | --- | --- |
| `generateStructuredTask` | 28 (import) | `0953b90` "implement structured CBT schemas…" | **No.** `git log -S` shows it only in its introducing commit; the live path posts to `/generate/structured-task` (`:370`, `:465`). | **Dead.** Drop from the import. |
| `getDefaultActivity` | 47 | `80ebb57` "modality selection normalization…" | **No.** Added and never called. | **Dead by design.** The client sends `activityFormat: "auto"` and the Worker owns the modality→activity mapping (`documentation.md:306–307`). Keeping it would create a second, divergent mapping. |
| `sessionContext` / `setSessionContext` | 132 | `0953b90` | **No.** `git log -S 'setSessionContext('` returns **nothing** — the setter was never called once, from the day it was declared. | **Dead.** Delete both. |
| `reflectionPrompt` / `setReflectionPrompt` | 135 | `0953b90` | **No.** | **Dead.** Delete both. (Distinct from the `"reflection_prompt"` task-type string, which is live at `:700`.) |
| `err` | 239 | (catch binding in `handleHeidiImport`) | Never read. | **Dead.** `catch {`. |

**Are they "deliberately parked mid-feature"?** They are scaffolding from two named feature commits (`0953b90`, `80ebb57`) that was never wired — but **nothing in `documentation.md` describes any of them as pending behaviour.** The documented design for the one that *looks* behavioural (`getDefaultActivity`) puts the mapping on the Worker, and the app already calls that path. So the honest verdict is **dead, not parked**: deleting them loses no intended behaviour and cannot contradict the docs. If the modality→default-activity mapping is still wanted client-side, it deserves an explicit backlog entry (the operator's call), not a permanently-unreferenced helper.

**Recommendation:** delete all seven bindings. This is class C and clears **7 of the 16** `no-unused-vars` findings in one file.

---

## 6. Register — class E (2 in-population + 7 moot)

### 6.1 In-population (2)

| # | Location | Rule | Why it is E, not D | Precise proposal | Effort |
| --- | --- | --- | --- | --- | --- |
| E1 | `backend/CloudFlare.js:190` | `import/no-anonymous-default-export` | `export default { async fetch(request, env) {…} }` is **the Cloudflare Workers module-worker entry shape** — `wrangler` requires the default export. The rule (an eslint-config-next carry-over) is a React rule misfiring on Worker entry code; the members *are* named, so its rationale (named exports for stack traces) is satisfied. This is the `@ts-nocheck`'d Worker entry the brief calls out. | Scope it, don't downgrade it globally: add `{ files: ["backend/**/*.js", "workers/**/*.ts"], rules: { "import/no-anonymous-default-export": ["warn", { allowObject: true }] } }` to `eslint.config.mjs`. `allowObject: true` permits object-literal default exports while keeping the rule live for anonymous `export default function(){}`. | S |
| E2 | `workers/mcp-gateway/src/index.ts:1` | `import/no-anonymous-default-export` | Identical shape — the `alice-mcp` Worker entry. | Same scoped override (the `workers/**/*.ts` glob above). | S |

The two are one decision, one config change. The alternative — naming the object (`const worker = {…}; export default worker;`) — is a 1-line change per file, but the Worker entry shape is idiomatic and the config fix is the one that does not touch shipped Worker code.

### 6.2 Moot — removed by card 6 (7), excluded from all totals above

| File (deleted) | Finding | Rule |
| --- | --- | --- |
| `components/clinical-folder-tree.tsx` | `CollapsibleContent` @4:23 | `no-unused-vars` |
| | `CollapsibleTrigger` @4:43 | `no-unused-vars` |
| | `selectedClientId` @15:3 | `no-unused-vars` |
| | `selectedCaseId` @16:3 | `no-unused-vars` |
| | `setIsMounted(true)` in effect @23:5 | `set-state-in-effect` |
| `components/ui/use-mobile.tsx` | `setIsMobile(…)` in effect @14:5 | `set-state-in-effect` |
| `components/ui/use-toast.ts` | `actionTypes` @18:7 | `no-unused-vars` |

The last one is worth flagging for the operator: `hooks/use-toast.ts:18` (C13) is the **same** `actionTypes` finding that was moot in the deleted `components/ui/use-toast.ts` duplicate. Removing the duplicate was right, but the surviving copy still carries it.

### 6.3 Where I disagree with card 4's exceptions

Card 4's seven documented exceptions were reviewed, not re-litigated. I agree with all of them bar one, recorded here with evidence as the brief instructs:

- `@typescript-eslint/no-explicit-any` → `warn` — **agree.** A typing programme, not a gate install.
- `react-hooks/set-state-in-effect` → `warn` — **agree, but the exception is now oversized.** Its comment says "14 sites across 13 files"; post-card-6 it is **12 across 11**, and 6 of the 12 (buckets 6b + 6c) are patterns with no cascading-render impact. The comment should be corrected to the current counts when the sites are worked (§7).
- `react-hooks/refs` → `warn`, `react-hooks/purity` → `warn`, `react/no-unescaped-entities` → `warn` — **agree.** Single/low-count and site-specific (though the `purity` site is in an unreferenced file — see §5.3: delete the file and the exception can go).
- `@typescript-eslint/ban-ts-comment` off under `backend/` — **agree** (deliberate `@ts-nocheck`).
- `@typescript-eslint/no-require-imports` off for `patch-cloudflare.js` / `patch-tasks.js` / `patch-vignette.js` — **disagree: now a no-op.** Card 6 deleted all three files, so this override matches nothing (card 6's handoff flagged it as card 7's to own). It is not a scaling problem — it is dead config. **Recommendation: delete the override block in the same commit that touches `eslint.config.mjs`.** (This is a config-gap class E item; it costs 0 findings to clear but is 6 dead config lines.)

---

## 7. Proposed fix plan

### 7.1 Ranked follow-up cards

Ordered by (risk-adjusted value ÷ risk). Each is a **proposal** — the operator decides; no rule is deleted, downgraded or silenced by this card.

| Rank | Proposed title | One-line scope | Findings cleared | Class | Risk |
| --- | --- | --- | --- | --- | --- |
| 1 | **Lint 8a — delete the dead bindings and stray expressions** | Remove the 15 unused bindings (C1–C6, C8–C14) and the 3 stray empty template literals (C15–C17) across 10 files; run `tsc`, `npm test`, `npm run build`. C7 (`geistMono`) is the one dead binding that is a *design decision*, so it moves to rank 2. | **18** | C | **Trivial.** Deletions of provably-unused bindings; the gates confirm. |
| 2 | **Lint 8b — apply the Geist Mono font (or drop it)** | Decide apply-vs-remove for `geistMono`; if apply, wire `variable: "--font-geist-mono"`, point `--font-mono` at it with a generic `monospace` fallback, and add `${geistMono.variable}` to the root element. | 1 | C | **Low**, visual only — but it is the one item whose *consequence* (non-monospaced clinical values in the review screen) exceeds its warning weight. Operator decision. |
| 3 | **Lint 8c — fix `ReflectionCanvas`'s ref read and handle deps** | B16 (`useState(() => initialData?.strokes?.length ?? 0)`) + B1 (add `clientId, submissionId` to the `useImperativeHandle` deps). | 2 | B | **Low code risk, high latent value** — B1 is the only finding that could become a PHI mis-attribution if a caller is added later. |
| 4 | **Lint 8d — audit the two unreferenced shadcn kit files** | Prove `components/ui/sidebar.tsx` and `components/ui/carousel.tsx` unreferenced (per-file repo-wide search, the card-6 standard) and delete them. | 2 | B (fix) / C (files) | **Low.** Both have zero importers (verified here). Clears B4 and B5 and removes ~1 000 lines of kit. |
| 5 | **Lint 8e — the `any` sweep** | Remove the 51 `no-explicit-any` sites (D1–D11), file by file, starting with `useClientNavStore.ts` (20) and `vignette-generator.tsx` (13). `tsc` is the gate; no behaviour change intended. | **51** | D | **Medium.** Typing can surface real errors under the `any`; sequence by file so a failure is isolated. Largest single clear, so worth doing — but last, because nothing is broken. |
| 6 | **Lint 8f — one-line style and micro-fixes** | D12/D13 (two apostrophe escapes), D14 (ternary → `if`), E1/E2 (`allowObject: true` scoped to Worker entries), plus deleting the now-dead `patch-*.js` CommonJS override. | 5 | D + E | **Trivial.** Config + 3 one-line source edits. |
| 7 | **Lint 8g — the set-state-in-effect programme (batched, not one blob)** | Bucket 6b first (4 fetch-derived sites: drop the no-op synchronous pre-sets — near-zero risk), then 6a (4 props-derived sites — behavioural; must keep the 15 hydration-guard tests green), then 6c/6d (decide `useSyncExternalStore` vs scoping the rule). | 12 | B | **Medium.** 6a/6d are behaviour changes and the highest regression risk in the register (session hydration). Batched deliberately. |

Ranks 1–7 clear **18 + 1 + 2 + 2 + 51 + 5 + 12 = 91** — the whole register, with no finding counted twice and none left over.

**Class A:** no card — the class is empty (§2). If the operator wants a belt-and-braces guard for rank 3, the cheapest one is rank 3 itself, which removes the latent path rather than adding a test.

### 7.2 Keep class D in as few cards as possible

Honoured: the 51 `any` sites are **one** card (rank 5, D1–D11) and the remaining 3 D findings are folded into rank 6 (D12–D14). No D-class card splits the `any` programme.

### 7.3 Which classes are safe to leave indefinitely, and what it costs

| Class | Safe to leave? | What it costs to leave it |
| --- | --- | --- |
| **A** | n/a — empty. | Nothing. |
| **B** | **Partly.** The unreferenced ones (B4, B5) are free to leave *only while* the files stay unreferenced — they should be deleted instead (§5.3). The reachable ones (B2, B3, B6–B16) cost a render or two per mount, plus a diluted warning list. **B1 is the exception: it is a latent correctness path, not a cosmetic one — fix it or keep the "no callers" proof current.** B13 is the one where a *fix* is riskier than the defect; if the operator fixes nothing else in class B, the honest call is to leave B13 and document why. | Extra renders; a warning list that no longer reads as "here is the work". |
| **C** | **Yes, entirely.** Zero behaviour. | Pure noise: 19 warnings, and a maintenance drag (a reader cannot tell live scaffolding from dead scaffolding — e.g. `getDefaultActivity` reads like live modality logic). The stray template literals at EOF mislead anyone reading a file's tail. Cheapest class to clear (ranks 1 + 2: 19 findings, trivial risk). |
| **D** | **Yes.** By definition no behaviour. | 54 warnings — 59 % of the register. The real cost is not the warnings but the **lost type safety at 51 boundaries**: a schema or API change through `useClientNavStore.ts` or the `vignette-generator` casts would not be caught by `tsc`. That is a correctness *risk*, not a correctness *bug*; it is why rank 5 is worth doing but never urgent. |
| **E** | **Yes** (2 in-population). | Two permanent warnings plus 6 dead config lines (the `patch-*.js` override). One config edit clears the noise without changing any rule's strictness for real code. |

### 7.4 What the gate does and does not protect

The lint gate exits **0** on errors. All 91 items are warnings, so **none of them blocks a commit, and the gate will still fail on a genuine error** introduced later. The cost of leaving the register unaddressed is therefore *signal dilution and latent risk*, not a broken gate — which is exactly why the operator, not this card, decides what to action.

---

## 8. Verification on the triaged tree

Run on `alan` @ `2a4b740` (the tree this register describes; the register is documentation and cannot affect these gates):

| Gate | Command | Result |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | **exit 0** |
| Tests | `npm test` | **exit 0 — 35/35 + 12/12 + 15/15 = 62/62** |
| Build | `npm run build` | **exit 0 — 13 routes**, identical to card 6's recorded list |
| Lint | `npm run lint` | **exit 0 — 0 errors / 91 warnings** |

Raw output: `debug_reports/gates_lint_triage_20261010.txt`.

Local-only. **No push, no PR.** One commit. `git ls-remote --heads origin alan` must still read `c6021602881baf5c69137579a4ac58ece7717966`; proof is in `debug_reports/gates_lint_triage_20261010.txt` and the task handoff.

[COMPLETION]
