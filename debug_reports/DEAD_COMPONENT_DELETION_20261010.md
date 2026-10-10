# Dead-component deletion — `session-history-panel`, `sidebar/Sidebar`, `sidebar/EditableText`

Date: 2026-10-10 · Card: `t_f7406d12` (fix 2/4, chained behind `t_d027ed5b`) · Branch: `alan` (local only, NO PUSH)
Deleted in this change:

- `components/session-history-panel.tsx` (exports `SessionHistoryPanel`)
- `components/sidebar/Sidebar.tsx` (exports `Sidebar`)
- `components/sidebar/EditableText.tsx` (exports `EditableText`)

All three were unmounted and unimported. This report is the evidence: for each file, the
repo-wide search command and its result, and the reason the only matches are not references.

---

## 1. Method

Searches ran over the whole working tree from the repo root, with build and dependency
directories excluded — `node_modules/`, `.next/`, `.git/`, `scratch/` and the generated
`tsconfig.tsbuildinfo` — because those cannot reach a component in the shipped bundle:

```
EX="--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=scratch \
    --exclude=*.tsbuildinfo --exclude=package-lock.json --exclude=pnpm-lock.yaml"
```

Coverage was deliberately wider than a bare import string: static `from "…"` imports in both
spellings (`@/components/…` and relative), dynamic `import(…)`, `next/dynamic`, barrel files,
tests, `scripts/`, `debug_reports/`, Markdown, and the config surfaces that could name a path
(tsconfig `paths`, Tailwind `@source` globs).

---

## 2. Per-file evidence

### 2.1 `components/session-history-panel.tsx`

```
$ grep -rniI $EX "session-history-panel\|sessionhistorypanel" .
./components/session-history-panel.tsx:14:interface SessionHistoryPanelProps {
./components/session-history-panel.tsx:18:export function SessionHistoryPanel({ sessions }: SessionHistoryPanelProps) {
./debug_reports/DEBUG_components_session-history-panel.md:1:# Audit Report: session-history-panel.tsx
./debug_reports/DEBUG_components_session-history-panel.md:3:Path: `D:\Work\Neuvo\ALICE\Source\components\session-history-panel.tsx`
./debug_reports/DEBUG_components_session-history-panel.md:5:### Analysis of `session-history-panel.tsx`
./debug_reports/DEBUG_components_session-history-panel.md:101:interface SessionHistoryPanelProps {
./debug_reports/DEBUG_components_session-history-panel.md:105:export function SessionHistoryPanel({ sessions }: SessionHistoryPanelProps) {
./debug_reports/_SIGNAL.txt:1350-1383 (generated aggregate log, quoted fragments of the report above)
./documentation.md:99,904,1183,1191 (the four documentation mentions — all updated, see §4)
```

**Zero importers.** Every match is either the file's own definition, its own audit report, the
generated `_SIGNAL.txt` log that aggregates that report, or `documentation.md`. No file under
`app/`, `components/`, `lib/`, `hooks/`, `stores/`, `types/`, `tests/` or `scripts/` names it.

### 2.2 `components/sidebar/EditableText.tsx`

```
$ grep -rniI $EX "editabletext" .
./components/sidebar/EditableText.tsx:5:export function EditableText({
./debug_reports/DEBUG_components_sidebar_EditableText.md:1,3,5 (its own audit report)
./debug_reports/_SIGNAL.txt:1582-1648 (generated aggregate log)
./documentation.md:1191 (updated)
```

**Zero importers.** The live rename component is `components/sidebar/EditableName.tsx`, which is
what `ClientNode.tsx`, `CaseNode.tsx` and `SessionNode.tsx` import (`import EditableName from
"./EditableName"`). `EditableText` was an earlier draft of the same idea and nothing points at it.

Incidental: the file also ends with a stray ``` ``` ``` fence on its last line (`:50`), i.e. it was
not parseable as-is. It never broke the build because Turbopack only compiles files reachable from
an entry point — independent confirmation that nothing imported it.

### 2.3 `components/sidebar/Sidebar.tsx`

```
$ grep -rniI $EX "components/sidebar" .
./components/dashboard-sidebar.tsx:11:import { ClientNode } from "@/components/sidebar/ClientNode";
./documentation.md:99,272,282,1191 (all updated)
```

```
$ grep -rnIiE "from ['\"][^'\"]*(sidebar|\./Sidebar|\.\./Sidebar)['\"]|import\(['\"][^'\"]*(Sidebar|Editable|session-history)[^'\"]*['\"]" .
./components/dashboard-shell.tsx:3:import { DashboardSidebar } from "@/components/dashboard-sidebar";
./components/sidebar/Sidebar.tsx:8:} from '@/components/ui/sidebar'
```

**Zero importers of `components/sidebar/Sidebar.tsx`.** The only `components/sidebar/*` consumer
is `components/dashboard-sidebar.tsx`, which imports `ClientNode` — not `Sidebar`. The second hit
is `sidebar/Sidebar.tsx` importing the shadcn primitive `@/components/ui/sidebar` (the other
direction). The live sidebar is `components/dashboard-sidebar.tsx` (`DashboardSidebar`), hosted by
`components/dashboard-shell.tsx`.

### 2.4 Dynamic imports, barrels and config

```
$ grep -rnE "import\(|dynamic\(" --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.js" $EX .
./components/main-content.tsx:22:const VignetteGenerator = dynamic(() => import("./vignette-generator"), {
./components/vignette-generator.tsx:256:      const { downloadPracticePackagePdf } = await import("@/lib/export-practice-pdf")
./next.config.mjs:1:/** @type {import('next').NextConfig} */
./postcss.config.mjs:1:/** @type {import('postcss-load-config').Config} */
./tests/worker.test.mjs:112:const worker = (await import(pathToFileURL(workerFile).href)).default
```

No dynamic entry point targets any of the three files.

Barrels (`find components app lib -maxdepth 2 -iname "index.*"`) are `components/tasks/index.ts`
and `components/canvas/index.ts`; neither re-exports them, and `components/sidebar/` has no
`index.ts` at all.

Config surfaces: `tsconfig.json` `paths` maps only the `@/*` alias (`"@/*": ["./*"]`) and lists no
file names. There is no `tailwind.config.*` — Tailwind v4 is configured in `app/globals.css`, whose
globs are directory-wide:

```
$ grep -n "@source\|@import\|content" app/globals.css
1:@import 'tailwindcss' source(none);
2:@source '../app';
3:@source '../components';
4:@source '../lib';
5:@source '../hooks';
6:@source '../stores';
```

A glob cannot reference a file that no longer exists, so no config edit is needed.

### 2.5 Markdown that names them

```
$ grep -rlnI --include="*.md" $EX -e "session-history-panel" -e "SessionHistoryPanel" \
      -e "EditableText" -e "sidebar/Sidebar" -e "sidebar\\Sidebar" -e "Sidebar\.tsx" .
./debug_reports/DEBUG_components_session-history-panel.md
./debug_reports/DEBUG_components_sidebar_EditableText.md
./debug_reports/DEBUG_components_sidebar_Sidebar.md
./documentation.md
```

Four files, all handled in this commit (§4). Nothing under `.memory-bank/`, `.github/`, `scripts/`
or `workers/` names any of the three.

---

## 3. Verdicts

| File | Verdict | Decision |
| --- | --- | --- |
| `components/session-history-panel.tsx` | unreferenced | deleted |
| `components/sidebar/Sidebar.tsx` | unreferenced | deleted |
| `components/sidebar/EditableText.tsx` | unreferenced | deleted |

No file was found reachable. Nothing was left in place for the reason of being in use.

---

## 4. Documentation updated in the same commit

`documentation.md` — every one of the four mentions removed or rewritten:

| Site | Change |
| --- | --- |
| §2 repository map, `components/` row | `session-history-panel` dropped from the component list |
| §4.4, closing sentence of the sidebar paragraph | `components/sidebar/Sidebar.tsx` dropped from the "unused alternates" sentence; `clinical-folder-tree.tsx` kept |
| §8.5, "Notable component details" | the three-line `components/session-history-panel.tsx` bullet deleted |
| §13.2, "Correctness bugs to fix" | the `session-history-panel.tsx` row deleted (the bug is moot once the file is gone) |
| §13.3, "Unused components" | rewritten: records the deletion and this report; keeps `clinical-folder-tree.tsx` and the duplicate `use-toast` flagged |

The three audit reports under `debug_reports/` are retained as point-in-time records; each now
opens with a `FILE DELETED 2026-10-10` note pointing back at §13.3, so no dangling path is left
unqualified. (`git diff` on those three is additive only — the existing heading is untouched.)

`debug_reports/_SIGNAL.txt` is a generated aggregate log, not Markdown, and still contains the old
path strings inside quoted fragments. It is deliberately left alone.

---

## 5. Gates

| Gate | Before (HEAD `9973551`) | After | Result |
| --- | --- | --- | --- |
| `npx tsc --noEmit` | exit 0 | exit 0 | unchanged |
| `npm test` | 35/35 + 12/12 + 15/15 = 62 | 35/35 + 12/12 + 15/15 = 62 | unchanged |
| `npm run build` | success | success | — |
| Route list (`Route (app)` block) | 13 routes | 13 routes | `diff` exit 0 — byte-identical |
| `npm run docs:check` | — | `docs:check — ok (documentation.md moved with 3 path(s)).` exit 0 | pass |

The route list, captured from the production build's output before and after the deletion:

```
○ /                 ○ /_not-found             ƒ /api/analyze/session
ƒ /cases/[caseId]/sessions/[sessionId]        ○ /client-login
○ /dashboard        ○ /forgot-password        ƒ /homework/[sessionId]
○ /login            ƒ /practice/[sessionId]   ƒ /practitioner/tasks/[id]/review
○ /signup           ○ /test-auth
```

13 before, 13 after, same paths and same static/dynamic kind (`diff` exit 0).

`next-env.d.ts` was flipped by `next build` (`.next/dev/types/routes.d.ts` ↔
`.next/types/routes.d.ts`) and restored to its committed state before staging; the build artefacts
under `.next/` and the `tsconfig.tsbuildinfo` regenerated by the type-check are untracked/ignored.

---

## 6. Found dead, NOT deleted in this change (flagged only)

Out of scope for this card; listed so the operator can decide, not deleted:

| Path | Why it looks dead | Verified |
| --- | --- | --- |
| `components/clinical-folder-tree.tsx` | unreferenced; a truncated stub whose client list renders an empty `<Collapsible>` and whose body is a `{/* ... rest of your code ... */}` placeholder; imports the unused `lib/clinical-hierarchy.ts`. Already flagged in `documentation.md` §13.2/§13.3 | `grep -rnI "clinical-folder-tree"` — no importer |
| `components/ui/use-toast.ts` | duplicate of the live `hooks/use-toast.ts`; the two differ, and the app imports the `hooks/` one everywhere (`app/dashboard/page.tsx`, `components/ui/toaster.tsx`) | `grep -rnI "components/ui/use-toast"` — matches only prose in `documentation.md` |
| `components/ui/use-mobile.tsx` | duplicate of `hooks/use-mobile.ts`, which is the one `components/ui/sidebar.tsx` imports | `grep -rnI "ui/use-mobile"` — matches only a debug report |
| `components/ui/sonner.tsx` | exports a second `Toaster`; no call site uses `sonner` (the only `sonner` references are `package.json`, the lockfiles and the component itself). Deliberately left unmounted by card 1 | `grep -rnI "sonner"` |
| `styles/globals.css` | duplicate of the canonical Tailwind theme in `app/globals.css`; nothing imports it | `grep -rnI "styles/globals"` — prose only |
| `patch-cloudflare.js`, `patch-tasks.js`, `patch-vignette.js` (repo root) | one-shot source-patching scripts; nothing in the repo references them | `grep -rnI "patch-cloudflare\|patch-tasks\|patch-vignette"` — no matches (exit 1) |
| `scripts/dispatch-inbox.ps1.bak-20261001-161325` | editor backup of `scripts/dispatch-inbox.ps1` | present in `scripts/`, not referenced |
| `README.md` | zero bytes; already listed in `documentation.md` §13.3 | `git ls-files` shows it tracked |

---

## 7. Freeze state (NO PUSH)

No `git push`, no PR. Local commit on `alan` only, on top of card 1's `9973551`.
`git ls-remote --heads origin alan` must still read `c6021602881baf5c69137579a4ac58ece7717966`.
