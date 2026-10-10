# Mobile drawer for the dashboard sidebar — recommendation, implementation, evidence

Kanban `t_a80d102c` (follows `t_6894e0a5`). Coding agent: Antigravity CLI (`agy`),
model `gemini-3.1-pro-high` (non-Claude, per the operator constraint). Branch `alan`,
**local commits only — nothing pushed**. Harness + logs referenced below live in
`%LOCALAPPDATA%\hermes\profiles\kuro\cache\scratch\`.

Every screen sits behind `AuthGuard` + the live Worker API, so the shell was rendered in an
offline harness (real `DashboardShell` / `DashboardSidebar` / `MainContent`, `window.fetch`
stubbed to reject) instead of driving the real app — no production credentials, no patient data
(Red Zone clean).

## 1. Recommendation (implemented)

**A left `Sheet` (Radix Dialog, `components/ui/sheet.tsx`) holding the existing
`DashboardSidebar`, below the Tailwind `lg` breakpoint (1024px), triggered from a slim in-flow
top bar that exists only below `lg`.**

- **Breakpoint: `lg` (1024px)**, i.e. exactly the boundary the card calls "desktop". The drawer's
  `lg:hidden` chrome and the `(max-width: 1023px)` media query in the shell are the same boundary,
  so the trigger and the drawer can never disagree about which mode is live. At ≥1024px the shell
  renders the unchanged static 256px `<aside>`; no drawer, no trigger, no new chrome.
- **Trigger placement: an in-flow top bar** (`h-14`, `lg:hidden`) as the first row of the shell,
  carrying a real `<button aria-label="Open navigation">` (a `SheetTrigger asChild`, so Radix
  supplies `aria-expanded` / `aria-controls` / `aria-haspopup="dialog"`). Rejected: a floating
  button over the main region — it overlaps the main header at 390px, and a bar costs nothing
  because it disappears entirely at ≥`lg`.
- **Primitive: `Sheet`**, not a hand-rolled off-canvas panel. Radix Dialog gives the focus trap,
  `Escape`, `role="dialog"` + sr-only title/description, the scroll lock, focus restoration to the
  trigger, and the left-side entrance animation for free.
- **The existing 256px static sidebar at ≥1024px is byte-for-byte the same component with the same
  props.** `DashboardSidebar` and its zustand wiring are untouched; exactly one instance exists at
  any moment, moved between the static slot (`hidden lg:flex`, ≥`lg`) and the `SheetContent`
  (below `lg`). Nothing about the store, routes, requests, auth or Supabase/RLS changed — the shell
  reads only `selectedClientId` / `selectedSessionId`.

**Behavioural, not styling:** (a) an open/closed drawer state; (b) a post-mount breakpoint
listener that moves the sidebar between slots and closes the drawer when the boundary is crossed;
(c) closing the drawer when the selection changes — choosing a client or a session from the drawer
would otherwise leave it covering the region it just navigated to. Everything else (the top bar,
the drawer width, hiding the static slot below `lg`) is styling.

## 2. Alternatives considered and rejected

| Alternative | Why not |
| --- | --- |
| `Drawer` (vaul, `components/ui/drawer.tsx`) | Built for gesture-dismissed sheets. Drag-to-close fights the tree's own touch scrolling, and its sizing rules (`w-3/4 sm:max-w-sm`, bottom-sheet radii) are wrong for a 256px navigation rail. |
| CSS-only off-canvas (`<aside>` translated with `data-open`) | Cheapest, zero JS — but focus trapping, `Escape`, `aria-expanded`, `inert`/scroll-lock and the "hidden but tabbable" problem all become hand-rolled, which the brief explicitly rules out. |
| Two rendered slots (shadcn's own `sidebar-07` pattern: one static copy + one copy inside the sheet) | Mounts `DashboardSidebar` twice while the drawer is open — duplicate DOM, two `ClientNode` trees, doubled `EditableName` inputs. The brief forbids duplicating its state or props, so the shell moves one element instead. |
| `components/ui/use-mobile.tsx` / `hooks/use-mobile.ts` | Hardcodes 768px. Used with the `lg` chrome that leaves the sidebar unreachable between 768px and 1023px (JS says "mobile", CSS says "desktop"); used with 768px chrome it contradicts the card's "desktop ≥1024px unchanged". |
| Resizable / collapsible desktop sidebar (`react-resizable-panels` is already a dependency) | A desktop behaviour change with its own persisted state — out of scope for a card whose only desktop criterion is "unchanged". |

## 3. What changed

- `components/dashboard-shell.tsx` (new, 83 lines): the responsive shell.
- `app/dashboard/page.tsx`: the `<div className="flex h-screen">` wrapper at line 64 and the
  `DashboardSidebar` element are replaced by `<DashboardShell …>{MainContent|ClientView}</DashboardShell>`.
  Nothing else in the file changed (`DashboardSidebar` is no longer imported there).
- `documentation.md` §2, §4.4, §8.5.
- `debug_reports/ui_drawer_390_closed.png`, `ui_drawer_390_open.png`, `ui_drawer_desktop_1440.png`.

Key mechanics: `isMobile` **starts `false`** and is only ever set from a post-mount effect, so the
server render and the first client render agree (no `window`/`matchMedia` read during render); the
static slot keeps `hidden lg:flex`, so even the pre-effect frame cannot paint a cramped 256px
sidebar at 390px; a `resize` listener re-reads the query and closes the drawer only when the
boundary is actually crossed (a viewport change inside the same mode leaves it open).

## 4. Harness

Two throwaway harnesses outside the repo, bundled with the repo's own `esbuild` against the
**compiled Tailwind CSS from `npm run build`** (`.next/static/chunks/081idmjs2au_e.css`, copied as
`alice-drawer.css`), so the utilities under test are the ones the app ships:

- `drawer-harness.html?shell=old` — the `f2f653a` element tree exactly:
  `<div class="flex h-screen">` + real `DashboardSidebar` + real `MainContent`.
- `drawer-harness.html?shell=new` — the production `<DashboardShell>` with the **same** real
  `MainContent` child, so the shell is the only difference.

`window.fetch` rejects, so nothing touches the Worker; the store is seeded with one client, two
cases, two sessions and `sessionHydratedId` so the generator renders Phase 1.

## 5. Measured results (raw)

```
OLD (f2f653a tree) @1440 : innerWidth 1440  docClient 1425  docScroll 1425
                           aside 256 visible; main wrapper 1425; main controlWidth 1169
                           textarea 606; "Paste from Heidi" 146.9 (not clipped); PHASE badge 66.8 (not clipped)

NEW (DashboardShell) @1440: innerWidth 1440  docClient 1425  docScroll 1425
                           aside 256 visible; main wrapper 1169; main controlWidth 1169
                           textarea 606; "Paste from Heidi" 146.9; PHASE badge 66.8      => IDENTICAL to OLD

OLD (f2f653a tree) @390  : innerWidth 390   docClient 375   docScroll 462   <-- horizontal overflow
                           aside 256 visible; main controlWidth 119 (scrollWidth 206)
                           textarea 52; "Paste from Heidi" right edge 322; PHASE badge right edge 597.9 (off-screen)

NEW (DashboardShell) @390, drawer closed: innerWidth 390  docClient 375  docScroll 375 (no overflow)
                           aside elements: 0        main 375 (full width)
                           textarea 301; "Paste from Heidi" right edge 322; PHASE badge right edge 341.9

NEW @390 with the mobile viewport emulated (mobile=true): layout viewport widened to 462 in the OLD
tree (main 134, which is the "134px" logged in UI_PASS_20261010.md); with the NEW shell the layout
viewport stays 390 and main is 390 minus the scrollbar.
```

The card's desktop figure "main 1264px" does not reproduce on this harness: at a 1440px viewport
the document `clientWidth` is 1425 (classic 15px scrollbar), so the main region is 1169. That is
the same basis the `f2f653a` baseline was measured on here, which is what matters for
"identical to `f2f653a`" — old and new agree to the pixel at 1440 (256 / 1169 / 606).

## 6. Interaction verification at 390px (trusted CDP clicks/keys)

| Step | Result |
| --- | --- |
| `aria-expanded` on the trigger, closed | `false` |
| Click the trigger | `role="dialog"` present, sr-only title `Navigation`, the `<aside>` **inside** the dialog at 256px, `aria-expanded="true"`, one `aside` in the document (no duplicate), `document.activeElement` = the dialog's first button (`focusInDialog: true`) |
| Scroll lock | `body { pointer-events: none; overflow: hidden }` while open |
| 3× `Tab` | focus still inside the dialog (`focusInDialog: true`) |
| `Escape` | dialog gone, `aside` count 0, `body` style cleared, `overflow: visible`, `document.activeElement` = the trigger (`focusIsTrigger: true`) |
| Re-open, click the *Session 2* row | drawer closed; the selected row moved from Session 3 to Session 2 (selection applied, drawer no longer covering the region) |
| Resize 390 → 1440 with the drawer open | drawer closed, static `aside` 256, main 1169, textarea 606, top bar `display: none` |
| Resize 1440 → 390 | back to the mobile shell, no `aside`, main 375 |

## 7. Gates

```
### 1. npx tsc --noEmit
tsc exit=0

### 2. npm test
> my-project@0.1.0 test
35/35 checks passed
12/12 checks passed
15/15 checks passed
test exit=0

### 3. npm run build
✓ Compiled successfully in 3.6s
build exit=0
```

Full log: `%LOCALAPPDATA%\hermes\profiles\kuro\cache\scratch\gates-drawer.log`.

## 8. What I could not verify, and observations

- **No React hydration check against the real route.** `/dashboard` is behind `AuthGuard`, whose
  server render is the `Loading...` placeholder — `.next/server/app/dashboard.html` contains
  `Loading` and no `aside`/`Open navigation`/`sheet-content`, so the shell only ever renders
  client-side after `GET /auth/me` resolves. The hydration argument is structural (`isMobile`
  starts `false`, the pre-effect render is the desktop slot, and no `window` read happens during
  render); it was not observed end-to-end against a live clinician session (out of scope).
- **`matchMedia` `change` events do not fire under `Emulation.setDeviceMetricsOverride`.** My own
  instrumented `MediaQueryList` listener counted 0 events over two 390↔1440 crossings. That is why
  the shell re-reads the query from a `resize` listener instead of relying on `change`: one code
  path, and the crossing behaviour is actually testable. The breakpoint value itself is read from
  `matchMedia("(max-width: 1023px)")`, which does track the emulated viewport.
- **A hidden tab freezes the drawer's exit animation.** With the CDP page backgrounded,
  `requestAnimationFrame` never fires and CSS animations never finish, so Radix's `Presence` never
  sees `animationend` and the closed portal stays mounted (with the body scroll lock still
  applied). `Page.bringToFront` released it immediately and the close behaved correctly. This is a
  Radix/background-tab artefact, not introduced by this change — the app's existing Radix
  `Popover` (modality selector) behaves identically — but it is worth knowing that a modal
  portal's cleanup waits on an animation event.
- Desktop screenshots are included for the "unchanged" claim; the 1440 numbers were taken from the
  same harness before and after the change rather than from the live app.

## 9. 2026-10-10, second pass (`t_ee1a066e`) — the 1023–1024px dead band, reproduced on screen and closed

The dead band §8 could only assert by static analysis is real, and it is now closed. Code commit
`4b47789` on top of `c03cf4f` (branch `alan`, **not pushed**). Coding agent: Antigravity CLI (`agy`),
model `Gemini 3.1 Pro (High)` — non-Claude, per the operator constraint. Harness, measurements and
verification below are mine. §1–§8 are untouched: this is an appended section, not a rewrite.

### 9.1 Reproducing a fractional viewport width

Two obvious routes do not work and a third does:

- `Emulation.setDeviceMetricsOverride` **rejects a fractional width** — the parameter is an int32
  (`Failed to deserialize params.width - BINDINGS: int32 value expected`), so 1023.5 cannot be
  emulated that way. `deviceScaleFactor` does not divide the layout width (`width=2046, dsf=2` →
  `innerWidth 2046`) and neither does `scale` (`scale=1.1`, `width=1024` → `innerWidth 1024`).
- An **iframe sized in fractional CSS px rounds up**: a 1023.5px frame reports `innerWidth 1024` and
  `matchMedia("(min-width:64rem)") === true` — desktop mode, not the band.
- **Real page zoom does produce a fractional layout viewport**, because the layout width is the
  emulated window width divided by the zoom. Driven with trusted CDP key events
  (`Input.dispatchKeyEvent` with `Ctrl` `=` / `Ctrl` `0`), Chrome's zoom ladder gives exact
  fractional widths from integer window widths:

  | layout viewport (CSS px) | emulated width | zoom | `dpr` |
  | --- | --- | --- | --- |
  | 1023.00 | 1023 | 100% | 1 |
  | 1023.20 | 1279 | 125% | 1.25 |
  | 1023.33 | 1535 | 150% | 1.5 |
  | 1023.43 | 1791 | 175% | 1.75 |
  | 1023.50 | 2047 | 200% | 2 |
  | 1023.64 | 1126 | 110% | 1.1 |
  | 1023.75 | 4095 | 400% | 4 |
  | 1023.80 | 5119 | 500% | 5 |
  | 1024.00 | 1024 | 100% | 1 |
  | 1025.00 | 1025 | 100% | 1 |

  Each width is verified from inside the page rather than assumed: at the 1023.64 state
  `(max-width: 1023.5px)` is false and `(max-width: 1023.64px)` true, pinning the media viewport to
  (1023.5, 1023.64] — the arithmetically exact `1126 / 1.1`. Chrome quantises the value it hands to
  media queries to 1/64 px (1023.6364 → 1023.625), ~0.02px of noise that does not matter here.
  **1023.90 exactly is not reachable** (`1023.9 × {1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5}` is never
  an integer, and width/dsf/scale cannot make it one), so the band is covered by six other
  fractional points spanning 1023.20–1023.80 instead.

### 9.2 BEFORE (`c03cf4f`) — trigger visible, drawer opens empty

Per state: media-query truth, then a trusted CDP mouse click at the trigger's own centre.

| layout width | `@media (min-width:64rem)` (Tailwind `lg`) | `matchMedia("(max-width: 1023px)")` (old JS gate) | trigger visible | after the click |
| --- | --- | --- | --- | --- |
| 1023.00 | false | **true** | yes | `[role=dialog]` 1, one `aside` 256px **inside** it — works |
| 1023.20 | false | false | yes | `aria-expanded="true"`, `[role=dialog]` **0**, no visible `aside` — **opens empty** |
| 1023.33 | false | false | yes | **opens empty** |
| 1023.43 | false | false | yes | **opens empty** |
| 1023.50 | false | false | yes | **opens empty** |
| 1023.64 | false | false | yes | **opens empty** |
| 1023.75 | false | false | yes | **opens empty** |
| 1023.80 | false | false | yes | **opens empty** |
| 1024.00 | true | false | no (`header` `display:none`) | desktop |
| 1025.00 | true | false | no | desktop |

At every fractional width in the band the two sources of truth disagree exactly as the card
described: `lg:hidden` paints the trigger, `matchMedia("(max-width: 1023px)")` says "not mobile", so
`{isMobile && <SheetContent>}` renders nothing and the hamburger sets `drawerOpen` with no dialog in
the DOM at all. The client-name row also disappears from view in those states — the one `aside`
present is the static `hidden lg:flex` copy, which `lg` no longer un-hides (`asideCount` 1,
`asideVisible` 0). `debug_reports/ui_deadband_before_1023_64_empty.png` is that state at 1023.64
after the trigger was clicked.

### 9.3 The fix (approach (b), with one correction to it)

`lg` is now the single boundary, for the CSS and the JS alike:

- **`SheetContent` is rendered unconditionally.** Radix `Dialog.Portal` mounts only while the sheet
  is open, so a closed drawer still costs no DOM (verified: `[data-slot="sheet-content"]` count 0 in
  the closed state at every width). The drawer therefore always has content whenever its trigger is
  reachable — at any width, fractional or not. The failure mode is impossible by construction rather
  than merely narrowed.
- **The JS mirrors the *negation* of the same predicate**: `MOBILE_QUERY = "(max-width: 1023px)"`
  became `DESKTOP_QUERY = "(min-width: 64rem)"` with `next = !query.matches`. That string is
  byte-for-byte the media query this build's Tailwind emits for `lg` — `.lg\:hidden{display:none}`
  and `.lg\:flex{display:flex}` both sit inside `@media (min-width:64rem){…}` in the compiled
  stylesheet — so `!matches` is the exact complement of what decides the CSS, evaluated by the same
  engine, and the two cannot disagree at a fractional width. This is why (b) closes the band where
  (a) (`max-width: 1023.98px`) would only move the 0.02px hole: (a) keeps two independent
  predicates.
- `isMobile` keeps its other two jobs unchanged: it decides which single slot holds the one
  `DashboardSidebar` (static `hidden lg:flex` wrapper, or the sheet — never both), and the `resize`
  listener still closes the drawer only when the boundary is actually crossed.

### 9.4 AFTER (`4b47789`) — measured

Same states, same harness, one bundle rebuilt from the working tree:

| layout width | `lg` | new JS gate (`!min-width:64rem`) | trigger visible | after the click |
| --- | --- | --- | --- | --- |
| 1023.00 | false | true | yes | dialog 1, one `aside` 256px inside |
| 1023.20 | false | true | yes | dialog 1, one `aside` 256px inside |
| 1023.33 | false | true | yes | dialog 1, one `aside` 256px inside |
| 1023.43 | false | true | yes | dialog 1, one `aside` 256px inside |
| 1023.50 | false | true | yes | dialog 1, one `aside` 256px inside |
| 1023.64 | false | true | yes | dialog 1, one `aside` 256px inside |
| 1023.75 | false | true | yes | dialog 1, one `aside` 256px inside |
| 1023.80 | false | true | yes | dialog 1, one `aside` 256px inside |
| 1024.00 | true | false | no | desktop, one static `aside` |
| 1025.00 | true | false | no | desktop, one static `aside` |

There is no width left where the trigger is visible and the drawer opens empty (acceptance 1), and
the media-query pair that used to disagree now reads `lg` false **and** "not lg" true at every one of
those widths.

Acceptance 2 — one `DashboardSidebar`, no duplicated tree — holds at every state: `aside` count ≤ 1
(0 while the drawer is closed below `lg`, 1 when open, and that one is inside `[role=dialog]`), the
client row "Jane May Low" appears once as a leaf element in every state, and the document holds 244
elements at desktop, 88 at 390px closed and 255 with the drawer open — never a static copy plus a
sheet copy.

`debug_reports/ui_deadband_after_1023_64_open.png` is the same clicked state as the "before" image,
now drawer open.

### 9.5 Regression: desktop and 390px (acceptance 3 and 4)

Both trees measured back to back on the same harness (interleaved, two runs each), identical in
every field:

```
                                                                BEFORE          AFTER
1440px  innerWidth 1440  documentElement.clientWidth 1425       aside 1 @256    aside 1 @256
        docScrollWidth 1425   header display:none  dialog 0      main 1169       main 1169
        textarea 606   total elements 244                        (identical)     (identical)
1024px  clientWidth 1009   aside 1 @256   header display:none    main 753        main 753
1025px  clientWidth 1010   aside 1 @256                          main 754        main 754
 390px  clientWidth 375   docScrollWidth 375 (no overflow)      aside 0         aside 0
        header/top bar visible, trigger visible                   main 375        main 375
        textarea 301   total elements 88                          (identical)     (identical)
```

The 1440 row reproduces §5's `c03cf4f` baseline exactly (256 / 1169 / 606, no top bar). 390px closed
reproduces §5's 375px full-width main and the 301px textarea.

Interaction at 390px, AFTER, driven with trusted clicks/keys — unchanged from §6:

| Step | Result |
| --- | --- |
| Closed | `aside` 0, main 375, `docScrollWidth == clientWidth == 375` |
| Click the trigger | `[role=dialog]` 1, sr-only title `Navigation`, one `aside` 256px **inside** it, `aria-expanded=true`, focus moved inside the dialog, `body { pointer-events: none; overflow: hidden }` |
| 3× `Tab` | focus still inside the dialog |
| `Escape` | dialog gone, `aside` 0, body style cleared, focus back on the trigger |
| Re-open, click *Session 2* | drawer closed, and on re-open the selection has moved Session 3 → Session 2 |
| 390 → 1440 with the drawer open | drawer closed, `lg` static `aside` 256, main 1169, body style cleared |
| 1023.64 → ≥`lg` with the drawer open | drawer closed, `lg` static `aside` 256 (the crossing still closes it from inside the band) |

### 9.6 Gates

```
### 1. npx tsc --noEmit
tsc exit=0
### 2. npm test
35/35 checks passed
12/12 checks passed
15/15 checks passed
test exit=0
### 3. npm run build
✓ Compiled successfully in 6.4s
build exit=0
```

Full log: `%LOCALAPPDATA%\hermes\profiles\kuro\cache\scratch\gates-deadband.log`. The commit hook
printed `docs:check — ok (documentation.md moved with 1 path(s))`.

### 9.7 Harness files and observations

- Harness: `%LOCALAPPDATA%\hermes\profiles\kuro\cache\scratch\` — `drawer-before.html` +
  `drawer-before.js` (bundled from `alice-before-shell.tsx`, a byte-identical copy of the `c03cf4f`
  `components/dashboard-shell.tsx`, md5 `e1aee22222822f8210b47025a1d0a3e9`), `drawer-after.html` +
  `drawer-after.js` (the working tree), `harness-server.mjs`, `harness-frame.html` (the iframe
  fractional-width experiment), `frac-probe-*.html`, and the raw results
  `deadband-before.json` / `deadband-after.json`. Both bundles use the real `DashboardSidebar`,
  `MainContent` and `DashboardShell` with `window.fetch` stubbed to reject: no credential, no Worker
  call, no patient data.
- `next build` rewrites the generated `next-env.d.ts` (dev path → `./.next/types/routes.d.ts`);
  that churn was reverted rather than committed, so `git status --porcelain` shows only this card's
  two new screenshots plus the pre-existing untracked `scratch/`.
- The closing behaviour in §8's note still applies (a backgrounded tab freezes Radix's exit
  animation); `Page.bringToFront` released it, as before.

