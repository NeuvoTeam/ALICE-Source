/**
 * Regression tests for the Reflection Canvas pad redesign.
 *
 * Implements the six regression tests specified in section 9 of
 * `docs/design/2026-10-11 - Reflection Canvas Pad Spec.md`:
 *
 *   1. drawBackground(ctx, w, h, "blank", false) fills every pixel #FBFAF7 (early return skips guides only)
 *   2. Ink-on-paper contrast >= 4.5:1 in both light (#FBFAF7) and dark (#EDE9E1) themes
 *   3. Eraser stroke over ink restores paper colour and leaves alpha 255 (source-over)
 *   4. exportAsImageBlob on fully erased canvas yields an opaque paper-coloured image
 *   5. Bare <ReflectionCanvas /> and defaultBackground="dotted" paint different backgrounds on first paint
 *   6. Toolbar renders no "□", "≡", or "⋯" text nodes
 *
 *   npm test            -> node tests/worker.test.mjs && node tests/pdf-export.test.mjs
 *                          && node tests/hydration-guard.test.mjs && node tests/canvas-pad.test.mjs
 *   npm run test:canvas -> node tests/canvas-pad.test.mjs
 *
 * Node environment limitation note:
 * Pure Node.js lacks native GPU/Canvas rasterisation and pixel buffers (getImageData()).
 * Tests drive the pure canvas utilities via a recording stub 2D context capturing fillStyle,
 * fillRect, strokeStyle, globalCompositeOperation, and execution call order.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

import {
  PAPER_LIGHT,
  PAPER_DARK,
  PEN_COLOR,
  GUIDE_LIGHT,
  GUIDE_DARK,
  drawBackground,
  drawPaper,
  drawGuides,
  renderStroke,
  redrawAll,
  exportAsImageBlob,
} from "../components/canvas/canvasUtils.ts"

import {
  BACKGROUND_OPTIONS,
} from "../components/canvas/canvasTypes.ts"

/**
 * Recording stub 2D context tracking canvas operations, styles, and call order.
 */
function createRecordingContext() {
  const calls = []
  return {
    calls,
    fillStyle: "#000000",
    strokeStyle: "#000000",
    globalCompositeOperation: "source-over",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    fillRect(x, y, w, h) {
      calls.push({
        type: "fillRect",
        x,
        y,
        w,
        h,
        fillStyle: this.fillStyle,
        globalCompositeOperation: this.globalCompositeOperation,
      })
    },
    clearRect(x, y, w, h) {
      calls.push({ type: "clearRect", x, y, w, h })
    },
    beginPath() {
      calls.push({ type: "beginPath" })
    },
    moveTo(x, y) {
      calls.push({ type: "moveTo", x, y })
    },
    lineTo(x, y) {
      calls.push({ type: "lineTo", x, y })
    },
    arc(x, y, r, startAngle, endAngle) {
      calls.push({ type: "arc", x, y, r, startAngle, endAngle })
    },
    stroke() {
      calls.push({
        type: "stroke",
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
        globalCompositeOperation: this.globalCompositeOperation,
      })
    },
    fill() {
      calls.push({
        type: "fill",
        fillStyle: this.fillStyle,
        globalCompositeOperation: this.globalCompositeOperation,
      })
    },
    save() {
      calls.push({ type: "save" })
    },
    restore() {
      calls.push({ type: "restore" })
    },
    quadraticCurveTo(cpx, cpy, x, y) {
      calls.push({ type: "quadraticCurveTo", cpx, cpy, x, y })
    },
    scale(sx, sy) {
      calls.push({ type: "scale", sx, sy })
    },
    drawImage(image, ...args) {
      calls.push({
        type: "drawImage",
        image,
        args,
        fillStyle: this.fillStyle,
        globalCompositeOperation: this.globalCompositeOperation,
      })
    },
  }
}

let passed = 0

function pass(label, extra = "") {
  passed += 1
  console.log(`PASS  ${passed} ${label}${extra ? "  " + extra : ""}`)
}

async function main() {
  /* 1. drawBackground fills canvas with paper colour; early return skips guides only. */
  const ctxLight = createRecordingContext()
  drawBackground(ctxLight, 800, 600, "blank", false)

  const lightFill = ctxLight.calls.find(
    (c) => c.type === "fillRect" && c.x === 0 && c.y === 0 && c.w === 800 && c.h === 600
  )
  assert.ok(
    lightFill,
    "drawBackground with 'blank' must fill the entire canvas with paper color"
  )
  assert.equal(
    lightFill.fillStyle,
    PAPER_LIGHT,
    `light blank pad must fill with PAPER_LIGHT (#FBFAF7), got ${lightFill?.fillStyle}`
  )
  assert.equal(
    PAPER_LIGHT,
    "#FBFAF7",
    "PAPER_LIGHT token must be #FBFAF7"
  )

  // Verify that guide strokes/arcs were skipped because background === "blank"
  const guideCalls = ctxLight.calls.filter(
    (c) => c.type === "stroke" || c.type === "arc" || c.type === "fill"
  )
  assert.equal(
    guideCalls.length,
    0,
    "blank background early return must skip guides, not the paper fill"
  )

  // Also verify dark mode blank fill
  const ctxDark = createRecordingContext()
  drawBackground(ctxDark, 800, 600, "blank", true)
  const darkFill = ctxDark.calls.find(
    (c) => c.type === "fillRect" && c.x === 0 && c.y === 0 && c.w === 800 && c.h === 600
  )
  assert.ok(darkFill, "dark theme blank pad must fill entire canvas with paper color")
  assert.equal(
    darkFill.fillStyle,
    PAPER_DARK,
    `dark blank pad must fill with PAPER_DARK (#EDE9E1), got ${darkFill?.fillStyle}`
  )
  assert.equal(
    PAPER_DARK,
    "#EDE9E1",
    "PAPER_DARK token must be #EDE9E1"
  )
  pass("drawBackground: fills every pixel with paper (#FBFAF7 / #EDE9E1); early return skips guides only")

  /* 2. Ink-on-paper contrast >= 4.5:1 in both themes. */
  function hexToRgb(hex) {
    const clean = hex.replace("#", "").trim()
    const num = parseInt(clean, 16)
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
  }

  function relativeLuminance(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => {
      const s = v / 255
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  function contrastRatio(hex1, hex2) {
    const l1 = relativeLuminance(hex1)
    const l2 = relativeLuminance(hex2)
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)
  }

  const contrastLight = contrastRatio(PEN_COLOR, PAPER_LIGHT)
  const contrastDark = contrastRatio(PEN_COLOR, PAPER_DARK)

  assert.ok(
    contrastLight >= 4.5,
    `ink-on-paper contrast in light mode must be >= 4.5:1 (got ${contrastLight.toFixed(2)}:1)`
  )
  assert.ok(
    contrastDark >= 4.5,
    `ink-on-paper contrast in dark mode must be >= 4.5:1 (got ${contrastDark.toFixed(2)}:1)`
  )
  pass(
    "contrast: ink-on-paper >= 4.5:1 in both themes",
    `light ${contrastLight.toFixed(2)}:1, dark ${contrastDark.toFixed(2)}:1`
  )

  /* 3. Eraser stroke over ink restores the paper colour and leaves alpha 255. */
  // Limitation: Node environment lacks a native GPU/canvas rasterizer for getImageData().
  // Verified via stub context:
  // (a) globalCompositeOperation is "source-over" rather than defect's "destination-out" (which punched alpha holes);
  // (b) strokeStyle / fillStyle is set to opaque paper token (#FBFAF7 / #EDE9E1), which are 24-bit RGB solid hex tokens (alpha 255).
  const eraserStroke = {
    id: "stroke-eraser-1",
    tool: "eraser",
    color: PEN_COLOR,
    width: 16,
    points: [
      { x: 10, y: 10, pressure: 0.5 },
      { x: 50, y: 50, pressure: 0.5 },
    ],
  }

  // Light theme eraser
  const ctxEraseLight = createRecordingContext()
  renderStroke(ctxEraseLight, eraserStroke, false)

  assert.equal(
    ctxEraseLight.globalCompositeOperation,
    "source-over",
    "eraser must use source-over compositing to paint paper"
  )
  assert.notEqual(
    ctxEraseLight.globalCompositeOperation,
    "destination-out",
    "eraser must not use destination-out (punching alpha holes)"
  )
  assert.equal(
    ctxEraseLight.strokeStyle,
    PAPER_LIGHT,
    "eraser strokeStyle must match PAPER_LIGHT (#FBFAF7) in light mode"
  )

  // Dark theme eraser
  const ctxEraseDark = createRecordingContext()
  renderStroke(ctxEraseDark, eraserStroke, true)

  assert.equal(
    ctxEraseDark.globalCompositeOperation,
    "source-over",
    "eraser in dark mode must use source-over"
  )
  assert.equal(
    ctxEraseDark.strokeStyle,
    PAPER_DARK,
    "eraser strokeStyle must match PAPER_DARK (#EDE9E1) in dark mode"
  )

  // Single-point dot eraser
  const singleDotEraser = {
    id: "stroke-dot-eraser",
    tool: "eraser",
    color: PEN_COLOR,
    width: 16,
    points: [{ x: 20, y: 20, pressure: 0.5 }],
  }
  const ctxDot = createRecordingContext()
  renderStroke(ctxDot, singleDotEraser, false)
  const fillCall = ctxDot.calls.find((c) => c.type === "fill")
  assert.ok(fillCall, "single-point dot eraser must execute fill()")
  assert.equal(
    fillCall.fillStyle,
    PAPER_LIGHT,
    "single-point eraser fillStyle must be PAPER_LIGHT"
  )
  pass("eraser: restores paper colour (#FBFAF7/#EDE9E1) via source-over (alpha 255, no destination-out)")

  /* 4. exportAsImageBlob on fully erased canvas yields an opaque paper-coloured image. */
  // Limitation: Node environment has no native Canvas/GPU rasterization or pixel buffer to inspect
  // with getImageData(0,0,1,1).data[3] === 255; verified via offscreen recording context that opaque
  // paper fillRect (#FBFAF7/#EDE9E1) executes over entire export dimensions strictly before drawImage.
  let lastOffscreenCtx = null
  globalThis.document = {
    createElement(tagName) {
      if (tagName === "canvas") {
        const ctx = createRecordingContext()
        lastOffscreenCtx = ctx
        return {
          width: 0,
          height: 0,
          getContext: (type) => (type === "2d" ? ctx : null),
          toBlob: (callback, mime, quality) => {
            const blob = new Blob(["mock-image-bytes"], { type: mime || "image/png" })
            callback(blob)
          },
        }
      }
      throw new Error(`Unexpected createElement(${tagName}) in test harness`)
    },
  }

  const dummyCanvas = { width: 800, height: 600 }

  // Light export
  const blobLight = await exportAsImageBlob(dummyCanvas, false)
  assert.ok(blobLight, "exportAsImageBlob must return a Blob")
  assert.equal(blobLight.type, "image/png")

  assert.ok(lastOffscreenCtx, "offscreen canvas context must have been created")
  const fillRectIdx = lastOffscreenCtx.calls.findIndex((c) => c.type === "fillRect")
  const drawImageIdx = lastOffscreenCtx.calls.findIndex((c) => c.type === "drawImage")

  assert.ok(
    fillRectIdx !== -1,
    "exportAsImageBlob must fill offscreen canvas with paper background"
  )
  assert.ok(
    drawImageIdx !== -1,
    "exportAsImageBlob must draw sourceCanvas onto offscreen canvas"
  )
  assert.ok(
    fillRectIdx < drawImageIdx,
    "paper background fillRect must execute strictly BEFORE drawImage to guarantee opaque export"
  )
  assert.equal(
    lastOffscreenCtx.calls[fillRectIdx].fillStyle,
    PAPER_LIGHT,
    "export background fill must be PAPER_LIGHT (#FBFAF7) in light theme"
  )
  assert.equal(lastOffscreenCtx.calls[fillRectIdx].w, 800)
  assert.equal(lastOffscreenCtx.calls[fillRectIdx].h, 600)

  // Dark export
  const blobDark = await exportAsImageBlob(dummyCanvas, true)
  assert.ok(blobDark)
  const darkFillIdx = lastOffscreenCtx.calls.findIndex((c) => c.type === "fillRect")
  assert.ok(darkFillIdx !== -1, "dark mode export must fill background")
  assert.equal(
    lastOffscreenCtx.calls[darkFillIdx].fillStyle,
    PAPER_DARK,
    "dark mode export background fill must be PAPER_DARK (#EDE9E1)"
  )
  pass("export: exportAsImageBlob fills offscreen canvas with paper colour before drawImage (opaque image)")

  /* 5. Bare <ReflectionCanvas /> and defaultBackground="dotted" paint different backgrounds on first paint. */
  // The component seeds background state from:
  // initialData?.background ?? defaultBackground ?? "blank"
  const resolveBackground = (initialData, defaultBackground) =>
    initialData?.background ?? defaultBackground ?? "blank"

  const bareBg = resolveBackground(undefined, undefined)
  const dottedBg = resolveBackground(undefined, "dotted")
  const linedBg = resolveBackground(undefined, "lined")
  const initialWinsBg = resolveBackground({ background: "lined" }, "dotted")

  assert.equal(bareBg, "blank", "bare canvas must resolve default background to 'blank'")
  assert.equal(dottedBg, "dotted", "defaultBackground='dotted' must resolve to 'dotted'")
  assert.equal(linedBg, "lined", "defaultBackground='lined' must resolve to 'lined'")
  assert.equal(initialWinsBg, "lined", "initialData.background must take precedence over defaultBackground")

  // First paint: bare canvas ("blank") vs dotted canvas ("dotted")
  const bareCtx = createRecordingContext()
  drawBackground(bareCtx, 800, 600, bareBg, false)

  const dottedCtx = createRecordingContext()
  drawBackground(dottedCtx, 800, 600, dottedBg, false)

  assert.notDeepEqual(
    bareCtx.calls,
    dottedCtx.calls,
    "bare canvas and dotted canvas must paint different background operations on first paint"
  )
  const bareArcs = bareCtx.calls.filter((c) => c.type === "arc")
  const dottedArcs = dottedCtx.calls.filter((c) => c.type === "arc")
  assert.equal(bareArcs.length, 0, "bare blank canvas has 0 dot guide arcs on first paint")
  assert.ok(dottedArcs.length > 50, `dotted canvas renders dot-grid guides (${dottedArcs.length} dots) on first paint`)

  // Statically assert component wiring in ReflectionCanvas.tsx
  const componentSource = readFileSync(
    new URL("../components/canvas/ReflectionCanvas.tsx", import.meta.url),
    "utf8"
  )
  // THIS regex is the real guard for the background-wiring property, and the
  // local resolveBackground helper above it is illustrative only and cannot catch a change in the component.
  assert.match(
    componentSource,
    /defaultBackground\?: BackgroundType/,
    "ReflectionCanvasProps must declare defaultBackground?: BackgroundType"
  )
  assert.match(
    componentSource,
    /initialData\?\.background\s*\?\?\s*defaultBackground\s*\?\?\s*["']blank["']/,
    "ReflectionCanvas state must seed from initialData?.background ?? defaultBackground ?? 'blank'"
  )
  pass(
    "background wiring: bare canvas ('blank') and defaultBackground='dotted' paint different backgrounds",
    `bare 0 dots, dotted ${dottedArcs.length} dots`
  )

  /* 6. Toolbar renders no "□", "≡" or "⋯" text nodes. */
  assert.equal(BACKGROUND_OPTIONS.length, 3, "BACKGROUND_OPTIONS must contain 3 options")
  for (const opt of BACKGROUND_OPTIONS) {
    assert.notEqual(
      typeof opt.icon,
      "string",
      `option ${opt.id} icon must not be a string`
    )
    assert.ok(
      (typeof opt.icon === "object" && typeof opt.icon?.render === "function") ||
        typeof opt.icon === "function",
      `option ${opt.id} icon must be a Lucide React component, not a text glyph`
    )
  }

  // THIS source scan is the real guard for the glyph property.
  const typesSource = readFileSync(
    new URL("../components/canvas/canvasTypes.ts", import.meta.url),
    "utf8"
  )
  const canvasSource = readFileSync(
    new URL("../components/canvas/ReflectionCanvas.tsx", import.meta.url),
    "utf8"
  )

  for (const glyph of ["□", "≡", "⋯"]) {
    assert.ok(
      !typesSource.includes(glyph),
      `canvasTypes.ts must not contain text glyph "${glyph}"`
    )
    assert.ok(
      !canvasSource.includes(glyph),
      `ReflectionCanvas.tsx must not contain text glyph "${glyph}"`
    )
  }
  pass("toolbar: BACKGROUND_OPTIONS uses Lucide components and renders no text glyphs (□, ≡, ⋯)")
}

const TOTAL_CHECKS = 6

main()
  .then(() => {
    if (passed !== TOTAL_CHECKS) {
      throw new Error(`${passed} checks ran but TOTAL_CHECKS is ${TOTAL_CHECKS}`)
    }
    console.log(`\n${passed}/${TOTAL_CHECKS} checks passed`)
  })
  .catch((err) => {
    console.error(`\nFAILED after ${passed} passing checks:\n`, err)
    process.exitCode = 1
  })
