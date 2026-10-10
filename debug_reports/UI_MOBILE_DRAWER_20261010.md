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
