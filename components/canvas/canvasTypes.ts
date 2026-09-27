/**
 * components/canvas/canvasTypes.ts
 *
 * Pure type definitions for the ReflectionCanvas domain.
 * No runtime code — safe to import in any context.
 */

// ---------------------------------------------------------------------------
// Drawing tools
// ---------------------------------------------------------------------------

export type DrawTool = "pen" | "eraser";

export interface StrokeWidth {
  label: string;
  px: number;
}

export const STROKE_WIDTHS: StrokeWidth[] = [
  { label: "Fine", px: 1.5 },
  { label: "Medium", px: 4 },
  { label: "Thick", px: 9 },
];

export const STYLUS_STROKE_SCALE = 2.2; // multiplier applied when pointerType === 'pen'

// ---------------------------------------------------------------------------
// Background types
// ---------------------------------------------------------------------------

export type BackgroundType = "blank" | "lined" | "dotted";

export interface BackgroundOption {
  id: BackgroundType;
  label: string;
  icon: string;
}

export const BACKGROUND_OPTIONS: BackgroundOption[] = [
  { id: "blank", label: "Blank", icon: "□" },
  { id: "lined", label: "Lined", icon: "≡" },
  { id: "dotted", label: "Dotted", icon: "⋯" },
];

// ---------------------------------------------------------------------------
// Path data (vector / progressive save)
// ---------------------------------------------------------------------------

/** A single captured pointer point. */
export interface Point {
  x: number;
  y: number;
  /** Normalised pressure 0–1 (undefined when device does not report). */
  pressure?: number;
}

/** A complete drawn stroke. */
export interface Stroke {
  id: string;
  tool: DrawTool;
  color: string;
  width: number;
  points: Point[];
}

/**
 * The serialisable vector state of the canvas.
 * Stored in `client_reflections.canvas_data` (JSONB).
 */
export interface CanvasVectorData {
  version: "1";
  background: BackgroundType;
  width: number;
  height: number;
  strokes: Stroke[];
}

// ---------------------------------------------------------------------------
// Upload result
// ---------------------------------------------------------------------------

export interface UploadResult {
  /** Public URL of the uploaded image in Supabase Storage. */
  imageUrl: string;
  /** Size in bytes of the blob that was uploaded. */
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Compression config
// ---------------------------------------------------------------------------

export const EXPORT_MAX_WIDTH_PX = 1200;
export const EXPORT_MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
export const EXPORT_MIME = "image/png" as const;
/** Quality steps to try when iterating under the size limit. */
export const JPEG_QUALITY_STEPS = [0.92, 0.80, 0.65, 0.50];
