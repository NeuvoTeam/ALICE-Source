# ALICE — Reflection Canvas (Pad) UX Spec (Item 2)

> **Anchor convention.** Code references here are cited by **symbol**, not by line number —
> a line number rots with any adjacent edit, so it reads as a fact with no expiry. Resolve a
> symbol with `grep -n '<symbol>' <file>`. If a line number is ever genuinely load-bearing it
> must be stamped `as of <sha>`, never left bare.

Author: Aya (UI/UX architect)
Date: 2026-10-11
Status: SPEC — not implemented.
Scope: `components/canvas/ReflectionCanvas.tsx`, `components/canvas/canvasUtils.ts`,
`components/canvas/canvasTypes.ts`, `app/practice/[sessionId]/page.tsx`

---

## 1. Corrected diagnosis (READ THIS FIRST — the reported mechanism is wrong)

Kuro's brief says `drawBackground()` "returns early when the background is `"blank"`,
so the canvas is never filled. It's transparent over a dark container."

**That is not what the code does.** `canvasUtils.ts`:

```ts
const bgColour  = isDark ? "#1a1d21" : "#ffffff";
ctx.fillStyle = bgColour;
ctx.fillRect(0, 0, width, height);      // ← the fill happens FIRST

if (background === "blank") return;      // ← only skips the ruled lines / dots
```

The early return skips the *guide lines*, not the fill. The canvas is opaque in every
theme. Patching the early return would change nothing about the dark pad, and shipping
that as "the fix" would leave the operator's actual complaint on screen.

### What is actually happening — three distinct defects

**Defect A — the ink is invisible in dark mode (severity: blocking).**
`ReflectionCanvas.tsx` sets `PEN_COLOR = "#1a1d28"` with the comment "adapts via
compositing in dark mode". There is no compositing anywhere in the file. Measured
contrast ratios:

```
  1.007:1   ink #1a1d28 on dark pad #1a1d21      ← the stroke is ON the same colour as the paper
 16.796:1   ink #1a1d28 on light pad #ffffff
```

At 1.007:1 a client in dark mode draws and sees **nothing**. This is the real content
of "the pad defaults dark", and it is the only defect here that loses a client's work.

**Defect B — the pad has no visible boundary (severity: high, explains the screenshot).**

```
  1.056:1   container slate-900 #0f172a vs pad #1a1d21
```

The dark pad fill (`#1a1d21`) and the card behind it (`dark:bg-slate-900`,
`ReflectionCanvas.tsx`) are the same value to the eye, so the sheet merges into the
chrome and reads as one dark slab. There is no paper edge, no shadow separation, no
affordance that this is a surface you can write on.

**Defect C — erasing is invisible, which is why the only feedback is the word "Draw".**
`canvasUtils.ts` renders the eraser with
`globalCompositeOperation = "destination-out"` — it punches **alpha**, it does not paint
paper. The pixels behind the canvas are the parent `div` (the drawing container, no background) and
then the card. In both themes the backdrop is the same colour as the fill, so:

| theme | pad | after erase | visible? |
| --- | --- | --- | --- |
| light | `#ffffff` | transparent → shows `bg-white` card | no |
| dark | `#1a1d21` | transparent → shows `#0f172a` | 1.056:1 — effectively no |

So erasing produces no visible change, the stroke count falls to 0, and the status-bar
hint in the status bar flips back to *"Draw with a stylus, finger, or mouse"*. That is
**exactly** the operator's observation — "the eraser's only visible result is the word
Draw". Note the string is the **status bar hint**, not canvas content.

It also corrupts the artefact: `exportAsImageBlob` (`canvasUtils.ts`) copies the
source canvas onto an offscreen canvas with **no background fill**, so erased regions
stay transparent in the PNG. The clinician views it with `<img src={r.imageUrl}>`
(`app/practitioner/tasks/[id]/review/page.tsx`) on a card — transparent holes render
as whatever is behind them, and a JPEG fallback flattens them to black.

**Defect D — the clinician's chosen background never reaches the canvas (severity: low,
and cheaper than reported).**
Kuro's brief says "nothing consumes `suggested_background`". Half right: the canvas
never consumes it, but the **wire already carries it end to end**:

- `lib/ai/schemas.ts` defines it on `ReflectionPromptSchema`.
- `backend/CloudFlare.js` — `reflection_prompt: ["prompt", "suggested_background", "notes"]`
  is in `CLIENT_PRACTICE_TASK_FIELDS`, so `projectClientPracticeTask` already projects it
  and `GET /client-homework/:id` already returns it.
- `app/practice/[sessionId]/page.tsx` types `PracticeTask` with an index signature,
  so `practiceTask.suggested_background` is available on the page **today**.

Missing piece: the page mounts `<ReflectionCanvas />` bare and
`ReflectionCanvas.tsx` defaults `background` to `"blank"`. **No schema, worker
or projection change is needed** — a prop pass and a canvas prop. Do not let this be
scoped as a backend ticket.

---

## 2. Design principles

1. **The pad is a sheet of paper in a room.** The theme dims the *room*; it does not
   invert the *sheet*. A reflection canvas is a handwriting surface — inverting it to
   light-ink-on-black breaks the pen-to-paper illusion that makes a client willing to
   write by hand, and it makes the exported artefact differ from what the client saw.
2. **One artefact, one appearance.** Whatever the theme, the exported image and the
   clinician's view must be the same sheet the client drew on.
3. **Paper is not screen-white.** Pure `#ffffff` in a dark UI glares and destroys the
   material metaphor. Warm off-white reads as paper.
4. **Every control must be identifiable by icon alone at 16 px, and by text at a glance.**

---

## 3. Surface: paper, ink, guides

### 3.1 Paper colour

| Token | Light theme | Dark theme | Rationale |
| --- | --- | --- | --- |
| `PAPER_LIGHT` | `#FBFAF7` | — | warm off-white; paper, not screen |
| `PAPER_DARK` | — | `#EDE9E1` | dimmed paper for a dim room |

Recommendation: **warm off-white, not pure white** (`#FBFAF7`). Pure `#ffffff` next to
the app's `--background: oklch(0.98 0.005 240)` reads as a hole punched in the page; a
warm tint reads as a sheet. `#FBFAF7` keeps the ink contrast at 16.09:1.

In dark mode the sheet is **dimmed, not inverted** — `#EDE9E1`. It stays warm and stays
paper-like, but drops far enough in luminance not to glare in a dark room. Ink stays
dark in both themes, so the artefact is identical either way.

Explicit non-goal: a light-ink-on-black "night paper" mode. It is defensible
ergonomically and I expect it will be requested, but it must not ship as a
theme-follows-OS behaviour, because then the digitised artefact depends on the client's
device setting. If it is built, it is a **per-canvas explicit toggle persisted in
`canvas_data`**, with the export rendering the ink and paper the client actually used.
Record it as Phase 2; do not let it leak into this fix.

### 3.2 Ink

| Token | Value | Contrast |
| --- | --- | --- |
| `PEN_COLOR` | `#1A1D28` (unchanged) | 16.09:1 on `#FBFAF7`; 14.21:1 on `#EDE9E1` |

Change the comment at `ReflectionCanvas.tsx` — it currently claims compositing that
does not exist. Replace with: *"near-black ink; the paper adapts to the theme, the ink
does not, so the exported artefact matches what the client drew."*

Selection/highlight accent (if ever added) uses `--primary`.

### 3.3 Guides (ruled lines / dot grid)

Retune to dark-ink based in both themes, since the paper no longer inverts:

| Token | Light | Dark | Notes |
| --- | --- | --- | --- |
| `GUIDE_LIGHT` | `rgba(31, 36, 48, 0.12)` | — | on `#FBFAF7` ≈ 1.29:1 — deliberately below text contrast; a guide, not content |
| `GUIDE_DARK` | — | `rgba(31, 36, 48, 0.16)` | slightly heavier; the dimmed paper has less headroom |

Keep `LINE_SPACING = 28` and `DOT_SPACING = 24` (both read well for adult handwriting
at 96 dpi ≈ 7.4 mm and 6.4 mm). Raise `DOT_RADIUS` from `1.2` to `1.4` — at 1.2 px a
dot grid nearly vanishes on the dimmed paper.

One change to `drawBackground`: the guide colour must no longer be derived from
`isDark ? white : black`. It is `GUIDE_DARK` on the dark *paper*, which is still dark
ink. Suggested shape:

```ts
export function drawPaper(ctx, width, height, isDark) { /* fillRect with PAPER_* */ }
export function drawGuides(ctx, width, height, background, isDark) { /* lines / dots, GUIDE_* */ }
export function drawBackground(ctx, width, height, background, isDark) {
  drawPaper(ctx, width, height, isDark);
  if (background === "blank") return;
  drawGuides(ctx, width, height, background, isDark);
}
```

Splitting `drawPaper` out is not cosmetic — §4 and §5 both need to call it on their own.

### 3.4 Dark-mode behaviour — the decision

**The sheet stays paper in both themes. Dark mode dims the sheet, never inverts it.**

Apply to the container so the sheet reads as an object on a surface:

```tsx
// light
"border-slate-200 shadow-sm"
// dark — a lifted edge so the paper separates from the chrome
"dark:border-slate-700 dark:shadow-black/40"
```

Defect B is fixed by this plus §3.3: the pad is now lighter than the card in dark mode,
so its boundary exists.

---

## 4. The eraser must reveal paper

Two coordinated fixes; both are required, because the export path and the live path are
different code.

**4.1 Live path — the eraser paints paper.**
Replace `destination-out` with `source-over` using the paper colour for the current
theme:

```ts
if (stroke.tool === "eraser") {
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = isDark ? PAPER_DARK : PAPER_LIGHT;
}
```

`renderStroke` needs the paper colour, so thread it through (`renderStroke(ctx, stroke, isDark)`)
or resolve paper in `canvasUtils` from `isDark`. Keep `effectiveWidth`
multiplying the eraser by 4 — an eraser being fat is right.

Consequence to state in the commit: pre-existing stored strokes with
`tool: "eraser"` now paint paper instead of cutting alpha. That is the intended visual
for them too (they were meant to erase), and it fixes old drafts as well as new ones. No
data migration is required.

**4.2 Export path — composite paper first.**
`exportAsImageBlob` must never produce alpha. Fill the offscreen canvas with paper
before `drawImage`:

```ts
const ctx = offscreen.getContext("2d")!;
ctx.fillStyle = isDark ? PAPER_DARK : PAPER_LIGHT;
ctx.fillRect(0, 0, exportW, exportH);
ctx.drawImage(sourceCanvas, 0, 0, exportW, exportH);
```

Best-effort belt and braces: pass `background: "#ffffff"` (or the paper hex) to
`canvasToBlob` for the JPEG fallback so any residual alpha flattens to paper, not black.

**4.3 Regression guard.** A reflection exported after a full erase must be
(a) opaque and (b) the paper colour — not transparent, not black. Assert on
`getImageData(0,0,1,1).data[3] === 255` plus the RGB triple.

### 4.4 Follow-on — the eraser also removes the *printed rules* (pre-existing; NOT part of the current agy run)

Raised after the first spec was issued, so it is deliberately **out of the running scope**.
The current run owes the six tests in §9; this adds a seventh if it is taken up.

**The defect.** Paper, guide lines and ink all live on **one** canvas:
`drawBackground` (`canvasUtils.ts`) fills the paper *and* strokes the rules/dots onto
it, then `redrawAll` draws strokes on top. So the eraser cannot distinguish "ink" from
"printed rule" — `destination-out` cuts alpha through both, and my §4.1 fix paints flat
paper over both. Either way, erasing across a ruled or dotted sheet leaves a paper-coloured
patch **with the rules missing**. That is visible damage on a clinical artefact (a ruled
sheet with chew marks), and it is present **today**, not introduced by §4.1: erase in lined
mode now and the rules vanish into the container colour.

**Recommendation — and it is simpler than §4.1.** Invert the layering: keep the canvas
**ink-only** and move paper + guides to a layer *beneath* it (CSS
`repeating-linear-gradient` for ruled, `radial-gradient` for dotted, or a second static
canvas). Then:

- the eraser keeps `destination-out` — which is already the correct behaviour for an
  ink-only canvas — and erasing reveals the paper **and the rules intact**, exactly like a
  real eraser (a rubber removes graphite, not the printed rule);
- **§4.1's `isDark` threading through `renderStroke` becomes unnecessary.** The function
  keeps its current signature, and with it the three call sites that would otherwise have
  to change together: `handlePointerDown` (`ReflectionCanvas.tsx`), `handlePointerMove`
  (`handlePointerMove`) and `redrawAll` (`canvasUtils.ts`). Threading a new parameter through those
  three is the most likely way this change breaks — a missed call site means the initial
  pointer dot paints the wrong colour — so removing the need to touch them is a real risk
  reduction, not just elegance;
- the export composites paper → guides → ink, which §4.2 already requires, so the artefact
  rule is unchanged.

Do not apply this mid-flight. Sequence it after the current run is verified and committed,
as its own change with its own test:

> **Test 7 (follow-on):** on a `lined` sheet, an eraser stroke crossing a rule removes the
> ink at that point and leaves the rule present; the exported image contains the rule
> pixels (`getImageData` at a known rule y-coordinate is not paper-coloured).

**If it is declined**, keep §4.1 as specified and record the consequence explicitly in
`documentation.md`: erasing a ruled or dotted sheet damages the printed rules in the
digitised record. A known and stated limitation is acceptable; an unstated one is not.

---

## 5. The empty canvas

Today the empty state is *only* the status-bar string, which reads as a
flush-left caption and, on the signed link, appears one line under the clinician's
prompt. Replace the caption and add a real, non-exporting overlay.

**5.1 Overlay (never canvas pixels).** Anything drawn into the canvas is exported to the
clinician. This is a DOM layer inside the drawing container:

```tsx
{historyLen === 0 && (
  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
    <div className="text-center">
      <PenLine className="mx-auto mb-2 h-6 w-6 text-slate-300 dark:text-slate-500" />
      <p className="text-sm font-medium text-slate-400 dark:text-slate-500">
        Start anywhere
      </p>
      <p className="mt-0.5 text-xs text-slate-300 dark:text-slate-600">
        Draw with a stylus, finger, or mouse
      </p>
    </div>
  </div>
)}
```

`pointer-events-none` is load-bearing — the layer sits over the canvas. It disappears on
the first committed stroke (`historyLen > 0`), which is also when the status bar starts
reporting a stroke count.

**5.2 Status bar copy.** Retitle the left slot so it names the surface rather than
instructing:

| State | Left slot | Right slot |
| --- | --- | --- |
| empty | `Blank sheet · nothing drawn yet` | `⌘Z undo · ⌘⇧Z redo` |
| 1+ strokes | `4 strokes` | `⌘Z undo · ⌘⇧Z redo` |

On the signed link the keyboard hint is wrong (iPad has no ⌘Z) — pass
`showKeyboardHints={false}` from `app/practice/[sessionId]/page.tsx` and render
`Autosave paused` / nothing there instead. A hint for a key that does not exist on the
device is worse than no hint.

**5.3 Do not put the reflection prompt inside the canvas area.** The signed-link page
already renders it above (`app/practice/[sessionId]/page.tsx`). Duplicating it
in the overlay would compete with the client's own first stroke.

---

## 6. Toolbar — the findability problem (this is a real bug, not taste)

The operator's icon list is **diagnostic**. Reading the toolbar against it:

| Operator saw | Actual control | Line |
| --- | --- | --- |
| "pen" | `Pen` icon — ✅ the one control that reads correctly | `Pen` button |
| "a diamond" | `Eraser` (`lucide-react` `Eraser` at 16 px) — **the operator could not identify the eraser at all** | `Eraser` button |
| "two swatches" | stroke-width dots #1 and #2 (`h-1.5 w-1.5`, `h-2.5 w-2.5`) | the three width buttons |
| "a dotted circle" | stroke-width dot #3 (`h-4 w-4`) | the widest width button |
| "a black square" | the **text glyph** `"□"` for Blank | `canvasTypes.ts` |
| "hamburger" | the **text glyph** `"≡"` for Lined | `canvasTypes.ts` |
| "ellipsis" | the **text glyph** `"⋯"` for Dotted | `canvasTypes.ts` |
| undo / redo / trash | `Undo2`, `Redo2`, `Trash2` — ✅ read correctly | `Undo2` / `Redo2` / `Trash2` buttons |

Everything the operator could not name is either a bare text glyph (`□ ≡ ⋯`, rendered in
`font-mono` at `text-xs`) or a plain dot. `≡` genuinely looks like a hamburger
menu and `⋯` genuinely looks like an overflow menu — the operator was not misreading,
the icons are wrong. And the eraser — the control the operator explicitly asked about —
is unidentifiable.

### 6.1 Required changes

1. **Kill the text glyphs.** Replace `icon: "□" \| "≡" \| "⋯"` in `BACKGROUND_OPTIONS`
   with real Lucide components:

   | Background | Icon | Label |
   | --- | --- | --- |
   | blank | `Square` | Blank |
   | lined | `AlignLeft` (`Rows3` is also acceptable) | Lined |
   | dotted | `Grip` (`Dot` grid) | Dotted |

2. **Increase icon size and stop relying on the dot as a label.** `h-4 w-4` → `h-[18px] w-[18px]`
   for tools; the width dots grow to `h-2 w-2 / h-3 w-3 / h-4.5 w-4.5` so the three are
   unambiguously a graduated set, and the group gets a visible label.

3. **Group, separate and label.** Current order is a flat run of eleven controls
   separated by hairlines. Regroup into three labelled clusters:

   ```
   ┌──────────────────────────────────────────────────────────────────────┐
   │ ✏ Pen │ ⌫ Eraser  ⋮  Width  ● ○ ●   ⋮  Paper  □ ☰ ⣿  ⋮  ↶ ↷   ⋮  🗑   │
   └──────────────────────────────────────────────────────────────────────┘
     TOOLS            WIDTH        PAPER              HISTORY      CLEAR
   ```

   - Tools (Pen / Eraser) — mutually exclusive, side by side, first.
   - Width — the three dots, in ascending order.
   - Paper (Blank / Lined / Dotted).
   - History (Undo / Redo).
   - Clear — last, `danger`, already separated. Correct as-is.

   Add a group label on ≥ `sm` widths (`text-[10px] uppercase tracking-wider text-muted-foreground`),
   and keep `aria-label` on every button regardless. Group wrappers get
   `role="group" aria-label="Width"` etc.

4. **Tooltips via `title` already exist** — keep them, and make sure the
   label text is the plain tool name ("Eraser", not "Tool: eraser").

5. **Disabled-history affordance.** Undo/Redo currently render `disabled:opacity-35`. At 35% on a translucent toolbed they read as missing, not disabled. Raise
   to `disabled:opacity-45` and add `aria-disabled`.

6. **`aria-pressed` is already set** for active tools — good, keep it, and make
   sure the *paper* toggles report `aria-pressed` too (they do, same primitive).

### 6.2 Keyboard

The keyboard handler binds ⌘Z / ⌘⇧Z only when `e.target` is `document.body` or
`document.documentElement`. That check excludes the common case where focus sits on a
toolbar button — so undo silently does nothing right after clicking Undo. Broaden to
"not inside a text input / textarea / contenteditable":

```ts
const t = e.target as HTMLElement | null;
if (t?.closest("input, textarea, [contenteditable='true']")) return;
```

---

## 7. Wiring `suggested_background` (no backend change)

1. `ReflectionCanvas.tsx` — add `defaultBackground?: BackgroundType` to
   `ReflectionCanvasProps`, and seed `background` from it:

   ```ts
   const [background, setBackground] = useState<BackgroundType>(
     initialData?.background ?? defaultBackground ?? "blank"
   );
   ```

   Note the existing deliberate contract in the state initialisers: `initialData` is read once at
   mount. `defaultBackground` follows the same rule — it is a seed, not a controlled
   prop. Do not add a sync effect.

2. `app/practice/[sessionId]/page.tsx` — pass it:

   ```tsx
   const suggested = practiceTask.suggested_background;
   const bg: BackgroundType | undefined =
     suggested === "lined" || suggested === "dotted" || suggested === "blank" ? suggested : undefined;
   …
   <ReflectionCanvas defaultBackground={bg} />
   ```

3. The clinician's own mount (if any) should pass the same value so both see one sheet.

4. Regression test: a `reflection_prompt` task with `suggested_background: "lined"`
   renders the canvas with the lined paper toggle active on first paint.

---

## 8. Accessibility

- Canvas has `aria-label` already. Extend it to name the paper:
  `"Reflection canvas — ruled paper. Draw with a stylus, finger, or mouse."`
- The toolbar is `role="toolbar"` — add `aria-orientation="horizontal"` and
  implement roving tabindex (arrow keys move between controls) or accept Tab-per-control;
  with eleven controls Tab is tolerable, roving is better.
- Paper colour must never be the only signal: the active paper toggle carries
  `aria-pressed` **and** a visible pressed state.
- Empty-state overlay text is decorative (`pointer-events-none`); it must not be a
  live region, or a screen reader announces it on every stroke.
- The status-bar stroke count is `aria-live="polite"`? **No** — it would fire on every
  stroke. Leave it unanimated.

## 9. Regression tests

1. `drawBackground(ctx, w, h, "blank", false)` fills every pixel `#FBFAF7` — the early
   return skips guides only. (This is the test that would have caught the misdiagnosis.)
2. Ink-on-paper contrast ≥ 4.5:1 in **both** themes (compute in the test; assert, do not
   eyeball).
3. An eraser stroke over ink restores the paper colour and leaves alpha 255.
4. `exportAsImageBlob` on a fully erased canvas yields an opaque paper-coloured image.
5. A bare `<ReflectionCanvas />` and one with `defaultBackground="dotted"` paint
   different backgrounds on first paint.
6. Toolbar renders no `"□"`, `"≡"` or `"⋯"` text nodes.

## 10. Out of scope

- Night-paper (inverted) mode — Phase 2, per-canvas, hex persisted in `canvas_data`.
- Palm rejection heuristics, pen pressure, stroke smoothing.
- Redesigning the stroke-width model; three widths stay.
- Deleting the `Line`/guide spacing constants.

## 11. Handoff

- Implement via `agy`; **commit only, never push**.
- Finishing order: §4 (eraser + export) → §3 (paper/ink/guides) → §7 (wiring) → §6
  (toolbar) → §5 (empty state). §4 first: it is the only defect that loses work.
- `documentation.md` in the same commit (`.hermes.md` §6).
