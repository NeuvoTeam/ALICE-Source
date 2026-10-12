# The destructive foreground token — measured, fixed, legible in both themes (card 5)

Kanban `t_7e8880de` (card 5 of 5; on top of card 4's `9dcba1f`, branch `alan`, **local commits only —
nothing pushed**). Coding agent: Antigravity CLI (`agy` 1.3.3, model **`Gemini 3.1 Pro (High)`** —
**non-Claude**, per the operator constraint; prompt `debug_reports/agy-prompt-card5.md`, raw run
`debug_reports/agy_card5_run_20261010.log`). Harness, measurements, `documentation.md` and the commit
are the reviewer's. Harness scratch: `%LOCALAPPDATA%\hermes\profiles\kuro\cache\scratch\`.

## 1. What changed — three lines, two files

```diff
 app/globals.css   @@ :root @@
   --destructive: oklch(0.577 0.245 27.325);
-  --destructive-foreground: oklch(0.577 0.245 27.325);
+  --destructive-foreground: oklch(1 0 0); /* = the components' text-white: 4.76:1 on --destructive */

 app/globals.css   @@ .dark @@
   --destructive: oklch(0.396 0.141 25.723);
-  --destructive-foreground: oklch(0.637 0.237 25.331);
+  --destructive-foreground: oklch(1 0 0); /* = the components' text-white: 10.06:1 on --destructive */

 components/ui/toast.tsx   (ToastDescription)
-    className={cn('text-sm opacity-90', className)}
+    className={cn('text-sm opacity-90 group-[.destructive]:opacity-100', className)}
```

`git diff --stat` at commit time: **2 files changed, 3 insertions(+), 3 deletions(-)**. The two
`--destructive` declarations are untouched, as are all ~20 `text-destructive`-on-light sites.

## 2. The rule applied

**`--destructive-foreground` = the foreground that is readable on `--destructive`, and the codebase
already names it: the literal `text-white` of the destructive `Button` and destructive `Badge`.** Those
two call sites (`components/ui/button.tsx:14`, `components/ui/badge.tsx:17`) do not use the token, so
the token was the odd one out; `oklch(1 0 0)` is exactly the `#ffffff` they paint, and it measures
**4.76:1** on the light `--destructive` and **10.06:1** on the dark one — i.e. matching the existing
convention is also the highest-contrast choice available (see §4: nothing on `#e7000b` beats white).

The card's suggested resolution therefore holds for the token, and measurement then showed it is *not
sufficient on its own*: `ToastDescription` carries `opacity-90`, which composites the description text
against the toast background and capped it at **4.00:1** (§3). That is the one component edit, scoped
to the destructive group so every non-destructive toast is bit-identical to before.

## 3. How it was measured

Same method as card 1, re-run end to end on the new tree:

- **Real build, real server, temporary public route.** `app/toast-probe/page.tsx` (a client page whose
  button calls `toast({ title: "Probe title", description: "Probe description", variant:
  "destructive" })` through the app's own `@/hooks/use-toast`, plus two token probes) was compiled into
  the build and served by `next start`. It mounts no `Toaster` of its own, so anything that renders
  comes from the root layout. The route was moved out of the tree before the commit and rebuilt out:
  `GET /toast-probe` → **404** on the shipped build and `toast-probe` is **absent from `.next/static`**.
- **Driver.** Edge `154.0.4258.62` headless (`--headless=new`) over **raw CDP** — Node 26's global
  `WebSocket`, no extra dependency. 1440×900 at `deviceScaleFactor: 1`. The click is a **trusted**
  `Input.dispatchMouseEvent` pair (React ignores synthetic `.click()` for Radix's toast); hydration was
  confirmed first (the button carries `__reactProps`).
- **Console recorder** installed with `Page.addScriptToEvaluateOnNewDocument`, so it wraps
  `console.error`/`console.warn` and `window.onerror` before any page script. Every run's log is
  `["__control__"]` — the self-test entry only: **no hydration or runtime error** in any of the five runs.
- **Theme.** The app's dark rules are class-based (`@custom-variant dark (&:is(.dark *))`) and no
  `ThemeProvider` is mounted in `app/layout.tsx`, so `.dark` is added to `<html>` via `Runtime.evaluate`.
- **Two independent measurements per state.**
  1. *Computed styles*: `getComputedStyle` on `<html>` for the tokens, and on the toast `li`, its title
     (`div.text-sm.font-semibold`) and its description (`div.text-sm.opacity-90`) for `color`/`opacity`.
  2. *Rendered pixels*: the captured PNG is decoded **in the page** (canvas + `getImageData`) and each
     rectangle is sampled — the modal colour is the background, the brightest pixel is the text core —
     and the WCAG ratio is computed from those two pixels in-page. This is what makes "legible" a
     measurement rather than an opinion.
- Post-click wait 900 ms (Radix slide-in settles); toast counts at rest: 1 region, 1 viewport, 1 toast.

The compositing model behind §3's finding is validated by measurement, not assumed: in the dark
"before" run the description's brightest rendered pixel is **`#ef2a33`**, which is exactly
`0.9 × #fb2c36 + 0.1 × #82181a` — CSS `opacity` composites in sRGB against the toast's own background.

## 4. Evidence — before / after, both themes

Computed colours are what `getComputedStyle` returns (Chrome serialises the theme's oklch as `lab()`);
ratios are WCAG 2.x relative-luminance ratios, computed from the values and confirmed on the rendered
pixels of the committed screenshots.

| Theme | State | Token `--destructive-foreground` | oklch | Computed `color` of title / description`*` | Toast `backgroundColor` (computed / pixel) | Ratio title | Ratio description |
| --- | --- | --- | --- | --- | --- | --- | --- |
| light | before | `oklch(0.577 0.245 27.325)` | same as `--destructive` | `lab(48.4493 77.4328 61.5452)` | `lab(48.4493 77.4328 61.5452)` / `#e7000b` | **1.00:1** | **1.00:1** |
| light | token only | `oklch(1 0 0)` | `#ffffff` | `lab(100 0 0)` | same / `#e7000b` | **4.77:1** ✅ | **4.00:1** ❌ |
| light | **final** | `oklch(1 0 0)` | `#ffffff` | `lab(100 0 0)`, description `opacity: 1` | same / `#e7000b` | **4.77:1** ✅ | **4.77:1** ✅ |
| dark | before | `oklch(0.637 0.237 25.331)` | `#fb2c36` | `lab(55.4814 75.0732 48.8528)` | `lab(28.5139 44.5539 29.0463)` / `#82181a` | **2.63:1** ❌ | **2.41:1** ❌ |
| dark | **final** | `oklch(1 0 0)` | `#ffffff` | `lab(100 0 0)`, description `opacity: 1` | same / `#82181a` | **10.03:1** ✅ | **10.03:1** ✅ |

`*` The description is `text-sm opacity-90` before the fix and `opacity: 1` after, which is why the
"token only" row is where it is: white on `#e7000b` is 4.76:1, but at `opacity-90` the *rendered* text
is `#fce6e7` and the ratio falls to 4.00:1.

Token-level ratios, computed directly from the oklch values (the arithmetic behind the pixel numbers):

```
light  --destructive oklch(0.577 0.245 27.325) -> #e7000b
       white #ffffff        4.76:1   |  same-as-background (before)  1.00:1
dark   --destructive oklch(0.396 0.141 25.723) -> #82181a
       white #ffffff       10.06:1   |  #fb2c36 (before)              2.63:1
targets: 4.5:1 body text (14px), 3:1 large text. Both toast nodes are 14px (title 600, description 400),
so both need 4.5:1, not 3:1.
```

Screenshots committed to `debug_reports/` (1440×900, bottom-right of the viewport, 388×94 toast):

| File | What it shows |
| --- | --- |
| `toast_destructive_before_light_20261010.png` | a solid red box with **no legible text** (1.00:1) |
| `toast_destructive_after_light_20261010.png` | "Probe title / Probe description" in white on red (4.77:1) |
| `toast_destructive_before_dark_20261010.png` | mid-red text on dark red (2.63:1 / 2.41:1) |
| `toast_destructive_after_dark_20261010.png` | white text on dark red (10.03:1) |

The four runs, the raw measurement JSON, and both before/after PNGs were produced by one script
(`toast-probe.mjs`) so the only variable between "before" and "after" is the tree.

## 5. Criterion 2 — the ~20 `text-destructive`-on-light sites did not move

Three checks, all on the same two builds:

1. **The diff.** `git diff` touches three lines: the two `--destructive-foreground` declarations and one
   class string in `toast.tsx`. No other token, no `--destructive`, no component that renders
   `text-destructive`.
2. **Computed on the rendered page.** `--destructive` in the live build reads
   `lab(48.4493% 77.4328 61.5452)` (light) / `lab(28.5139% 44.5539 29.0463)` (dark) — **identical**
   before and after, in both themes.
3. **The token probe measured, not assumed.** The probe page renders a `text-destructive` span on a
   white surface and a `bg-destructive text-destructive-foreground` box; across all five runs the red
   text on white computes to `lab(48.4493 77.4328 61.5452)` — byte-identical to the pre-fix value. On
   those light surfaces that pair measures 4.50:1 on `--background` and 4.76:1 on white, unchanged.

The only consumers of `--destructive-foreground` in the repo are `components/ui/toast.tsx:34` (the
toast's own red surface) and `:65` (the `ToastAction` hover, which paints on the same red surface);
`grep -rnI "destructive-foreground" . --exclude-dir={node_modules,.next,.git}` returns nothing else.

## 6. `styles/globals.css` — **dead**, left untouched

The repo carries two copies of the token block. The second one (`styles/globals.css`, identical light
collapse at its lines 21–22) is **not imported anywhere**. Searches, all from the repo root:

```
$ grep -rnI -E "styles/globals|['\"]\.\./styles|['\"]@/styles|['\"]\./styles" . \
      --include='*.tsx' --include='*.ts' --include='*.js' --include='*.jsx' \
      --include='*.css' --include='*.mjs' --exclude-dir=node_modules --exclude-dir=.next
(no matches)

$ grep -rnI "styles/globals" . --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git
documentation.md:107                                      (prose)
documentation.md:1240                                     (prose)
debug_reports/DEAD_COMPONENT_DELETION_20261010.md:212     (prose)

$ grep -rl "styles/globals" .next/static 2>/dev/null
(absent)      # the only .next hits are bare path strings inside .next/dev/cache/turbopack/*.sst,
              # a stale `next dev` cache (mtimes Sep 18 / May 1) — not an import, not a shipped chunk
```

Supporting evidence that `app/globals.css` is the live one — including a rendered marker, since two
files with the same token names would otherwise be distinguishable only by their values:

| Marker | `app/globals.css` | `styles/globals.css` | Measured on the shipped build |
| --- | --- | --- | --- |
| `--background` (light) | `oklch(0.98 0.005 240)` → `#f6f9fb` | `oklch(1 0 0)` → `#ffffff` | `lab(97.6882% -.8232 -1.65226)` = `#f6f9fb` |
| `--radius` | `0.75rem` | `0.625rem` | `.75rem` |
| Tailwind sources | `@source '../app'`, `'../components'`, `'../lib'`, `'../hooks'`, `'../stores'` | bare `@import 'tailwindcss'` | `styles/` is not a source root |
| Config | `components.json` → `css: app/globals.css`; `app/layout.tsx` imports `./globals.css` | — | — |

The toast's own rounded corners sample the page underneath them at `#f5f9fb` — the same light
background value — so the paint at 1440×900 comes from `app/globals.css`. Per the card, a dead file is
reported and left alone (deletions are card 2's business).

## 7. Residual findings — recorded, not fixed, not filed

1. **The destructive toast's close icon is below 3:1 in the light theme.** `ToastClose` paints
   `group-[.destructive]:text-red-300` (`components/ui/toast.tsx:80`) — `oklch(0.808 0.114 19.571)` =
   `#ffa2a2` in **both** themes, so on the light toast it is **2.48:1** against `#e7000b` and on the
   dark toast **5.24:1**. It is a non-text control (WCAG 1.4.11 wants 3:1) and it is
   hover/focus-revealed (`opacity-0` until interaction), which is why it is not in this card's
   scope — but it is the same defect class as the one just fixed and the fix is one token away
   (`group-[.destructive]:text-white`). Not fixed here: the card confines the change to the
   foreground-on-destructive-background pairing.
2. **The fix removes a visual difference, not just a contrast failure.** Before, the destructive toast
   was red-on-red while the destructive `Button`/`Badge` were white-on-red; the toast now matches them
   exactly (`#ffffff` on `#e7000b` / `#82181a`, 4.76:1 / 10.06:1).
3. **`ToastDescription`'s `opacity-90` remains the ceiling for non-destructive toasts.** It is
   deliberate there (a lighter body line on `bg-background`) and untested by this card; the override
   only fires on the destructive surface. Worth knowing: at 0.9 alpha a foreground can never reach
   4.5:1 on the *light* destructive red even if it were pure black (4.25:1) — for this background the
   alpha, not the hue, is the binding constraint.

## 8. Gates (raw) — final tree, probe route removed

```
### 1. npm run build        exit 0   13 routes, no /toast-probe; "Compiled successfully"
### 2. npx tsc --noEmit     exit 0
### 3. npm test             exit 0   35/35 + 12/12 + 15/15 (62/62) checks passed
### 4. npm run lint         exit 0   98 problems (0 errors, 98 warnings) — card 4's documented baseline
```

Full log: `debug_reports/gates_destructive_foreground_20261010.txt`. Ordering note recorded there: the
build runs **first**, because the previous `.next` (built with the temporary probe route) leaves a
generated `.next/types/validator.ts` naming `app/toast-probe/page.js`, which makes a tsc-only run fail
on that stale artefact — the shipped build regenerates it.

## 9. Freeze, hygiene, residual risk

- `git ls-remote --heads origin alan` → `c6021602881baf5c69137579a4ac58ece7717966`, unchanged from
  dispatch. No `git push`, no PR.
- Harness hygiene: the temporary route is **out of the tree** (`app/toast-probe/` does not exist; it
  was moved to the harness scratch dir, not deleted in the repo); `next-env.d.ts` churn (`.next/dev/types`
  ↔ `.next/types`) was reverted with `git checkout -- next-env.d.ts`; all six `next start` listeners
  (3111–3117) and the headless Edge on CDP port 9223 were terminated with in-process `process.kill`
  (this harness refuses `taskkill`), verified by `netstat` (no listener) and by a failed `fetch` on
  every port.
- Residual risk: the card's target is a **contrast** criterion and every number above was taken on the
  real production build served by `next start` at 1440×900, in both themes. The toast was fired from a
  harness route, not from `app/dashboard/page.tsx` (which sits behind `AuthGuard` and the live Worker);
  the call site and the variant are identical, so the pixels are the same. The renderer is Chromium
  (Edge 154) only — the token arithmetic is renderer-independent, but the pixel sampling is not.
