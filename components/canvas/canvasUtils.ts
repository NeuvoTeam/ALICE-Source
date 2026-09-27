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
// Background rendering
// ---------------------------------------------------------------------------

const LINE_SPACING = 28;         // px between ruled lines
const DOT_SPACING  = 24;         // px between dot-grid dots
const DOT_RADIUS   = 1.2;        // px dot radius

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
  const bgColour  = isDark ? "#1a1d21" : "#ffffff";
  const inkColour = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";

  ctx.fillStyle = bgColour;
  ctx.fillRect(0, 0, width, height);

  if (background === "blank") return;

  ctx.strokeStyle = inkColour;
  ctx.fillStyle   = inkColour;

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

// ---------------------------------------------------------------------------
// Stroke rendering
// ---------------------------------------------------------------------------

/**
 * Render a single stroke onto a canvas context using quadratic Bézier
 * interpolation for smooth curves. Pressure is mapped to line width.
 */
export function renderStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke
): void {
  if (stroke.points.length < 2) return;

  ctx.save();

  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
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
  const prev = pts[pts.length - 2];
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
    renderStroke(ctx, stroke);
  }
}

// ---------------------------------------------------------------------------
// Image compression + export
// ---------------------------------------------------------------------------

/**
 * Render the canvas to an offscreen canvas capped at EXPORT_MAX_WIDTH_PX,
 * then compress to a PNG blob. If the PNG exceeds EXPORT_MAX_SIZE_BYTES,
 * falls back to JPEG at successively lower quality levels.
 *
 * @returns A compressed Blob ready for upload.
 * @throws  If the blob cannot be made below the size limit even at minimum quality.
 */
export async function exportAsImageBlob(
  sourceCanvas: HTMLCanvasElement
): Promise<Blob> {
  const scale = Math.min(1, EXPORT_MAX_WIDTH_PX / sourceCanvas.width);
  const exportW = Math.round(sourceCanvas.width  * scale);
  const exportH = Math.round(sourceCanvas.height * scale);

  const offscreen = document.createElement("canvas");
  offscreen.width  = exportW;
  offscreen.height = exportH;

  const ctx = offscreen.getContext("2d")!;
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
