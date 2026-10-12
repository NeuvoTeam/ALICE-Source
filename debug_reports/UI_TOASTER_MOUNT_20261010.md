# Mounting `<Toaster />` — toasts render (card 1 of 4)

Kanban `t_d027ed5b` (card 1 of the deferred list from `t_6894e0a5`, chained behind `t_ee1a066e`).
Coding agent: Antigravity CLI (`agy`), model `gemini-3.1-pro-high` (**non-Claude**, per the operator
constraint). Diff review, harness, gates, `documentation.md` and the commit are the reviewer's.
Branch `alan`, **local commits only — nothing pushed**. Harness scratch:
`%LOCALAPPDATA%\hermes\profiles\kuro\cache\scratch\`.

## 1. What changed

`app/layout.tsx` — two lines, nothing else in the file:

```diff
 import "./globals.css";
+import { Toaster } from "@/components/ui/toaster";
 ...
 >
   {children}
+  <Toaster />
 </body>
```

- The Toaster is mounted from **`components/ui/toaster.tsx`**, which reads `@/hooks/use-toast` — the
  same module `app/dashboard/page.tsx:9` imports. No call site in the repo uses `sonner`, so
  `components/ui/sonner.tsx` is deliberately **not** mounted: it would render nothing for the app's
  own `toast()` calls, i.e. a silent non-fix.
- The duplicate hook (`components/ui/use-toast.ts`) and the duplicate `Toaster` are untouched; the
  duplicate is card 2's business.
- `app/layout.tsx` stays a **server component** (`"use client"` was not added); `components/ui/toaster.tsx`
  carries its own `"use client"`, so React SSRs its output on the first paint and hydrates it in place.
- `documentation.md` §8.5 and the §13.2 row that recorded the gap now describe the fix.

## 2. How the rendered toast was measured

No public route in the repo calls `toast()` — the only call site is `app/dashboard/page.tsx:53`,
behind `AuthGuard` (explicitly out of scope). So a **temporary public harness route**
(`app/toast-probe/page.tsx`, deleted before the commit and absent from the shipped build) rendered a
button whose `onClick` calls `toast({ title: "Probe title", description: "Probe description",
variant: "destructive" })` from `@/hooks/use-toast`. The route mounts **no** `Toaster` of its own, so
anything that renders had to come from the root layout.

Served by the real build (`npm run build` → `next start`), driven over CDP on
`http://localhost:3111/toast-probe`. Raw frame-sampled output (`requestAnimationFrame` sampler plus a
`MutationObserver`, timestamps relative to the click):

```
MUTATION LOG: click_perf 2820, events [
  { ms_after_click:    4, where: "toast-li", kind: "add", text: "Probe titleProbe description", live: "open" },
  { ms_after_click: 1168, where: "status",   kind: "remove", text: "" }
]
FRAME SAMPLE (rAF, distinct live-region states):
  { ms_after_click:  -2, count: 0, sig: "" }
  { ms_after_click:  15, count: 1, sig: "#assertive" }
  { ms_after_click:  49, count: 1, sig: "Notification Probe titleProbe description#assertive" }
  { ms_after_click: 1021, count: 0, sig: "" }
FINAL DOM:
  { regions: 1, viewports: 1, toasts: 1, open: 1,
    toast_text: ["Probe titleProbe description"], status_now: 0 }
```

Read plainly:

- click **+4 ms** — exactly one toast element enters the DOM: `li[data-state="open"]` (Radix
  `Toast` root) inside the viewport whose full markup is
  `<div role="region" aria-label="Notifications (F8)" tabindex="-1" ...><ol tabindex="-1"
  class="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0
  sm:top-auto sm:flex-col md:max-w-[420px]">…</ol></div>`, carrying the destructive variant
  (`border-destructive bg-destructive text-destructive-foreground`), its title in
  `div.text-sm.font-semibold` ("Probe title") and its description in `div.text-sm.opacity-90`
  ("Probe description"), measured 388×94 at the viewport's bottom-right corner.
- click **+49 ms** — the live region carries the title and description text:
  `[role="status"][aria-live="assertive"]` text `"Notification Probe titleProbe description"`.
  Radix removes that announce node by design at ~1 s (`isAnnounced`), which is the `+1021 ms`
  transition back to zero; the toast itself stays (`TOAST_REMOVE_DELAY` is 1000000 ms).
- Counts at rest: **one** `[role="region"][aria-label^="Notifications"]`, **one** `ol[tabindex="-1"]`
  viewport, **one** `li[data-state]` — i.e. exactly one Toaster in the tree and no duplicate toast.

## 3. Acceptance criteria

| # | Criterion | Result |
| --- | --- | --- |
| 1 | A `toast()` call from the app's own hook renders | **PASS** — `li[data-state="open"]` present 4 ms after the click carrying exactly the title/description text, and `[role="status"]` announces it at +49 ms (quoted in §2). Caveat recorded below (§5.1): the destructive variant's text is currently the same colour as its background in the light theme, so the *pixels* are invisible even though the DOM text is present. |
| 2 | Measured on a public, unauthenticated route | **PASS** — the toast was fired from a public route (`/toast-probe`) served by `next start`, and the mount itself is present on the repo's own public routes: `/login` 1 region + 1 viewport, `/signup` 1 region + 1 viewport, both with an empty console. `/dashboard` (behind `AuthGuard`) was not touched. |
| 3 | No hydration warning | **PASS** — see §4. |
| 4 | No toast rendered twice | **PASS** — `notifications_regions: 1`, `toast_viewports: 1`, `toasts: 1` at rest; the `[role="status"]` node count is likewise 1 for the one toast, and 0 when there is none (checked on `/login` and `/signup`, clean build). |

## 4. Hydration check (criterion 3)

Method: a recorder was injected with `Page.addScriptToEvaluateOnNewDocument` — it runs **before any
page script**, so it wraps `console.error` / `console.warn` and listens for `window` `error` events
from the first byte of every navigation. It was self-tested in-page (a deliberate `console.error`
was captured), so an empty log is a real zero and not a broken hook.

- `/login`, clean build: `CONSOLE: [{"level":"error","text":"__control__"}]` — the only entry is the
  self-test; no hydration error, warning or page error.
- `/signup`, clean build: `CONSOLE: []`.
- `/toast-probe` (harness build), through toast render: `CONSOLE: []`.
- React did hydrate the toast host rather than leaving server HTML inert:
  `Object.keys(region).filter(k => k.startsWith('__react'))` → `["__reactFiber$…", "__reactProps$…"]`,
  and the toast appeared only on a click (post-hydration), never in the raw click-path HTML.
- Why it cannot mismatch: `app/layout.tsx` has no `"use client"`; the Toaster's viewport markup is
  deterministic (the `aria-label` hotkey is derived from props, `hasToasts` is `false` in both the
  server render and the first client render), so the SSR output and the first client render agree.

## 5. Findings for the operator — recorded, not fixed, not filed

**5.1 The destructive toast's text is invisible in the light theme.** (Found here; fixed after the
operator's card 5 — see the note at the end of this section.) `app/globals.css:26-27` defines

```
--destructive:            oklch(0.577 0.245 27.325);
--destructive-foreground: oklch(0.577 0.245 27.325);
```

— the foreground is the background, so `text-destructive-foreground` on `bg-destructive` paints red
on red. Measured on the rendered toast: `getComputedStyle(li).backgroundColor` and the computed
`color` of both the title and the description resolve to the same value
(`lab(48.4493 77.4328 61.5452)`), and the screenshot
(`debug_reports/toast_mounted_probe_20261010.png`) shows a solid red box with the text invisible.
The DOM text is present and correctly announced to assistive tech, so criterion 1 holds, but the only
toast in the app (`app/dashboard/page.tsx:53`, variant `"destructive"`) will present to a clinician
as an unreadable red box. The dark theme's pair differs
(`--destructive: oklch(0.396 0.141 25.723)` / `--destructive-foreground: oklch(0.637 0.237 25.331)`)
but was not measured on screen. This is a token defect, not a mounting defect; it is not one of the
four deferred cards, so it is reported here for the operator to triage rather than fixed or filed.

**Fixed in card 5 (`t_7e8880de`, 2026-10-10, behind `9dcba1f` on `alan`).** The operator's card was
raised on this finding, so it has moved from "reported" to "resolved", measured on the same real
`next start` harness:

- `--destructive-foreground` is now `oklch(1 0 0)` in **both** themes — the `#ffffff` that the
  destructive `Button` and `Badge` already paint with a literal `text-white` — measuring **4.76:1** on
  the light `--destructive` (`#e7000b`) and **10.06:1** on the dark one (`#82181a`), against **1.00:1**
  and **2.63:1** before. `--destructive` itself is untouched.
- `ToastDescription` gained `group-[.destructive]:opacity-100`: its inherited `opacity-90` composites
  the description against the toast background and capped that node at **4.00:1** in the light theme,
  below the 4.5:1 body-text target, with no token value able to fix it (white is already the
  highest-contrast foreground on this red). Non-destructive toasts are unchanged.
- Rendered-pixel measurements (title and description sampled from the captured screenshots) and the
  before/after PNGs: `debug_reports/UI_DESTRUCTIVE_FOREGROUND_20261010.md`,
  `debug_reports/toast_destructive_{before,after}_{light,dark}_20261010.png`.
- New residual finding, recorded there and not filed: the toast's close icon
  (`group-[.destructive]:text-red-300`, `toast.tsx:80`) measures **2.48:1** on the light toast — below
  the 3:1 non-text threshold, and a different card's decision.

## 6. Gates and freeze

```
npx tsc --noEmit    exit 0
npm test            35/35 + 12/12 + 15/15 checks passed (62/62), exit 0
npm run build       ✓ Compiled successfully; 10 routes; exit 0
                    (the harness route is absent from this build: GET /toast-probe → 404)
```

`git ls-remote --heads origin alan` → `c6021602881baf5c69137579a4ac58ece7717966`, unchanged from
dispatch. No `git push`, no PR.

Harness hygiene: the temporary route was moved out of the tree before the commit
(`app/toast-probe/` no longer exists — `git status` shows only `app/layout.tsx`, `documentation.md`
and the pre-existing untracked `scratch/`); `next-env.d.ts` was restored after the builds flipped its
generated `/.next/dev/types` ↔ `/.next/types` reference; both `next start` listeners used by the
harness (3111, 3112) were terminated and no longer listen.
