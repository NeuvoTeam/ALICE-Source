# Unreferenced Files Archive

**These files are not live code.** Nothing in `app/`, `components/`, `hooks/`, `lib/`, `stores/` or `workers/` imports them; they are archived references, not shipping components, and the live paths `components/ui/skeleton.tsx`, `components/ui/tooltip.tsx`, `hooks/use-mobile.ts` and `hooks/use-clinical-workspace.ts` no longer exist in the tree.

## Why archived and not deleted

**"Archive so if it's required we don't need to rebuild."**

## What is here

| Archived path (relative to the repo root) | What it is | Unreferenced because | Last modified in | Last live commit | Bytes / lines / encoding | Git blob | SHA-256 | Restore command |
|---|---|---|---|---|---|---|---|---|
| `archive/2026-10-10-unreferenced-ui-kit/components/ui/skeleton.tsx` | The shadcn/ui Skeleton primitive — a single `Skeleton` `<div>` with `data-slot="skeleton"` and `className={cn('bg-accent animate-pulse rounded-md', className)}` | Its only importer was `components/ui/sidebar.tsx:20`; that file was deleted in `7341097` (register row B4) | `e8dcb55077e9f8ee9405ad8e063c3189406d3756` ("initial v0 import") | `1c3cb44` — unchanged since `e8dcb55`, so `1c3cb44` holds these exact bytes | 276 bytes, 13 lines, ASCII, LF | `e3beb90241eeeca34da099f60f96e6d40411af00` | `c3005a6a39bd1aaecf3c0c9c61860db480ec5cbd16381556e381bdc3a59b6ac6` | `git checkout 1c3cb44 -- components/ui/skeleton.tsx` |
| `archive/2026-10-10-unreferenced-ui-kit/components/ui/tooltip.tsx` | The shadcn/ui Tooltip primitives over `@radix-ui/react-tooltip` — `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent` (`'use client'`, `data-slot` attributes, portal and arrow markup) | Its only importer was `components/ui/sidebar.tsx:26`; deleted in `7341097` (register row B4) | `cb3ac3a7d3fcfbbc4acc6090f1951b01a6f44978` ("refactor(ui): unify the corner-radius scale and record it") | `1c3cb44` — unchanged since `cb3ac3a`, so `1c3cb44` holds these exact bytes | 1890 bytes, 61 lines, ASCII (one 430-character line), LF | `ae092091c4d6b4dd2c352ee3756664859fc28d3b` | `b4182f90c2f9b02150e208d19e548dd909ca72f049a13c62ed0cd657a4358f70` | `git checkout 1c3cb44 -- components/ui/tooltip.tsx` |
| `archive/2026-10-10-unreferenced-ui-kit/hooks/use-mobile.ts` | `useIsMobile()` — a `useSyncExternalStore` subscription to a `(max-width: 767px)` media query whose snapshot is `window.innerWidth < 768`, with `getServerSnapshot()` returning `undefined` so the server render and the hydration render agree (lint rank 8g, register row B3) | Its only importer was `components/ui/sidebar.tsx:8` (used at `:69`); deleted in `7341097` (register row B4) | `bdc3923d138b8e670457bed6f92f4655352e53e4` ("refactor(lint): migrate the two matchMedia hooks…", rank 8g bucket 6c/6d) — modified **after** its importer was already gone | `1c3cb44` was the last commit it was live in, but `1c3cb44` holds the earlier 565-byte `useState` version — restore from `bdc3923` | 986 bytes, 28 lines, UTF-8 (the doc comment carries an em dash), LF | `1fb503cd3bd08707d6a71a5f6e5645ce9436e0c3` | `0e8081df6f8a8371fabd194dbafd4bcb6930d007d7b97840625225b77fb4b3c6` | `git checkout bdc3923 -- hooks/use-mobile.ts` |
| `archive/2026-10-10-unreferenced-ui-kit/hooks/use-clinical-workspace.ts` | `useClinicalWorkspace()` — the local-only client→case→session model built on `lib/clinical-hierarchy.ts` (the `mindcare-clinical-hierarchy-v1` localStorage record): `"use client"`, four `useState` selections, a `useEffect` persisting every hierarchy change, a `useLayoutEffect` guarded derived-default, the selection/persistence callbacks, the derived `sessionNotes` / `selectedSession` / `sessionContextKey` memos, and the exported `ClinicalWorkspace` type | It **never had an importer**: added in `b79c368` ("Save progress before switching machines") and never referenced by any commit on any branch — the live workspace model is `stores/useClientNavStore.ts` (§8.2). Lint register row B15 | `3ade9ba` ("refactor(lint): clear the drawer close and record three retained sites", rank 8g bucket 6a — the `DELIBERATELY RETAINED` comment), so the archived bytes are that commit's | never live as code: `300ec86` is the last commit in which the file existed at its live path | 8 129 bytes, 258 lines, UTF-8 (the B15 comment carries an em dash), LF in the blob — the pre-move working copy on disk was **CRLF**, 8 387 bytes | `63f91d0b8e3578ea02f92edb8303688bcd07d812` | `773ea3fbc31dcc19c9a313b6b3f2a775e918ec8341a9840677cdb791eecc7ca2` | `git checkout 300ec86 -- hooks/use-clinical-workspace.ts` |

Note on `hooks/use-mobile.ts`: it is the one file of the three whose restore source is not the shared `1c3cb44`. Rank 8g's bucket 6c/6d migrated it to `useSyncExternalStore` while it was live-but-already-unreferenced, so the archived 986 bytes come from `bdc3923` (or `f766e92`, byte-identical to it); the 565-byte `useState` version is what `1c3cb44` holds at that path and is **not** the archived content.

Note on `hooks/use-clinical-workspace.ts`: it is the one file of the four that was never live at all —
`git log -S` over `hooks/use-clinical-workspace` and `useClinicalWorkspace` on every branch lists only
`b79c368`, the commit that added it, so no commit has ever imported it. `300ec86` is therefore the
restore source, not a "last live commit": it is simply the last commit that carried the file at
`hooks/use-clinical-workspace.ts`, and its blob (`63f91d0b`) is identical to the archived bytes.

## How to restore one

Each file's exact command is in the table above. `git checkout <commit> -- <path>` restores both the working-tree file and the index entry, so a restore shows up as a staged change.

- `git checkout 1c3cb44 -- components/ui/skeleton.tsx`
- `git checkout 1c3cb44 -- components/ui/tooltip.tsx`
- `git checkout bdc3923 -- hooks/use-mobile.ts`
- `git checkout 300ec86 -- hooks/use-clinical-workspace.ts`

**Warning for `hooks/use-mobile.ts`:** `1c3cb44` holds an earlier 565-byte `useState` version of the same path. The correct restore source is `bdc3923` (or `f766e92`, which is byte-identical to it).

Each spec was verified to resolve — `git cat-file -e 1c3cb44:components/ui/skeleton.tsx`,
`git cat-file -e 1c3cb44:components/ui/tooltip.tsx`, `git cat-file -e bdc3923:hooks/use-mobile.ts` and
`git cat-file -e 300ec86:hooks/use-clinical-workspace.ts` all exit 0 — and each command was run and
undone to check what it actually writes.

**Line endings — measured, and a trap if you skip it.** This clone has `core.autocrlf=true`, and
`.gitattributes` carries no rule for these paths (its only rule is `.githooks/* text eol=lf`), so
`git checkout` **smudges** the file on the way out: it writes CRLF where the archived copy has LF,
adding one byte per line. Measured on `components/ui/skeleton.tsx`: the checkout form is **289 bytes**,
SHA-256 `68bf11609c04a24c046838df50485a010c92186134a1038ba0ec77af843ee6fb`, against the archived
**276 bytes**, SHA-256 `c3005a6a…` (tooltip 1951 vs 1890; use-mobile 1014 vs 986; use-clinical-workspace 8 387 vs 8 129 — the same
+1 byte per line). The *content* is right, and the next `git add` clean filter turns it back into the archived
blob, but the file on disk is **not** byte-identical to the archive. For a byte-exact restore, read the
blob instead:

- `git cat-file blob 1c3cb44:components/ui/skeleton.tsx > components/ui/skeleton.tsx`
- `git cat-file blob 1c3cb44:components/ui/tooltip.tsx > components/ui/tooltip.tsx`
- `git cat-file blob bdc3923:hooks/use-mobile.ts > hooks/use-mobile.ts`
- `git cat-file blob 300ec86:hooks/use-clinical-workspace.ts > hooks/use-clinical-workspace.ts`

`git cat-file blob <commit>:<path>` and `git show <commit>:<path>` both emit the raw blob, and both were
measured byte-identical to the archived copies (same sizes and same SHA-256 values as the table).

## Orphaned dependency

`embla-carousel-react` (pinned `8.6.0`) in `package.json` lost its only importer when `components/ui/carousel.tsx` was deleted in `7341097`. A repo-wide search for `embla` across every `.ts`/`.tsx`/`.js`/`.mjs` file outside `node_modules`, `.next`, `debug_reports` and `scratch` returns only `package.json:51`. It was not removed: dependency and lockfile changes are the operator's call, and card 4's lockfile ambiguity (`pnpm-lock.yaml`) is still open.

## How the archive is kept inert

- `tsconfig.json` `exclude` contains `archive`
- `eslint.config.mjs` `globalIgnores` contains `archive/**`
- Tailwind's `@source` globs in `app/globals.css` are `../app`, `../components`, `../lib`, `../hooks`, `../stores` under `source(none)` and therefore do not cover `archive/`

These three are the reason the archive is neither compiled, nor linted, nor scanned for CSS — and the
inertness was measured behaviourally, not assumed: the utilities that occur **only** in the archived
files are **absent** from the built production stylesheet (see below).

## Measured evidence

Taken on the committed tree, rank 8j, card `t_09ae9f3d` — one commit on `alan`.

**Byte-identity of each archived copy.** `sha256sum` of the archived file against
`git show <commit>:<path> | sha256sum`, plus the byte counts — identical for all three:

| Path | Archive bytes | `git show` bytes | Archive SHA-256 | Index rename |
|---|---|---|---|---|
| `components/ui/skeleton.tsx` | 276 | 276 | `c3005a6a…` | 100% |
| `components/ui/tooltip.tsx` | 1890 | 1890 | `b4182f90…` | 100% |
| `hooks/use-mobile.ts` | 986 | 986 | `0e8081df…` | 100% |

The index blob hashes after the move are unchanged from the pre-move working files
(`git ls-files -s`: `e3beb902…`, `ae092091…`, `1fb503cd…`), the pre-move on-disk sizes recorded before
the move were 276 / 1890 / 986 bytes with LF line endings and no BOM, and
`git diff --cached --summary -M` reports a **100%** rename for each.

**Nothing tooling-visible moved — except the six now-dead rules those files left in the stylesheet.**
`eslint .` (counted with `-f json`) goes **120 → 117** files, with the finding totals unchanged at
**0 errors / 4 warnings** in the same three files (`components/tasks/DynamicTaskForm.tsx` ×2,
`components/vignette-generator.tsx` ×1, `hooks/use-clinical-workspace.ts` ×1); the diff between the two
linted-file lists is **exactly three removals and zero additions** — the three archived paths.
`npx tsc --noEmit` exits **0** (the archived files are excluded, so they are not type-checked).
`npm run build` exits **0** with a byte-identical 13-route list (md5
`bab5456e751481302dfcd14942ada88c`, empty diff). `npm test` is **62/62** — 35 worker + 12 PDF + 15
hydration, the fifteen hydration checks named in the raw log.

The emitted production stylesheet measures **143 136 → 142 650 bytes** (font chunk
`037.tcc7jhmtv.css` identical at 3 628 bytes; app chunk 139 508 → 139 022). The −486 bytes are
**exactly six individual selectors, with none added**: `.animate-pulse` (skeleton.tsx's only
occurrence) and `.fade-in-0`, `.fill-foreground`, `.origin-(--radix-tooltip-content-transform-origin)`,
`.translate-y-[calc(-50%_-_2px)]`, `.zoom-in-95` (tooltip.tsx's only occurrences). They left because the
archived files are no longer inside a Tailwind scan root — which is also the proof that `archive/` is
**not** scanned: if it were, those utilities would still be emitted. A token-by-token cross-check of all
**3 470** distinct class candidates found in the 5 365 string literals of the 117 live source files
found **0** candidates whose rule existed before and is missing after, so no live file lost a rule it
depends on. (Rank 8d measured the same phenomenon at a larger scale — deleting the two kit files cost
10 806 bytes of then-dead CSS — so this delta continues that, rather than being a new class of change.)

**No live reference.** `grep -rn -E "components/ui/skeleton|components/ui/tooltip|hooks/use-mobile|useIsMobile"`
over `app components hooks lib stores types workers backend tests scripts` (every `.ts`/`.tsx`/`.js`/`.mjs`)
returns **no match**; `components/ui/` no longer lists `skeleton.tsx` or `tooltip.tsx`, and `hooks/` no
longer lists `use-mobile.ts`.


### Rank 8l (2026-10-10, card `t_b32676c6`) — the hook joins the set

**Byte-identity and the rename proof.** The fourth file moved with `git mv`, so
`git diff --cached --summary -M` reports
`rename {hooks => archive/2026-10-10-unreferenced-ui-kit/hooks}/use-clinical-workspace.ts (100%)`, and
the index blob is unchanged at `63f91d0b8e3578ea02f92edb8303688bcd07d812` — the same object
`3ade9ba` and `300ec86` carry at the live path. The archived copy measures **8 129 bytes**,
SHA-256 `773ea3fbc31dcc19c9a313b6b3f2a775e918ec8341a9840677cdb791eecc7ca2`, and
`hooks/use-clinical-workspace.ts` no longer exists in the tree.

**No importer — the per-pattern sweep.** The basename and the exported symbol were searched
case-insensitively across the tree, together with the static `@/hooks/…` and relative import forms,
`require()`, dynamic `import()` / `next/dynamic`, the repo's four barrels
(`components/canvas/index.ts`, `components/tasks/index.ts`, `types/index.ts`,
`workers/mcp-gateway/src/index.ts` — none reaches `hooks/`), `tests/`, `scripts/`, `workers/`,
`tsconfig.json`, `components.json`, `eslint.config.mjs`, `next.config.mjs`,
`postcss.config.mjs`, `package.json`, the Tailwind `@source` globs and every Markdown file. The
only hits anywhere are `AGENTS.md:35`, this document's own prose in `documentation.md`, the stale
`eslint.config.mjs` comment corrected in the same commit, and the file itself. `AGENTS.md:35` still
names the old path and was **not** edited: it is an immutable path in this workspace's contract.
Raw output: `debug_reports/proof_8l_references_20261010.txt` and `proof_8l_b34_20261010.txt`.

**Inert, re-proved — and what that proof can and cannot show.** `eslint .` (counted with `-f json`)
goes **117 → 116** matched files, 0 errors and **4 → 3 warnings**: the removed finding is exactly
`hooks/use-clinical-workspace.ts:40` and the three survivors are unchanged at
`components/tasks/DynamicTaskForm.tsx:404`, `:529` and `components/vignette-generator.tsx:177` —
nothing relocated — with the linted-file list differing by exactly one removal and zero additions. The
emitted production stylesheet is **byte-identical**: the font chunk `037.tcc7jhmtv.css` (3 628 bytes,
`9b022645…`) and the app chunk `0vlgq2asp-14v.css` (139 022 bytes, `32032bb3…`) carry the same
SHA-256 before and after, 142 650 bytes in total on both sides, with 1 289 individual selectors and
**0 removed / 0 added**. That is the expected result rather than a weak one: a hook with no JSX and no
class strings contributes no utility to the stylesheet, so unlike rank 8j there is no CSS delta to
read — and the load-bearing check is the cross-check. Of the **3 472** distinct class candidates found
in the 5 352 string literals of the 116 live source files, **0** had a rule before and are missing
after, so no live file lost a rule it needs (`debug_reports/cssdiff_8l_20261010.txt`). The route list
is byte-identical (13 routes, md5 `bab5456e751481302dfcd14942ada88c`, empty diff), `npx tsc --noEmit`
exits 0, `npm test` is 62/62 (35 worker + 12 PDF + 15 hydration, all fifteen hydration checks named)
and `npm run build` exits 0.

**What archiving the hook leaves behind.** `lib/clinical-hierarchy.ts` and
`lib/vignette-restore.ts` are now an unreachable pair: with the hook gone, `clinical-hierarchy.ts`'s
only remaining importer is `vignette-restore.ts`, which itself has none. Both are **still live
paths**; neither was moved, and the pair is recorded in `documentation.md` §13.3 rather than actioned
here.

**Restore.** `git checkout 300ec86 -- hooks/use-clinical-workspace.ts` resolves
(`git cat-file -e 300ec86:hooks/use-clinical-workspace.ts` exits 0) and writes the smudged CRLF form —
**8 387 bytes**, SHA-256 `9710c1f85d758c41a0c092799f71835707c15ee50070c0a96767616ce13bb361`, measured
as identical to the pre-move working copy this clone had on disk. For the byte-exact copy, read the
blob: `git cat-file blob 300ec86:hooks/use-clinical-workspace.ts > hooks/use-clinical-workspace.ts`.
