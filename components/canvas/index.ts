/**
 * components/canvas/index.ts
 *
 * Public barrel for the reflection-canvas module.
 */

export { default as ReflectionCanvas } from "./ReflectionCanvas";
export type { ReflectionCanvasHandle, ReflectionCanvasProps } from "./ReflectionCanvas";

export { exportAsImageBlob, serialiseVectorData, deserialiseVectorData } from "./canvasUtils";

export {
  BACKGROUND_OPTIONS,
  STROKE_WIDTHS,
  EXPORT_MAX_WIDTH_PX,
  EXPORT_MAX_SIZE_BYTES,
} from "./canvasTypes";
export type {
  BackgroundType,
  CanvasVectorData,
  DrawTool,
  Stroke,
  Point,
  UploadResult,
} from "./canvasTypes";
