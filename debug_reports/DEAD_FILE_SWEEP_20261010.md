# Dead-file sweep — 15 files, one reference proof each

Date: 2026-10-10 · Card: `t_e3b204c2` (fix 6, chained behind `t_7e8880de`) · Branch: `alan` (local only, NO PUSH)

Deleted in this change:

- named set — `components/clinical-folder-tree.tsx`, `components/ui/use-toast.ts`,
  `components/ui/use-mobile.tsx`, `components/ui/sonner.tsx`, `styles/globals.css`,
  `patch-cloudflare.js`, `patch-tasks.js`, `patch-vignette.js`,
  `scripts/dispatch-inbox.ps1.bak-20261001-161325`, `README.md`
- bounded sweep — `ai-config/prompts/intake.txt`, `ai-config/prompts/session.txt`,
  `workers/mcp-gateway/src/memory.ts` (all zero bytes),
  `.gradle/9.2.0/gc.properties`, `.gradle/vcs-1/gc.properties` (both zero bytes)

Nothing else was deleted, and no dependency, lockfile, config or live source file was changed.

---

## 1. Method

Searches ran over the whole working tree from the repo root with the same exclusions card 2 used —
build and dependency directories cannot reach a shipped bundle:

```
EX="--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=scratch \
    --exclude-dir=.gradle --exclude=*.tsbuildinfo --exclude=package-lock.json --exclude=pnpm-lock.yaml"
```

Coverage was deliberately wider than a bare import string: the file's own name case-insensitively in
every form (`clinical-folder-tree`, `ClinicalFolderTree`, `use-toast`, `useToast`, `use-mobile`,
`useIsMobile`) so relative imports (`./use-toast`) and identifier imports are caught the same as
`@/components/...`; dynamic `import()` and `next/dynamic`; barrel files; `tests/` and `scripts/`; the
whole `debug_reports/` corpus; Markdown; and every config surface that can name a path (tsconfig
`paths`, Tailwind v4 `@source` globs in `app/globals.css`, `components.json`, `eslint.config.mjs`).

**Every search below was run on the tree at `3b191e4`, i.e. *before* the deletions**, so each target
file still exists and appears only as its own definition. The raw transcript with each command, its
output and its exit code is in `debug_reports/gates_dead_file_sweep_20261010.txt` §1.

---

## 2. Per-file evidence

### 2.1 `components/clinical-folder-tree.tsx`

```
$ grep -rniI $EX -e 'clinical-folder-tree' -e 'ClinicalFolderTree' . | grep -v '^./debug_reports/' | grep -v '^./OVERNIGHT_REPORT.md'
./components/clinical-folder-tree.tsx:7:export interface ClinicalFolderTreeProps {
./components/clinical-folder-tree.tsx:13:export function ClinicalFolderTree({
./components/clinical-folder-tree.tsx:17:}: ClinicalFolderTreeProps) {
./documentation.md:282: `components/clinical-folder-tree.tsx` is an unused alternate (see §13).
./documentation.md:863:   this approach; the hidden role-play/quiz blocks and the unreferenced `components/clinical-folder-tree.tsx`
./documentation.md:1239:| Unused components | `components/clinical-folder-tree.tsx` is a truncated stub referencing an undefined ...
```

**Zero importers.** Outside `debug_reports/` (its own audit, the lint logs, the generated `_SIGNAL.txt`
aggregate) and `OVERNIGHT_REPORT.md` (a stale historical run), the only matches are the file's own
three definition lines and three `documentation.md` prose sites — all three rewritten in this commit
(§6). No file under `app/`, `components/`, `lib/`, `hooks/`, `stores/`, `types/`, `tests/` or
`scripts/` names it.

The file is also self-evidently unfinished: its client list renders an empty `<Collapsible>` whose
only child is the comment `{/* ... rest of your code ... */}`. It never broke the build because
Turbopack only compiles files reachable from an entry point — independent confirmation that nothing
imports it.

### 2.2 `components/ui/use-toast.ts`

```
$ grep -rniI $EX -e 'use-toast' -e 'useToast' . | grep -v '^./debug_reports/'
./app/dashboard/page.tsx:9:import { useToast } from "@/hooks/use-toast";
./app/dashboard/page.tsx:34:  const { toast } = useToast();
./components/ui/toaster.tsx:3:import { useToast } from '@/hooks/use-toast'
./components/ui/toaster.tsx:14:  const { toasts } = useToast()
./components/ui/use-toast.ts:171:function useToast() {        <- the file's own definition
./components/ui/use-toast.ts:191:export { useToast, toast }   <- the file's own export
./documentation.md:103, 905, 908, 1239                        (prose, all `hooks/`)
./hooks/use-toast.ts:171,191                                  (the live copy)
```

**Zero importers of this path.** Both live consumers — `app/dashboard/page.tsx:9` and
`components/ui/toaster.tsx:3` — import `@/hooks/use-toast`, and `hooks/use-toast.ts` stays (§5).
The two files are near-copies, which is exactly the drift risk the deletion removes.

### 2.3 `components/ui/use-mobile.tsx`

```
$ grep -rniI $EX -e 'use-mobile' -e 'useIsMobile' . | grep -v '^./debug_reports/'
./components/ui/sidebar.tsx:8:import { useIsMobile } from '@/hooks/use-mobile'
./components/ui/sidebar.tsx:69:  const isMobile = useIsMobile()
./components/ui/use-mobile.tsx:5:export function useIsMobile() {   <- the file's own definition
./documentation.md:103, 900                                     (prose, `hooks/`)
./hooks/use-mobile.ts:5                                          (the live copy)
```

**Zero importers of this path.** The only consumer, `components/ui/sidebar.tsx`, imports
`@/hooks/use-mobile` (line 8), which stays (§5).

### 2.4 `components/ui/sonner.tsx`

```
$ grep -rniI $EX 'sonner' . | grep -v '^./debug_reports/'
./components/ui/sonner.tsx:4:import { Toaster as Sonner, ToasterProps } from 'sonner'
./components/ui/sonner.tsx:10:    <Sonner
./package.json:63:    "sonner": "^1.7.1",
./documentation.md:909:  `components/ui/sonner.tsx` exports a second `Toaster`, but no call site uses sonner, so it is
```

**No call site.** The only two source hits are the file's own body; the only other references in the
repo are the dependency declaration and prose. Card 1 deliberately mounted
`components/ui/toaster.tsx` instead. Deleting the file leaves the `sonner` **dependency** with no
importer — recorded as a recommendation in §4, deliberately **not** removed.

### 2.5 `styles/globals.css`

Card 5 (`t_7e8880de`) concluded **dead** and this card's precondition is met; its proof is re-quoted
in `debug_reports/UI_DESTRUCTIVE_FOREGROUND_20261010.md` §6, and re-run here:

```
$ grep -rniI $EX -e 'styles/globals' -e "['\"]\./styles" -e "['\"]\.\./styles" -e 'styles/' . | grep -v '^./debug_reports/'
./documentation.md:107:| `styles/globals.css` | Duplicate of the Tailwind theme (the canonical copy per `components.json` is `app/globals.css`) |
./documentation.md:1248: ... (the §13.3 row)
```

**No importer, no config reference.** `components.json` names `app/globals.css` as the css entry;
`app/globals.css` carries the `@source` globs; the card-5 rendered proof showed the shipped build's
computed `--background`/`--radius` are `app/globals.css`'s values, not this file's. After the
deletion the `styles/` directory is empty on disk, and an empty directory is not tracked by Git.

### 2.6 `patch-cloudflare.js`, `patch-tasks.js`, `patch-vignette.js` (repo root)

```
$ grep -rniI $EX -e 'patch-cloudflare' -e 'patch-tasks' -e 'patch-vignette' . | grep -v '^./debug_reports/'
./eslint.config.mjs:41:    files: ["patch-cloudflare.js", "patch-tasks.js", "patch-vignette.js"],
```

**No importer, no caller.** The single non-report match is the ESLint config's file-scoped override
for these exact three paths (a `commonjs` `sourceType` + `no-require-imports: off` exception added by
card 4). Nothing imports, requires or executes them; they are one-shot source-patching utilities. The
override block is left in place and reported in §4.

### 2.7 `scripts/dispatch-inbox.ps1.bak-20261001-161325`

```
$ grep -rniI $EX 'dispatch-inbox' . | grep -v '^./debug_reports/'
./.clinerules:36: ... standalone scripts (`dispatch-inbox.ps1`, Node tools) ...
./scripts/run-silent.vbs:2:WshShell.Run "powershell.exe ... -File ""D:\Work\Neuvo\ALICE\Source\scripts\dispatch-inbox.ps1""", 0, False
```

**Zero importers.** Both hits name the *live* `scripts/dispatch-inbox.ps1` — `run-silent.vbs` runs it
hidden — not the backup. The `.bak-20261001-161325` suffix is an editor/timestamped backup of that
file, matched by the sweep's `*.bak*` class. The live script is untouched (§5).

### 2.8 `README.md` — 0 bytes, deleted, stated explicitly

`README.md` is zero bytes and has been since it was created (commit `5770c91`, "Renamed Mindcare and
Bastion to ALICE"). The only reference to it anywhere in the repo is the documentation row that
describes it as empty:

```
$ grep -rniI $EX -e 'README' -e 'readme' . | grep -v '^./debug_reports/'
./documentation.md:1249:| Empty README | `README.md` is zero bytes; this document is not linked from anywhere in the repo |
```

Deleting a zero-byte README is correct — an empty file carries no information, and the tracked blob
is recoverable from history (`git show 3b191e4:README.md` returns an empty file). Said explicitly
because it is the repository's front door: after this commit a fresh clone has **no README at all**.
That is the honest description of the outcome, and it is recorded in `documentation.md` §13.3 rather
than left as a silent removal.

### 2.9 Sweep, zero-byte class: `ai-config/prompts/intake.txt`, `ai-config/prompts/session.txt`

```
$ grep -rniI $EX -e 'ai-config' -e 'intake.txt' -e 'session.txt' . | grep -v '^./debug_reports/'
./documentation.md:119:| `ai-config/` | `mcp.json` (...) and `prompts/` (`intake.txt`, `session.txt` — both empty) |
./documentation.md:961/1242/1243: ... prose about `ai-config/mcp.json` and the empty placeholders ...
./workers/mcp-gateway/src/index.ts:14:    // (.cursor/config.json, ai-config/mcp.json). ...
```

**Zero readers.** Both files are zero bytes and nothing — no code, script, test or config — ever
opens them; the only matches are documentation prose. `ai-config/mcp.json` (a real file) is
untouched. Both are recoverable from history; the `prompts/` directory is now empty on disk.

### 2.10 Sweep, zero-byte class: `workers/mcp-gateway/src/memory.ts`

```
$ grep -rniI $EX -e 'mcp-gateway/src/memory' -e 'memory.ts' . | grep -v '^./debug_reports/'
./documentation.md:966: imported — `src/index.ts` inlines both; `src/memory.ts` is empty.
./documentation.md:1241:| Unused MCP sources | ... `src/memory.ts` is empty |
```

**Zero importers.** The Worker's entry is `main = "src/index.ts"` (`workers/mcp-gateway/wrangler.toml`)
and `src/index.ts` contains no import of `./memory` at all. The file is zero bytes. Its siblings
`src/tools.ts` and `src/context.ts` are also unimported but are **not** zero bytes, so they are out of
the sweep's classes and stay, reported in §4.

### 2.11 Sweep, zero-byte class: `.gradle/9.2.0/gc.properties`, `.gradle/vcs-1/gc.properties`

```
$ grep -rniI $EX -e '\.gradle' -e 'gc\.properties' . | grep -v '^./debug_reports/'
./documentation.md:132/133/1185/1186/1189/1199   (prose about the Gradle modules and their build files)
$ find . -path ./node_modules -prune -o -path ./.next -prune -o -path ./.git -prune -o -type f -size 0 -print
./.gradle/9.2.0/gc.properties
./.gradle/vcs-1/gc.properties
./ai-config/prompts/intake.txt
./ai-config/prompts/session.txt
./README.md
./workers/mcp-gateway/src/memory.ts
```

**Zero-byte Gradle cache state.** `gc.properties` records Gradle's last garbage-collection
timestamps; Gradle recreates it on demand, nothing in the repo reads it, and no path in the repo
points at it. They are removed as part of the sweep's zero-byte class, not because `.gradle/` should
be half-empty: the directory's **other six** tracked files (locks, hash bins, `cache.properties`) are
build output that should arguably be untracked and ignored together, which is an ignore/untrack
decision and is reported in §4 instead of being made here.

---

## 3. The bounded sweep, and where its boundary is

Three classes only, exactly as specified: root-level one-off scripts nothing references, editor/temp
backups, and other zero-byte files.

| Class | Found | Deleted | Kept, with reason |
| --- | --- | --- | --- |
| Editor/temp backups `*.bak*` `*.old` `*.orig` `*.tmp*` `*~` `*.swp` `*.save` `*.rej` | 1 | 1 (`scripts/dispatch-inbox.ps1.bak-…`) | — |
| Zero-byte files | 6 | 6 (see §2.8–2.11) | — |
| Root one-off scripts nothing references | 3 | 3 (`patch-*.js`) | `overnight-debug.ps1` — kept, see §4 |

The sweep commands and their raw output are in `debug_reports/gates_dead_file_sweep_20261010.txt` §1
(section F). No other file matched any class, so nothing else was touched.

### Found dead but NOT deleted in this change

| Path | Why it was not deleted |
| --- | --- |
| `lib/clinical-hierarchy.ts` | Newly one importer short: the only thing that referenced it was `components/clinical-folder-tree.tsx`, which this commit deletes. `10_Projects/ALICE/Backlog.md` carries an open P1 on it versus `useClientNavStore`, so its fate is not this card's to decide. Also in §13.3 "Two hierarchy models" with `hooks/use-clinical-workspace.ts` and `lib/vignette-restore.ts` |
| `workers/mcp-gateway/src/tools.ts`, `src/context.ts` | Unused and unimported per `documentation.md` §13.3, but non-empty: whether the gateway should import them or drop them is a design decision |
| `overnight-debug.ps1` (repo root) | A root-level one-off script that nothing references — but it is the tool that **generated** `debug_reports/DEBUG_*.md` (Ollama at `localhost:11434`, model `qwen7b-fit`), so it is operational provenance, not junk |
| `package.json` → `"sonner": "^1.7.1"` | Now unused. A dependency edit touches the lockfile ambiguity card 4 reported and the operator has not ruled on; recommendation only |
| `eslint.config.mjs:41` | The `files: ["patch-cloudflare.js", …]` override now matches no file. Card 4 owns this config and card 7 owns the lint triage; not edited here |
| `.gradle/**` (6 remaining tracked files) | Gradle build output that should arguably be untracked + ignored — an ignore/untrack decision |
| `debug_reports/_SIGNAL.txt` | Stale generated aggregate (382 KB) that still quotes deleted paths; explicitly a recommendation, not a deletion |
| `styles/` , `ai-config/prompts/` (directories) | Empty on disk after the deletions. Git does not track empty directories, so they are already gone from a fresh clone; nothing was done to the working tree |

---

## 4. No cascades — deliberately not acted on

Deleting a file can make another newly unreferenced; this commit stops at each such boundary and
reports it (all rows above). The two hard ones:

- **`lib/clinical-hierarchy.ts`** — reachable only from the stub this commit removes. Its P1 in
  `10_Projects/ALICE/Backlog.md` is untouched and unread by this card; judged by the operator, not here.
- **`sonner` the dependency** — the only importer was `components/ui/sonner.tsx`. `package.json` and
  both lockfiles are unchanged.

Nothing in this commit imports, re-exports, configures or documents a path that no longer exists
except the three now-inert references listed in §3, each of which is pinned to an owner (card 4 for
`eslint.config.mjs`, the operator for `sonner`/`.gradle`/`_SIGNAL.txt`, the backlog for
`clinical-hierarchy.ts`).

---

## 5. Live files checked and deliberately kept

Each was read and its live dependency confirmed before the deletions, and none was modified:

| File | Why it is live |
| --- | --- |
| `hooks/use-toast.ts` | imported by `app/dashboard/page.tsx:9` and `components/ui/toaster.tsx:3` — the module every `toast()` call uses |
| `hooks/use-mobile.ts` | imported by `components/ui/sidebar.tsx:8` (`useIsMobile()` at line 69) |
| `components/ui/toaster.tsx` | mounted as `<Toaster />` by `app/layout.tsx` (card 1) |
| `components/ui/sidebar.tsx` | the shadcn primitive the live dashboard sidebar is built on |
| `lib/clinical-hierarchy.ts` | §13.3 row + open P1; not this card's call (§4) |
| `app/globals.css` | the canonical theme (`components.json`, `app/layout.tsx`, the `@source` globs) |
| `scripts/dispatch-inbox.ps1` | run hidden by `scripts/run-silent.vbs`; only its `.bak` was deleted |
| `ai-config/mcp.json`, `.cursor/config.json` | live MCP client registration (unchanged) |
| `workers/mcp-gateway/src/index.ts`, `wrangler.toml`, `package.json` | the Worker's actual entry and config |
| `tests/worker.test.mjs`, `pdf-export.test.mjs`, `hydration-guard.test.mjs` | the 62-check harness; untouched and green |
| `package.json`, `package-lock.json`, `pnpm-lock.yaml` | untouched — no dependency or lockfile change in this commit |
| `debug_reports/DEBUG_hooks_use-toast.md`, `DEBUG_hooks_use-mobile.md` | audits of the **live** hooks duos' other half; subjects kept, so not annotated |

---

## 6. Documentation updated in the same commit

`documentation.md` — every site naming a deleted path (the grep in §2.1–2.11 lists them all):

| Site | Change |
| --- | --- |
| §2 repository map | the `styles/globals.css` row removed (the file is gone and the directory is empty); the `ai-config/` row rewritten to record the zero-byte `prompts/` deletion |
| §4.4 sidebar paragraph | `clinical-folder-tree.tsx` "is an unused alternate" → records the deletion |
| §8.5 vignette bullet | correction: that change removed the stub's *usage*, not the file — `ClinicalFolderTreeProps` was defined in `ed4b794`, so the `tsc` errors were fixed, and the file was deleted here |
| §8.5 toast bullet | `components/ui/sonner.tsx` recorded as deleted, with the now-unused `sonner` dependency |
| §9 MCP gateway | `src/memory.ts` recorded as deleted; `tools.ts`/`context.ts` marked **kept** as a design decision |
| §13.3 Unused components | row closed: all four duplicates deleted, with the pointer to this report |
| §13.3 Unused MCP sources | split: the two non-empty modules kept, `memory.ts` deleted |
| §13.3 Empty placeholders | the two `ai-config/prompts/` files removed from the list |
| §13.3 Duplicate theme | the `styles/globals.css` row closed — deleted by the sweep it was waiting for |
| §13.3 Empty README | records the deletion and states that a fresh clone now has no front door |
| §13.3 new rows ×3 | root one-shot scripts, editor backup, tracked Gradle build state (the last as a flagged recommendation) |
| §13.4 lint-gate row | 98 → **91** warnings after the sweep; the `patch-*.js` override now matches no file |

The four `debug_reports/DEBUG_*.md` audits of deleted files (`clinical-folder-tree`, `ui/use-toast`,
`ui/use-mobile`, `ui/sonner`) each open with a `FILE DELETED 2026-10-10` note pointing back at §13.3
and this report. The diff on all four is additive only: original BOM (`EF BB BF`) and heading
preserved, working-tree CRLF preserved — no encoding churn.

---

## 7. Gates

| Gate | Before (`3b191e4`) | After | Result |
| --- | --- | --- | --- |
| `npx tsc --noEmit` | exit 0 | exit 0 | unchanged |
| `npm test` | 35/35 + 12/12 + 15/15 | 35/35 + 12/12 + 15/15 = 62 | unchanged |
| `npm run build` | exit 0 | exit 0 | — |
| Route list (`Route (app)` block) | 13 routes | 13 routes | `diff` exit 0 — byte-identical |
| `npm run lint` | 0 errors / 98 warnings | 0 errors / **91 warnings** | 7 findings removed, all in deleted files (below) |
| `npm run docs:check` | — | `docs:check — ok (documentation.md moved with 5 path(s)).` exit 0 | pass |

The route list, captured from both production builds (before and after the deletions):

```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/analyze/session
├ ƒ /cases/[caseId]/sessions/[sessionId]
├ ○ /client-login
├ ○ /dashboard
├ ○ /forgot-password
├ ƒ /homework/[sessionId]
├ ○ /login
├ ƒ /practice/[sessionId]
├ ƒ /practitioner/tasks/[id]/review
├ ○ /signup
└ ○ /test-auth
```

13 before, 13 after, same paths and same static/dynamic kind (`diff` exit 0).

The seven findings the sweep removed, all inside deleted files (from the card-4 baseline
`lint_gate_npm_run_lint_after_20261010.txt` versus a fresh run):

```
components/clinical-folder-tree.tsx   4:23  @typescript-eslint/no-unused-vars  'CollapsibleContent' is defined but never used
components/clinical-folder-tree.tsx   4:43  @typescript-eslint/no-unused-vars  'CollapsibleTrigger' is defined but never used
components/clinical-folder-tree.tsx  15:3   @typescript-eslint/no-unused-vars  'selectedClientId' is defined but never used
components/clinical-folder-tree.tsx  16:3   @typescript-eslint/no-unused-vars  'selectedCaseId' is defined but never used
components/clinical-folder-tree.tsx  23:5   react-hooks/set-state-in-effect
components/ui/use-mobile.tsx         14:5   react-hooks/set-state-in-effect
components/ui/use-toast.ts           18:7   @typescript-eslint/no-unused-vars  'actionTypes' is assigned a value but only used as a type
```

No finding was added, none changed location, and no other file's count moved — so card 7's triage
starts from 91 findings, 7 fewer and none of them moot.

`next-env.d.ts` was flipped by `next build` (`.next/dev/types` ↔ `.next/types`) and restored with
`git checkout` before staging; `.next/` and `tsconfig.tsbuildinfo` are untracked/ignored.

---

## 8. Freeze state (NO PUSH)

No `git push`, no PR. One local commit on `alan`, on top of card 5's `3b191e4`.
`git ls-remote --heads origin alan` must still read `c6021602881baf5c69137579a4ac58ece7717966`.
