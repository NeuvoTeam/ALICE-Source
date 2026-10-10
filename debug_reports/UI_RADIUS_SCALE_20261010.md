# Corner-radius scale — decision, application and evidence

Kanban `t_923af17e` (card 3 of 4; on top of card 2's `8272327`, branch `alan`,
**local commits only — nothing pushed**). Coding agent: Antigravity CLI (`agy`), model
`Gemini 3.1 Pro (High)` — **non-Claude**, per the operator constraint. Diff review, harness,
gates, `documentation.md` and the commit are the reviewer's.

Presentation only: no logic, props, behaviour, data flow, API, auth or RLS change; no file
renames; no new dependency. Every edit is a single Tailwind radius token on a single line —
`git diff` is 53 insertions / 53 deletions, all radius class strings.

## 1. The scale (decided first, then applied)

The ladder already exists in `app/globals.css` — `--radius: 0.75rem` with `--radius-sm/md/lg/xl`
derived from it — and Tailwind v4 still supplies `rounded-xs`, `rounded-2xl/3xl/4xl` and
`rounded-full`. The compiled stylesheet from `npm run build` confirms the arithmetic:

```
.rounded-mentioned values, from the emitted CSS:
  --radius: .75rem          .rounded-xs { border-radius: var(--radius-xs) }     --radius-xs: .125rem
  .rounded-md { border-radius: calc(var(--radius) - 2px) }                      -> 10px
  .rounded-sm { border-radius: calc(var(--radius) - 4px) }                      -> 8px
  .rounded-lg { border-radius: var(--radius) }                                  -> 12px
  .rounded-xl { border-radius: calc(var(--radius) + 4px) }                      -> 16px
  --radius-2xl: 1rem (== rounded-xl here)   --radius-3xl: 1.5rem   --radius-4xl: 2rem
  .rounded { border-radius: .25rem }        (the bare utility is 4px, NOT the themed rounded-sm)
```

| Token | Tailwind class | Computed here | Role |
| --- | --- | --- | --- |
| indicator | `rounded-xs` | 2px | checkboxes, chart swatches, tooltip arrows, resize handles, dialog/sheet close buttons |
| chip | `rounded-sm` | 8px | small inline badges, `<code>` chips, kbd |
| control | `rounded-md` | 10px | buttons, inputs, selects, textareas, icon buttons — the shadcn control default |
| panel | `rounded-lg` | 12px | containers nested inside a surface: inline callouts, table cells, inner rows |
| surface | `rounded-xl` | 16px | page-level cards and panels, modals, dropdown panels — the shadcn `Card` default |
| hero | `rounded-4xl` | 32px | the one decorative hero surface per view plus its immediate inner blocks |
| pill | `rounded-full` | — | pills, avatars, progress bars, switches, sliders, round icon buttons |

Deliberate exclusions, with reasons:

- **`rounded-2xl` is banned** because it computes to 1rem in this theme — the same pixels as
  `rounded-xl` (measured, §4: `rounded-2xl` → `16px`, `rounded-xl` → `16px`). Keeping both classes
  is a decision nobody can make from the rendered result.
- **`rounded-3xl` (24px) and the bare `rounded` (4px) are off-ladder** and are gone.
- **`rounded-[inherit]`** (`components/ui/scroll-area.tsx`) is inheritance, not a value, and has no
  utility equivalent — kept.
- **`rounded-[calc(var(--radius) - 5px)]`** (`components/ui/input-group.tsx`, 3 sites) is derived
  from the theme token, so it cannot drift out of the ladder — kept.
- **`components/ui/**` is left on the ladder it already uses** (md controls, lg panels/dialogs,
  xl cards, sm chips, xs indicators, full pills). It is the reference implementation of the table
  above; re-radiusing vendored primitives for taste is out of scope.
- **The legacy inline-styled auth screens** keep their `style` objects (§11.1: "match the
  surrounding file rather than converting styles mid-feature"), so only the *number* moved onto the
  ladder: `borderRadius: 24` → `16` (the `rounded-xl` value). Their `borderRadius: 10` sites were
  already the `rounded-md` value and are untouched.

## 2. What changed — 53 sites in 17 files

`git diff --stat` (full, at commit time): **17 files changed, 53 insertions(+), 53 deletions(-)**.

| File | Sites | Changes |
| --- | --- | --- |
| `components/vignette-generator.tsx` | 13 | hero card + composer + note + result card `[2.5rem]`/`[2rem]` → `rounded-4xl`; icon tile, inline blocks `2xl` → `xl`; CTA, select trigger and 4 buttons `xl` → `md` |
| `app/practitioner/tasks/[id]/review/page.tsx` | 8 | two dialogs `2xl` → `xl`; label input `lg` → `md`; two `<code>` chips bare `rounded` → `sm`; icon button bare `rounded` → `md`; native checkbox bare `rounded` → `xs`; media-overlay badge `lg` → `sm` |
| `components/tasks/ThreeCsForm.tsx` | 6 | step card `2xl` → `xl` (and its header `rounded-t-2xl` → `rounded-t-xl`); input, icon button, textarea, chip-button `lg` → `md` |
| `app/practice/[sessionId]/page.tsx` | 5 | error card `3xl` → `xl`; two hero cards `[2rem]` → `rounded-4xl`; empty state and homework row `2xl` → `xl` |
| `components/ui/checkbox.tsx` / `chart.tsx` / `tooltip.tsx` | 4 | `[4px]` → `xs`, `[2px]` ×3 → `xs` |
| `app/client-login/page.tsx` | 3 | two inputs and the submit button, bare `rounded` → `md` |
| `app/login/page.tsx`, `app/signup/page.tsx`, `app/forgot-password/page.tsx` | 3 | inline `borderRadius: 24` → `16` (card) |
| `components/tasks/TwoChoiceWorksheetForm.tsx` | 3 | prompt card `lg` → `xl`; two option buttons `lg` → `md` |
| `components/canvas/ReflectionCanvas.tsx` | 2 | node container and its toolbar `2xl` → `xl` |
| `components/tasks/DynamicTaskForm.tsx` | 2 | approval gate `2xl` → `xl`; native checkbox bare `rounded` → `xs` |
| `components/tasks/ActivityScheduleForm.tsx` | 2 | borderless cell textarea bare `rounded` → `md`; mobile input `lg` → `md` |
| `components/tasks/ReflectionField.tsx` | 1 | card `lg` → `xl` (matches the shadcn `Card` default) |
| `components/logout-button.tsx` | 1 | `lg` → `md` (it is a button) |
| **Total** | **53** | |

Split by effect on the rendered pixels:

- **19 sites are pixel-identical** (pure rule compliance): `rounded-[2rem]` → `rounded-4xl` (4),
  `rounded-2xl` → `rounded-xl` (12), `rounded-[2px]` → `rounded-xs` (3).
- **34 sites move by ≤ 8px**: `[2.5rem]` 40 → 32 (−8, 2 sites); `3xl` 24 → 16 (−8, 1);
  bare `rounded` 4 → 10/8/2 (+6 ×5, +4 ×2, −2 ×2); `[4px]` 4 → 2 (−2, 1);
  controls `lg`/`xl` → `md` (14 sites, 12→10 or 16→10); cards `lg` → `xl` (2, 12→16);
  badge `lg` → `sm` (1, 12→8); logout button `lg` → `md` (1); auth cards inline 24 → 16 (3).

Sites that keep a non-ladder-role radius, all listed above with their reason: none — the only
remaining arbitrary values are the two justified survivors in `components/ui/` (§1).

## 3. Acceptance criterion 1 — the raw grep

```
$ grep -rn "rounded-\[" app components
components/ui/input-group.tsx:39:  "… [&>kbd]:rounded-[calc(var(--radius)-5px)] …"
components/ui/input-group.tsx:86:        xs: "h-6 gap-1 px-2 rounded-[calc(var(--radius)-5px)] …"
components/ui/input-group.tsx:89:          'size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0',
components/ui/scroll-area.tsx:21:        className="… size-full rounded-[inherit] …"
```

Four lines, all justified in §1 (three theme-derived, one inheritance). Off-ladder residue checks,
both empty:

```
$ grep -rnE "rounded-2xl|rounded-3xl|rounded-t-2xl|rounded-b-2xl|rounded-l-2xl|rounded-r-2xl" app components
(no output)
$ grep -rnE "\brounded\b([^-A-Za-z]|$)" app components
(no output)
```

## 4. Acceptance criterion 2 — no visual regression (before/after, same harness)

Every screen sits behind `AuthGuard` + the live Worker, so the production shell was rendered in an
offline harness: the **real** `DashboardShell` + `MainContent` (which mounts the real
`VignetteGenerator`, i.e. the real modality dropdown) + the root-layout `<Toaster/>` and a button
that fires a real toast through `@/hooks/use-toast`, with `window.fetch` rejecting (no credential,
no Worker call, no patient data — Red Zone clean).

- Harness: `%LOCALAPPDATA%\hermes\profiles\kuro\cache\scratch\` — `radius-harness-entry.tsx`,
  bundled twice with the repo's own `esbuild`: `radius-before.js` + `radius-before.css` (the HEAD
  tree and its compiled Tailwind CSS) and `radius-after.js` + `radius-after.css` (the working tree).
  Served by `harness-server.mjs` on `127.0.0.1:8231`, driven over CDP with trusted mouse clicks.
- Measurements below are `JSON.stringify` of geometry (`getBoundingClientRect`) and computed
  `border-top-left-radius`, taken in the same states in both bundles.

```
1440×900 (125% zoom-free emulation, no mobile flag)
                              BEFORE                              AFTER
viewport          innerWidth 1440  clientWidth 1425              1440 / 1425        (identical)
document          scrollWidth 1425  elements 247                 1425 / 247         (identical)
aside             count 1  [256 × 900] @x=0                      count 1  same box  (identical)
main              [1169 × 951.5] @x=256                         same box           (identical)
notes textarea    [606 × 220] @x=537.5                          same box           (identical)
top bar           display:none                                   display:none       (identical)
generator hero    border-radius 40px  ("rounded-[2.5rem]")       32px ("rounded-4xl")
CTA button        16px  ("rounded-xl")                           10px ("rounded-md")
modality dropdown popper [606 × 130] @x=538, radius 10px, 3 checkboxes   same box/radius/3  (identical)
toast             li[data-state] [388 × 94] @x=1021, radius 10px  same box/radius    (identical)

390×844
                              BEFORE                              AFTER
viewport          innerWidth 390  clientWidth 375  scrollWidth 375    same             (identical)
aside             count 0 (closed)                               count 0            (identical)
main              [375 × 1012] @x=0                              same box           (identical)
notes textarea    [301 × 220]                                    same box           (identical)
top bar           display:flex, trigger aria-expanded="false"     same               (identical)
elements          91                                             91                 (identical)
drawer open       [role=dialog] 1, one <aside> 256px inside it,  same: dialog 1, aside 256 inside,
                  trigger aria-expanded="true", body lock        aria-expanded="true", body lock
                  elements 258                                  elements 258
generator hero    40px                                          32px
```

Read plainly: **no geometry moved anywhere** — same viewport, same document scroll width (no
clipping, no reflow, no overflow), same element counts, same boxes at both widths, and the drawer,
the modality dropdown and the Toaster behave and measure exactly as before. The only differences are
computed radii, which is the point of the change (`border-radius` is paint-only, and the numbers
show it: nothing but the radius fields changed).

Screenshots committed to `debug_reports/`:

| File | What it shows |
| --- | --- |
| `ui_radius_shell_1440_before.png` / `ui_radius_shell_1440_after.png` | dashboard shell at 1440px: 256px sidebar, generator hero, composer textarea, modality trigger |
| `ui_radius_shell_390_before.png` / `ui_radius_shell_390_after.png` | the same shell at 390px (top bar + no sidebar, document width 375 = client width) |
| `ui_radius_drawer_390_before.png` / `ui_radius_drawer_390_after.png` | the mobile drawer open at 390px (trusted click on the trigger) |
| `ui_radius_modality_dropdown_1440_after.png` | the modality dropdown open at 1440px: panel radius 10px unchanged, three checkbox rows (CBT/ACT/DBT), no clipping |
| `ui_radius_toast_1440_after.png` | the root-layout Toaster rendering a real toast; toast radius 10px, unchanged |

## 5. Acceptance criterion 3 — gates (raw)

```
### 1. npx tsc --noEmit
tsc exit=0
### 2. npm test
35/35 checks passed
12/12 checks passed
15/15 checks passed
test exit=0
### 3. npm run build
✓ Compiled successfully in 4.0s
Route (app)  … 13 routes (○ /, ○ /_not-found, ƒ /api/analyze/session, ƒ /cases/[caseId]/sessions/[sessionId],
○ /client-login, ○ /dashboard, ○ /forgot-password, ƒ /homework/[sessionId], ○ /login,
ƒ /practice/[sessionId], ƒ /practitioner/tasks/[id]/review, ○ /signup, ○ /test-auth)
build exit=0
```

Full log: `%LOCALAPPDATA%\hermes\profiles\kuro\cache\scratch\gates-radius.log`. The new utility is in
the shipped CSS: `.rounded-4xl{border-radius:var(--radius-4xl)}` with `--radius-4xl:2rem`, and
`.rounded-2xl` / `.rounded-3xl` / the bare `.rounded` no longer appear in the DOM (§4).

## 6. Freeze, hygiene and residual risk

- `git ls-remote --heads origin alan` → `c6021602881baf5c69137579a4ac58ece7717966`, unchanged from
  dispatch. No `git push`, no PR.
- `next build` rewrites `next-env.d.ts` (`./.next/dev/types` ↔ `./.next/types`); that churn was
  reverted with `git checkout -- next-env.d.ts` and is not in the commit. `git status --porcelain`
  after the commit shows only the pre-existing untracked `scratch/`.
- Residual risk: this change was **not** re-verified against a live authenticated dashboard (behind
  `AuthGuard`) or the live Worker; §4 measures the same components offline. `rounded-4xl` is used
  here for the first time, so the hero's 32px corner is a new paint — it is Tailwind's own value and
  is verified as emitted and computed in §4, but it has not been reviewed on a clinician's screen.
