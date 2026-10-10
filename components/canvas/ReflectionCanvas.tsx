"use client";

/**
 * components/canvas/ReflectionCanvas.tsx
 *
 * Responsive, iPad-optimised reflection and journaling canvas.
 *
 * ─── Pointer Events engine ────────────────────────────────────────────────
 * Uses native Pointer Events (not mouse / touch events) for:
 *   • Unified stylus + touch + mouse handling
 *   • Per-pointer pressure (e.pressure) mapped to stroke width
 *   • Stylus detection: e.pointerType === 'pen'
 *   • Palm rejection: CSS `touch-action: none` + pointerId capture
 *
 * ─── Drawing model ────────────────────────────────────────────────────────
 *   strokes[]  — committed history (undo = pop, redo = push back)
 *   liveStroke — the stroke being drawn right now (not yet in history)
 *
 * ─── Export pipeline ──────────────────────────────────────────────────────
 *   exportVectorData()   → serialisable CanvasVectorData (for progressive saves)
 *   exportAsImageBlob()  → compressed PNG/JPEG Blob ≤ 2 MB at ≤ 1 200 px wide
 *   uploadReflection()   → calls Worker POST /reflections/upload → Supabase Storage
 *
 * ─── Architecture guardrails ──────────────────────────────────────────────
 *   • No localStorage / sessionStorage
 *   • All uploads go through the Cloudflare Worker (apiFetch) — never directly
 *     to Supabase Storage from the browser
 * ─────────────────────────────────────────────────────────────────────────
 */

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/auth";
import { CLINICAL_AI_API_BASE } from "@/lib/clinical-ai-api";

import {
  Eraser,
  Loader2,
  Pen,
  Redo2,
  Trash2,
  Undo2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import {
  BACKGROUND_OPTIONS,
  STROKE_WIDTHS,
  STYLUS_STROKE_SCALE,
  type BackgroundType,
  type CanvasVectorData,
  type DrawTool,
  type Point,
  type Stroke,
  type UploadResult,
} from "./canvasTypes";

import {
  exportAsImageBlob,
  newStrokeId,
  redrawAll,
  renderStroke,
  serialiseVectorData,
} from "./canvasUtils";

// ---------------------------------------------------------------------------
// Imperative handle — exposed via ref
// ---------------------------------------------------------------------------

export interface ReflectionCanvasHandle {
  /** Returns the serialisable vector data (for progressive saves). */
  exportVectorData: () => CanvasVectorData;
  /** Compresses the canvas to a PNG/JPEG Blob ≤ 2 MB. */
  exportAsImageBlob: () => Promise<Blob>;
  /** Full pipeline: compress → upload to Supabase Storage via Worker. */
  uploadReflection: (submissionId: string, clientId: string) => Promise<UploadResult>;
  /** Returns true if the canvas has any drawn content. */
  hasContent: () => boolean;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReflectionCanvasProps {
  /** Initial vector data to restore (e.g. from a saved draft). */
  initialData?: CanvasVectorData;
  /** Called on every committed stroke — for auto-save of vector data. */
  onStrokeCommit?: (data: CanvasVectorData) => void;
  /** CSS class forwarded to the root container. */
  className?: string;
  /** Identifies the owning client for the reflection. */
  clientId?: string;
  /** Optional submissionId linking this reflection to a practice task submission. */
  submissionId?: string | null;
}

// ---------------------------------------------------------------------------
// Pen colour
// ---------------------------------------------------------------------------

const PEN_COLOR = "#1a1d28"; // near-black ink — adapts via compositing in dark mode

// ---------------------------------------------------------------------------
// Toolbar button primitive
// ---------------------------------------------------------------------------

interface ToolbarBtnProps {
  label: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ToolbarBtn({ label, active, danger, disabled, onClick, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
        "disabled:pointer-events-none disabled:opacity-35",
        active
          ? "bg-slate-800 text-white shadow-inner"
          : danger
          ? "text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60"
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Toolbar separator
// ---------------------------------------------------------------------------

function ToolbarSep() {
  return (
    <div className="mx-0.5 h-6 w-px bg-slate-200 dark:bg-slate-700" role="separator" />
  );
}

// ---------------------------------------------------------------------------
// Status pill
// ---------------------------------------------------------------------------

type UploadStatus = "idle" | "compressing" | "uploading" | "done" | "error";

function StatusPill({ status, error }: { status: UploadStatus; error?: string }) {
  if (status === "idle") return null;

  const configs: Record<
    Exclude<UploadStatus, "idle">,
    { icon: React.ReactNode; text: string; cls: string }
  > = {
    compressing: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      text: "Compressing…",
      cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    },
    uploading: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      text: "Uploading…",
      cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
    },
    done: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      text: "Saved",
      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    },
    error: {
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      text: error ?? "Upload failed",
      cls: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
    },
  };

  const { icon, text, cls } = configs[status];

  return (
    <div
      role={status === "error" ? "alert" : "status"}
      aria-live="polite"
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
        cls
      )}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReflectionCanvas
// ---------------------------------------------------------------------------

const ReflectionCanvas = React.forwardRef<
  ReflectionCanvasHandle,
  ReflectionCanvasProps
>(function ReflectionCanvas({ initialData, onStrokeCommit, className, clientId, submissionId }, ref) {
  // ── Canvas refs ──────────────────────────────────────────────────────────
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Drawing state ────────────────────────────────────────────────────────
  const [tool,       setTool]       = useState<DrawTool>("pen");
  const [strokePxIdx, setStrokePxIdx] = useState(1);          // index into STROKE_WIDTHS
  const [background, setBackground] = useState<BackgroundType>(
    initialData?.background ?? "blank"
  );
  const [isDark, setIsDark]         = useState(false);

  // Committed history + redo stack — kept in refs to avoid re-render churn
  const strokesRef = useRef<Stroke[]>(initialData?.strokes ?? []);
  const redoRef    = useRef<Stroke[]>([]);

  // Live stroke being drawn
  const liveStrokeRef = useRef<Stroke | null>(null);

  // Whether any pointer is currently down (for palm rejection)
  const activePointerRef = useRef<number | null>(null);

  // Force re-render only for UI counters (undo/redo availability)
  const [historyLen, setHistoryLen] = useState(strokesRef.current.length);
  const [redoLen,    setRedoLen]    = useState(0);

  // ── Upload state ─────────────────────────────────────────────────────────
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadError,  setUploadError]  = useState<string | undefined>();

  // ── Dark mode detection ──────────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Canvas sizing (ResizeObserver) ───────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (!width || !height) return;

      // Preserve content across resize using an offscreen snapshot
      const tempCanvas  = document.createElement("canvas");
      tempCanvas.width  = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx     = tempCanvas.getContext("2d")!;
      tempCtx.drawImage(canvas, 0, 0);

      // Resize (this clears the canvas)
      const dpr    = window.devicePixelRatio || 1;
      canvas.width  = width  * dpr;
      canvas.height = height * dpr;
      canvas.style.width  = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);

      // Full redraw from vector data
      redrawAll(
        ctx,
        width,
        height,
        background,
        strokesRef.current,
        isDark
      );
    });

    ro.observe(container);
    return () => ro.disconnect();
    // background / isDark changes handled separately below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Redraw on background or dark-mode change ─────────────────────────────
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    redrawAll(
      ctx,
      canvas.width  / dpr,
      canvas.height / dpr,
      background,
      strokesRef.current,
      isDark
    );
  }, [background, isDark]);

  useEffect(() => { redrawCanvas(); }, [redrawCanvas]);

  // ── DPR-aware coordinate helper ──────────────────────────────────────────
  const toCanvasCoords = useCallback(
    (e: PointerEvent): Point => {
      const canvas = canvasRef.current!;
      const rect   = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: e.pressure > 0 ? e.pressure : undefined,
      };
    },
    []
  );

  // ── Effective stroke width (accounts for stylus scale + tool) ────────────
  const effectiveWidth = useCallback(
    (e: PointerEvent): number => {
      const base = STROKE_WIDTHS[strokePxIdx].px;
      if (tool === "eraser") return base * 4;      // eraser is always fat
      return e.pointerType === "pen"
        ? base * STYLUS_STROKE_SCALE
        : base;
    },
    [tool, strokePxIdx]
  );

  // ── Pointer event handlers ────────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      // Palm rejection: only one active pointer at a time
      if (activePointerRef.current !== null) return;

      // Only accept pen or mouse; reject bare-finger touch that looks like a palm
      if (e.pointerType === "touch" && e.width > 50) return; // fat contact = palm

      e.preventDefault();
      canvasRef.current?.setPointerCapture(e.pointerId);
      activePointerRef.current = e.pointerId;

      const pt = toCanvasCoords(e);
      const stroke: Stroke = {
        id:     newStrokeId(),
        tool,
        color:  PEN_COLOR,
        width:  effectiveWidth(e),
        points: [pt],
      };
      liveStrokeRef.current = stroke;

      // Draw the starting dot
      const canvas = canvasRef.current!;
      const ctx    = canvas.getContext("2d")!;
      renderStroke(ctx, stroke);
    },
    [tool, toCanvasCoords, effectiveWidth]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (activePointerRef.current !== e.pointerId) return;
      if (!liveStrokeRef.current) return;

      e.preventDefault();

      const pt     = toCanvasCoords(e);
      const stroke = liveStrokeRef.current;
      stroke.points.push(pt);

      // Incremental render: just draw the latest segment
      const canvas = canvasRef.current!;
      const ctx    = canvas.getContext("2d")!;
      renderStroke(ctx, { ...stroke, points: stroke.points.slice(-3) });
    },
    [toCanvasCoords]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (activePointerRef.current !== e.pointerId) return;

      e.preventDefault();
      canvasRef.current?.releasePointerCapture(e.pointerId);
      activePointerRef.current = null;

      const stroke = liveStrokeRef.current;
      if (!stroke || stroke.points.length < 1) {
        liveStrokeRef.current = null;
        return;
      }

      // Commit stroke to history
      strokesRef.current = [...strokesRef.current, stroke];
      redoRef.current    = [];                              // any redo branch is lost
      liveStrokeRef.current = null;

      setHistoryLen(strokesRef.current.length);
      setRedoLen(0);

      // Notify parent for progressive save
      const canvas = canvasRef.current!;
      const dpr    = window.devicePixelRatio || 1;
      onStrokeCommit?.(
        serialiseVectorData(
          canvas.width  / dpr,
          canvas.height / dpr,
          background,
          strokesRef.current
        )
      );
    },
    [background, onStrokeCommit]
  );

  // ── Attach / detach pointer listeners on canvas ──────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup",   handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerUp);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup",   handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp]);

  // ── Undo ─────────────────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (!strokesRef.current.length) return;
    const popped = strokesRef.current[strokesRef.current.length - 1];
    strokesRef.current = strokesRef.current.slice(0, -1);
    redoRef.current    = [popped, ...redoRef.current];
    setHistoryLen(strokesRef.current.length);
    setRedoLen(redoRef.current.length);
    redrawCanvas();
  }, [redrawCanvas]);

  // ── Redo ─────────────────────────────────────────────────────────────────
  const handleRedo = useCallback(() => {
    if (!redoRef.current.length) return;
    const [next, ...rest] = redoRef.current;
    strokesRef.current = [...strokesRef.current, next];
    redoRef.current    = rest;
    setHistoryLen(strokesRef.current.length);
    setRedoLen(redoRef.current.length);
    redrawCanvas();
  }, [redrawCanvas]);

  // ── Clear ─────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    strokesRef.current = [];
    redoRef.current    = [];
    setHistoryLen(0);
    setRedoLen(0);
    redrawCanvas();
  }, [redrawCanvas]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target !== document.body && e.target !== document.documentElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.shiftKey ? handleRedo() : handleUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  // ── Imperative handle ─────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    exportVectorData(): CanvasVectorData {
      const canvas = canvasRef.current!;
      const dpr    = window.devicePixelRatio || 1;
      return serialiseVectorData(
        canvas.width  / dpr,
        canvas.height / dpr,
        background,
        strokesRef.current
      );
    },

    async exportAsImageBlob(): Promise<Blob> {
      return exportAsImageBlob(canvasRef.current!);
    },

    async uploadReflection(
      submissionIdParam?: string,
      clientIdParam?: string
    ): Promise<UploadResult> {
      const activeSubmissionId = submissionIdParam || submissionId;
      const activeClientId = clientIdParam || clientId;
      if (!activeSubmissionId || !activeClientId) {
        throw new Error("Missing submissionId or clientId for reflection upload");
      }
      setUploadError(undefined);
      setUploadStatus("compressing");

      let blob: Blob;
      try {
        blob = await exportAsImageBlob(canvasRef.current!);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Compression failed";
        setUploadError(msg);
        setUploadStatus("error");
        throw err;
      }

      setUploadStatus("uploading");

      try {
        const formData = new FormData();
        formData.append("file", blob, `reflection-${Date.now()}.png`);
        formData.append("submission_id", activeSubmissionId);
        formData.append("client_id",     activeClientId);

        const res = await apiFetch(
          `${CLINICAL_AI_API_BASE}/reflections/upload`,
          { method: "POST", body: formData }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }

        const result = await res.json() as UploadResult;
        setUploadStatus("done");
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setUploadError(msg);
        setUploadStatus("error");
        throw err;
      }
    },

    hasContent(): boolean {
      return strokesRef.current.length > 0;
    },
  }), [background]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border border-slate-200",
        "bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900",
        className
      )}
    >
      {/* ── Floating toolbar ──────────────────────────────────────────────── */}
      <div
        role="toolbar"
        aria-label="Drawing tools"
        className={cn(
          // Floating pill positioned at the top centre
          "absolute left-1/2 top-3 z-20 -translate-x-1/2",
          "flex items-center gap-0.5 rounded-xl px-2 py-1.5",
          "bg-white/90 shadow-lg shadow-slate-200/60 backdrop-blur-md",
          "border border-slate-100 dark:border-slate-700",
          "dark:bg-slate-800/90 dark:shadow-slate-900/60"
        )}
      >
        {/* Tool: Pen */}
        <ToolbarBtn
          label="Pen"
          active={tool === "pen"}
          onClick={() => setTool("pen")}
        >
          <Pen className="h-4 w-4" />
        </ToolbarBtn>

        {/* Tool: Eraser */}
        <ToolbarBtn
          label="Eraser"
          active={tool === "eraser"}
          onClick={() => setTool("eraser")}
        >
          <Eraser className="h-4 w-4" />
        </ToolbarBtn>

        <ToolbarSep />

        {/* Stroke width selector */}
        {STROKE_WIDTHS.map((sw, i) => (
          <ToolbarBtn
            key={sw.label}
            label={`Stroke: ${sw.label}`}
            active={tool !== "eraser" && strokePxIdx === i}
            onClick={() => { setStrokePxIdx(i); setTool("pen"); }}
          >
            <span
              className={cn(
                "block rounded-full bg-current transition-all",
                // Visually vary the dot size per width option
                i === 0 ? "h-1.5 w-1.5" : i === 1 ? "h-2.5 w-2.5" : "h-4 w-4"
              )}
            />
          </ToolbarBtn>
        ))}

        <ToolbarSep />

        {/* Background toggles */}
        {BACKGROUND_OPTIONS.map((bg) => (
          <ToolbarBtn
            key={bg.id}
            label={`Background: ${bg.label}`}
            active={background === bg.id}
            onClick={() => setBackground(bg.id)}
          >
            <span className="font-mono text-xs leading-none">{bg.icon}</span>
          </ToolbarBtn>
        ))}

        <ToolbarSep />

        {/* Undo */}
        <ToolbarBtn
          label={`Undo (${historyLen})`}
          disabled={historyLen === 0}
          onClick={handleUndo}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarBtn>

        {/* Redo */}
        <ToolbarBtn
          label={`Redo (${redoLen})`}
          disabled={redoLen === 0}
          onClick={handleRedo}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarBtn>

        <ToolbarSep />

        {/* Clear */}
        <ToolbarBtn
          label="Clear canvas"
          danger
          disabled={historyLen === 0}
          onClick={handleClear}
        >
          <Trash2 className="h-4 w-4" />
        </ToolbarBtn>

        {/* Upload status */}
        <div className="ml-1">
          <StatusPill status={uploadStatus} error={uploadError} />
        </div>
      </div>

      {/* ── Drawing surface ───────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="relative flex-1"
        // Minimum height ensures canvas is usable before ResizeObserver fires
        style={{ minHeight: "420px" }}
      >
        <canvas
          ref={canvasRef}
          aria-label="Reflection canvas — use a stylus or finger to draw"
          style={{
            // Palm rejection: browser must not intercept pointer events
            touchAction: "none",
            // Crisp rendering for handwriting
            imageRendering: "pixelated",
            cursor: tool === "eraser" ? "cell" : "crosshair",
            display: "block",
            width:  "100%",
            height: "100%",
          }}
        />
      </div>

      {/* ── Bottom status bar ─────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center justify-between border-t border-slate-100 px-4 py-2",
          "bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/50"
        )}
      >
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          {historyLen === 0
            ? "Draw with a stylus, finger, or mouse"
            : `${historyLen} stroke${historyLen !== 1 ? "s" : ""}`}
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          ⌘Z undo · ⌘⇧Z redo
        </p>
      </div>
    </div>
  );
});

ReflectionCanvas.displayName = "ReflectionCanvas";
export default ReflectionCanvas;
export type { ReflectionCanvasProps };
