/**
 * components/canvas/canvasUtils.ts
 *
 * Pure utility functions for the ReflectionCanvas.
 * All functions are side-effect-free and synchronous except where noted.
 */

import type {
  BackgroundType,
  CanvasVectorData,
  Stroke,
} from "./canvasTypes";

import {
  EXPORT_MAX_WIDTH_PX,
  EXPORT_MAX_SIZE_BYTES,
  EXPORT_MIME,
  JPEG_QUALITY_STEPS,
} from "./canvasTypes";

// ---------------------------------------------------------------------------
// Paper & guide tokens
// ---------------------------------------------------------------------------

export const PAPER_LIGHT = "#FBFAF7";
export const PAPER_DARK  = "#EDE9E1";
export const GUIDE_LIGHT = "rgba(31, 36, 48, 0.12)";
export const GUIDE_DARK  = "rgba(31, 36, 48, 0.16)";

export const LINE_SPACING = 28;         // px between ruled lines
export const DOT_SPACING  = 24;         // px between dot-grid dots
export const DOT_RADIUS   = 1.4;        // px dot radius (tuned for dimmed paper visibility)

/**
 * Fill the background with paper colour for the active theme.
 * The paper is dimmed in dark mode, never inverted.
 */
export function drawPaper(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isDark: boolean
): void {
  ctx.fillStyle = isDark ? PAPER_DARK : PAPER_LIGHT;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draw ruled lines or dot grid guide onto the canvas.
 * Guide colour is derived from dark ink for both light and dimmed paper.
 */
export function drawGuides(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: BackgroundType,
  isDark: boolean
): void {
  const guideColour = isDark ? GUIDE_DARK : GUIDE_LIGHT;
  ctx.strokeStyle = guideColour;
  ctx.fillStyle   = guideColour;

  if (background === "lined") {
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    // First line starts 1 spacing from the top
    for (let y = LINE_SPACING; y < height; y += LINE_SPACING) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  if (background === "dotted") {
    for (let x = DOT_SPACING; x < width; x += DOT_SPACING) {
      for (let y = DOT_SPACING; y < height; y += DOT_SPACING) {
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/**
 * Fill the background of an off-screen canvas with the given background type.
 * Called once on mount and whenever `background` changes.
 */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: BackgroundType,
  isDark: boolean
): void {
  drawPaper(ctx, width, height, isDark);
  if (background === "blank") return;
  drawGuides(ctx, width, height, background, isDark);
}

// ---------------------------------------------------------------------------
// Stroke rendering
// ---------------------------------------------------------------------------

/**
 * Render a single stroke onto a canvas context using quadratic Bézier
 * interpolation for smooth curves. Pressure is mapped to line width.
 * Eraser paints paper (source-over) rather than cutting alpha (destination-out).
 */
export function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  isDark: boolean = false
): void {
  if (stroke.points.length < 2) {
    if (stroke.points.length === 1) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = stroke.tool === "eraser"
        ? (isDark ? PAPER_DARK : PAPER_LIGHT)
        : stroke.color;
      const pt = stroke.points[0];
      const r = (stroke.width * (0.5 + (pt.pressure ?? 0.5) * 0.7)) / 2;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    return;
  }

  ctx.save();

  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = isDark ? PAPER_DARK : PAPER_LIGHT;
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.color;
  }

  ctx.lineCap    = "round";
  ctx.lineJoin   = "round";

  const pts = stroke.points;

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);

  for (let i = 1; i < pts.length - 1; i++) {
    const pressure = pts[i].pressure ?? 0.5;
    ctx.lineWidth  = stroke.width * (0.5 + pressure * 0.7);

    const midX = (pts[i].x + pts[i + 1].x) / 2;
    const midY = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(midX, midY);
  }

  // Last segment
  const last = pts[pts.length - 1];
  ctx.lineWidth = stroke.width * (0.5 + (last.pressure ?? 0.5) * 0.7);
  ctx.lineTo(last.x, last.y);
  ctx.stroke();

  ctx.restore();
}

/**
 * Re-render all strokes from scratch.
 * Called after undo / redo / clear.
 */
export function redrawAll(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: BackgroundType,
  strokes: Stroke[],
  isDark: boolean
): void {
  ctx.clearRect(0, 0, width, height);
  drawBackground(ctx, width, height, background, isDark);
  for (const stroke of strokes) {
    renderStroke(ctx, stroke, isDark);
  }
}

// ---------------------------------------------------------------------------
// Image compression + export
// ---------------------------------------------------------------------------

/**
 * Render the canvas to an offscreen canvas capped at EXPORT_MAX_WIDTH_PX,
 * composite with paper colour first to eliminate alpha, then compress to a PNG blob.
 * If the PNG exceeds EXPORT_MAX_SIZE_BYTES, falls back to JPEG at successively lower quality levels.
 *
 * @returns A compressed Blob ready for upload.
 * @throws  If the blob cannot be made below the size limit even at minimum quality.
 */
export async function exportAsImageBlob(
  sourceCanvas: HTMLCanvasElement,
  isDark: boolean = false
): Promise<Blob> {
  const scale = Math.min(1, EXPORT_MAX_WIDTH_PX / sourceCanvas.width);
  const exportW = Math.round(sourceCanvas.width  * scale);
  const exportH = Math.round(sourceCanvas.height * scale);

  const offscreen = document.createElement("canvas");
  offscreen.width  = exportW;
  offscreen.height = exportH;

  const ctx = offscreen.getContext("2d")!;
  ctx.fillStyle = isDark ? PAPER_DARK : PAPER_LIGHT;
  ctx.fillRect(0, 0, exportW, exportH);
  ctx.drawImage(sourceCanvas, 0, 0, exportW, exportH);

  // Try PNG first
  const pngBlob = await canvasToBlob(offscreen, EXPORT_MIME, 1);
  if (pngBlob && pngBlob.size <= EXPORT_MAX_SIZE_BYTES) return pngBlob;

  // Fall back to JPEG at decreasing quality
  for (const q of JPEG_QUALITY_STEPS) {
    const jpegBlob = await canvasToBlob(offscreen, "image/jpeg", q);
    if (jpegBlob && jpegBlob.size <= EXPORT_MAX_SIZE_BYTES) return jpegBlob;
  }

  throw new Error(
    `Canvas image cannot be compressed below ${EXPORT_MAX_SIZE_BYTES / (1024 * 1024)} MB even at lowest JPEG quality.`
  );
}

/** Promisified HTMLCanvasElement.toBlob */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

// ---------------------------------------------------------------------------
// Serialise / deserialise vector data
// ---------------------------------------------------------------------------

export function serialiseVectorData(
  width: number,
  height: number,
  background: BackgroundType,
  strokes: Stroke[]
): CanvasVectorData {
  return { version: "1", background, width, height, strokes };
}

export function deserialiseVectorData(raw: unknown): CanvasVectorData | null {
  if (
    typeof raw !== "object" ||
    raw === null ||
    (raw as Record<string, unknown>).version !== "1"
  ) {
    return null;
  }
  return raw as CanvasVectorData;
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

/** Generate a lightweight unique stroke ID (no uuid dependency). */
export function newStrokeId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
