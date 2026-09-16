/**
 * ALICE — programmatic A4 export of the client-facing practice package.
 *
 * The clinician's worksheet is exported as a *document*, not a screenshot: jsPDF's
 * vector API is driven directly so that
 *
 *   1. every colour is an explicit sRGB value — the UI's Tailwind v4 tokens are
 *      `oklch()`, which the rasteriser this replaced could not parse, and whose
 *      fallbacks (`color -> rgb(0,0,0)`, `background -> rgba(0,0,0,0)`) are where
 *      the colourless PDFs came from;
 *   2. page breaks are computed from `A4.CONTENT_BOTTOM` *before* a block is drawn,
 *      so rows can neither overlap nor fall off the page;
 *   3. the text stays crisp, selectable and print-accurate at any zoom.
 *
 * Scope is deliberately the homework list only — strict parity with what the
 * clinician previews and with what `/practice/[sessionId]` exposes to the client.
 *
 * Downloads are named `ALICE_PracticePackage_YYYYMMDD_ClientName.pdf` — see
 * `buildPracticePackageFileName`.
 */

import { jsPDF } from "jspdf"

import type { PracticePackage } from "@/lib/practice-package"

/* =========================
   GEOMETRY — A4 portrait, millimetres
========================= */

/** jsPDF writes its content stream in points whatever unit the document uses. */
export const PT_PER_MM = 72 / 25.4

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = { top: 20, right: 18, bottom: 22, left: 18 } as const

/** 174 mm — every line is wrapped against this, so the right margin is never crossed. */
const CONTENT_W = PAGE_W - MARGIN.left - MARGIN.right
const CONTENT_TOP = MARGIN.top
/** 275 mm — the lowest millimetre body content may occupy. */
const CONTENT_BOTTOM = PAGE_H - MARGIN.bottom
const FOOTER_RULE_Y = CONTENT_BOTTOM + 1.5
/** 281 mm — 16 mm clear of the paper edge. Nothing is ever drawn below this. */
const FOOTER_BASELINE = CONTENT_BOTTOM + 6

export const A4 = {
  PAGE_W,
  PAGE_H,
  MARGIN,
  CONTENT_W,
  CONTENT_TOP,
  CONTENT_BOTTOM,
  FOOTER_RULE_Y,
  FOOTER_BASELINE,
  PT_PER_MM,
} as const

/* =========================
   PALETTE — the worksheet's tokens, frozen as sRGB
========================= */

const COLORS = {
  /** `--primary: oklch(0.205 0 0)` (light theme) -> sRGB #171717. */
  accent: "#171717",
  /** `text-zinc-900` — the headline. */
  ink: "#18181b",
  /** `text-zinc-700` — homework copy. */
  body: "#3f3f46",
  /** `text-zinc-400` — section labels. */
  muted: "#a1a1aa",
  /** `border-zinc-200` — the header hairline. */
  line: "#e4e4e7",
  /** `zinc-300` — outline of the drawn checkbox (the `☐` glyph on screen). */
  checkbox: "#d4d4d8",
  /** `text-green-600`. */
  success: "#16a34a",
  /** `bg-green-50`. */
  successBg: "#f0fdf4",
  /** `border-green-100`. */
  successBorder: "#dcfce7",
} as const

/* =========================
   TYPE SCALE
========================= */

const FAMILY = "helvetica" as const
const SIZE = { title: 18, label: 8, meta: 9, task: 10.5, empty: 11 } as const
/** Baseline-to-baseline distance per size, in mm. */
const LEAD = { label: 5.5, meta: 5, task: 4.8 } as const
/** ~0.6 pt — the on-screen `tracking-widest` on the "ALICE" label. */
const TRACK_WIDE = 0.21
/** Breathing room under the last line of a task row, in mm. */
const TASK_ROW_TAIL = 1.4
const TASK_GAP = 2.2
const CHECKBOX = 3.4
const CHECKBOX_GUTTER = 3.1
const BADGE = 10.5
/** Optical middle of a 10.5 pt line, measured up from its baseline, in mm. */
const TASK_OPTICAL_MID = 1.3

/* =========================
   TEXT HYGIENE
========================= */

/** Glyphs the built-in fonts cannot draw, mapped to printable equivalents. */
const GLYPH_MAP: Record<string, string> = {
  "\u2610": "", // ☐ — drawn as a vector checkbox instead
  "\u2611": "",
  "\u2612": "",
  "\u2705": "",
  "\u2713": "", // ✓
  "\u2714": "",
  "\u26A0": "!", // ⚠
  "\uFE0F": "", // emoji variation selector
  "\u2192": "->",
  "\u2190": "<-",
  "\u2248": "~",
  "\u2264": "<=",
  "\u2265": ">=",
  "\u2018": "'",
  "\u2019": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u2013": "-",
  "\u2014": "-",
  "\u2026": "...",
  "\u2022": "-",
}

/**
 * Everything above U+00FF is unmapped by the core fonts; Latin-1 (é, ñ, ü) is kept
 * because WinAnsi renders it correctly.
 */
export function sanitizeForPdf(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/[\u0100-\u{10FFFF}]/gu, (char) => GLYPH_MAP[char] ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .trim()
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/** Locale-independent, so the layout and its regression test stay deterministic. */
function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0")
  return `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/** `20260916` — sortable, and unambiguous in a records folder. */
function formatDateStamp(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("")
}

/** Keeps room for the rest of the path inside Windows' 260-character ceiling. */
const MAX_NAME_SEGMENT = 48

/**
 * Folds a name down to filename-safe ASCII: "Jane May Low" -> "JaneMayLow",
 * "Seán O'Brien / Ltd." -> "SeanOBrienLtd". Accents are folded rather than
 * dropped so the name stays recognisable, and everything outside [A-Za-z0-9]
 * (spaces, quotes, slashes, emoji, CJK) is removed rather than escaped, because
 * those are the characters that break Windows, macOS and Linux paths alike.
 */
export function sanitizeFileNameSegment(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, MAX_NAME_SEGMENT)
}

/**
 * `ALICE_PracticePackage_YYYYMMDD_ClientName.pdf` — human-readable for records,
 * e.g. `ALICE_PracticePackage_20260916_JaneMayLow.pdf`. An unusable client name
 * drops the segment rather than inventing one: `ALICE_PracticePackage_20260916.pdf`.
 */
export function buildPracticePackageFileName(meta: PracticePackagePdfMeta = {}): string {
  const client = sanitizeFileNameSegment(meta.clientName)

  return (
    ["ALICE_PracticePackage", formatDateStamp(meta.generatedAt ?? new Date()), client]
      .filter((part) => part.length > 0)
      .join("_") + ".pdf"
  )
}

/** Mirrors the worksheet's own coercion (`item.task` for object rows). */
export function collectHomeworkTasks(pkg: PracticePackage | null): string[] {
  const raw: unknown[] = Array.isArray(pkg?.homework) ? pkg.homework : []

  return raw
    .map((item) => {
      if (typeof item === "string") return item
      if (
        item &&
        typeof item === "object" &&
        typeof (item as { task?: unknown }).task === "string"
      ) {
        return (item as { task: string }).task
      }
      return item == null ? "" : JSON.stringify(item)
    })
    .map(sanitizeForPdf)
    .filter((task) => task.length > 0)
}

/* =========================
   METRICS + WRAPPING
========================= */

/**
 * Width of `text` under the font and font-size currently set on `pdf`, in mm,
 * including optional letter-spacing. jsPDF's own `splitTextToSize` ignores
 * `setCharSpace`, which would push tracked label lines past the right margin.
 */
function measure(pdf: jsPDF, text: string, tracking: number): number {
  if (!text) return 0
  return pdf.getTextWidth(text) + tracking * Math.max(0, text.length - 1)
}

/**
 * Greedy word wrap with an exact fit. A single word wider than the column (a URL,
 * a pathological token) is hard-split by character, so a row can never overflow.
 */
function wrapText(pdf: jsPDF, text: string, maxWidth: number, tracking = 0): string[] {
  const lines: string[] = []
  let line = ""

  for (const word of text.split(" ").filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word

    if (line && measure(pdf, candidate, tracking) > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }

    while (measure(pdf, line, tracking) > maxWidth && line.length > 1) {
      let cut = line.length - 1
      while (cut > 1 && measure(pdf, line.slice(0, cut), tracking) > maxWidth) cut -= 1
      lines.push(line.slice(0, cut))
      line = line.slice(cut)
    }
  }

  if (line) lines.push(line)
  return lines.length ? lines : [""]
}

/* =========================
   CURSOR — the only place a page break happens
========================= */

type Cursor = { pdf: jsPDF; y: number }

/** Starts a new page and rewinds the cursor to the top margin. */
function addPage(state: Cursor): void {
  state.pdf.addPage("a4", "portrait")
  state.y = CONTENT_TOP
}

/** Guarantees `height` mm of room, breaking the page when a block would not fit. */
function ensureSpace(state: Cursor, height: number): void {
  if (state.y + height > CONTENT_BOTTOM) addPage(state)
}

/* =========================
   PRIMITIVES
========================= */

/** Vector stand-in for the `CheckCircle2` badge (green-50 fill, green-100 border). */
function drawCheckBadge(pdf: jsPDF, x: number, y: number): void {
  pdf.setFillColor(COLORS.successBg)
  pdf.setDrawColor(COLORS.successBorder)
  pdf.setLineWidth(0.3)
  pdf.roundedRect(x, y, BADGE, BADGE, 3, 3, "FD")

  pdf.setDrawColor(COLORS.success)
  pdf.setLineWidth(0.7)
  pdf.setLineCap("round")
  pdf.setLineJoin("round")
  pdf.line(x + BADGE * 0.25, y + BADGE * 0.52, x + BADGE * 0.43, y + BADGE * 0.7)
  pdf.line(x + BADGE * 0.43, y + BADGE * 0.7, x + BADGE * 0.76, y + BADGE * 0.31)
  pdf.setLineCap("butt")
  pdf.setLineJoin("miter")
}

/* =========================
   BLOCKS
========================= */

type ResolvedMeta = { clientName: string; sessionName: string; generatedAt: Date }

/** Accent bar, headline, product label, check badge and provenance line. */
function drawHeader(state: Cursor, meta: ResolvedMeta): void {
  const { pdf } = state

  pdf.setFillColor(COLORS.accent)
  pdf.roundedRect(MARGIN.left, CONTENT_TOP, CONTENT_W, 3, 1.5, 1.5, "F")

  pdf.setFont(FAMILY, "bold")
  pdf.setFontSize(SIZE.title)
  pdf.setTextColor(COLORS.ink)
  pdf.text("Client Practice Task", MARGIN.left, CONTENT_TOP + 13)

  pdf.setFontSize(SIZE.label)
  pdf.setCharSpace(TRACK_WIDE)
  pdf.setTextColor(COLORS.accent)
  pdf.text("ALICE", MARGIN.left, CONTENT_TOP + 19.5)
  pdf.setCharSpace(0)

  drawCheckBadge(pdf, PAGE_W - MARGIN.right - BADGE, CONTENT_TOP + 4)

  pdf.setFont(FAMILY, "normal")
  pdf.setFontSize(SIZE.meta)
  pdf.setTextColor(COLORS.muted)

  const provenance = sanitizeForPdf(
    [meta.clientName, meta.sessionName, `Generated ${formatDate(meta.generatedAt)}`]
      .filter((part) => part.length > 0)
      .join("  |  ")
  )

  let y = CONTENT_TOP + 24

  for (const line of wrapText(pdf, provenance || "Practice package", CONTENT_W)) {
    pdf.text(line, MARGIN.left, y)
    y += LEAD.meta
  }

  y += 2
  pdf.setDrawColor(COLORS.line)
  pdf.setLineWidth(0.3)
  pdf.line(MARGIN.left, y, PAGE_W - MARGIN.right, y)

  state.y = y + 9
}

/** Uppercase, letter-spaced section label. */
function drawSectionLabel(state: Cursor, text: string): void {
  const { pdf } = state
  pdf.setFont(FAMILY, "bold")
  pdf.setFontSize(SIZE.label)
  pdf.setTextColor(COLORS.muted)

  const lines = wrapText(pdf, text.toUpperCase(), CONTENT_W, TRACK_WIDE)

  ensureSpace(state, lines.length * LEAD.label + 2.5)

  pdf.setCharSpace(TRACK_WIDE)
  for (const line of lines) {
    state.y += LEAD.label
    pdf.text(line, MARGIN.left, state.y)
  }
  pdf.setCharSpace(0)
  state.y += 2.5
}

/** Checkbox centred on a 10.5 pt line's optical middle (its baseline, less 1.3 mm). */
function drawTaskCheckbox(pdf: jsPDF, rowTop: number): void {
  pdf.setDrawColor(COLORS.checkbox)
  pdf.setLineWidth(0.25)
  pdf.roundedRect(
    MARGIN.left,
    rowTop + LEAD.task - TASK_OPTICAL_MID - CHECKBOX / 2,
    CHECKBOX,
    CHECKBOX,
    0.7,
    0.7,
    "S"
  )
}

/** One homework row: a drawn checkbox plus wrapped copy. */
function drawTask(state: Cursor, text: string): void {
  const { pdf } = state
  const textX = MARGIN.left + CHECKBOX + CHECKBOX_GUTTER

  pdf.setFont(FAMILY, "normal")
  pdf.setFontSize(SIZE.task)

  const lines = wrapText(pdf, text, CONTENT_W - CHECKBOX - CHECKBOX_GUTTER)
  const rowHeight = lines.length * LEAD.task + TASK_ROW_TAIL

  pdf.setTextColor(COLORS.body)

  // Normal case: the row fits on a single page, so it is never split across two.
  if (rowHeight <= CONTENT_BOTTOM - CONTENT_TOP) {
    ensureSpace(state, rowHeight)

    const top = state.y
    drawTaskCheckbox(pdf, top)
    lines.forEach((line, index) => {
      pdf.text(line, textX, top + LEAD.task + index * LEAD.task)
    })

    state.y = top + rowHeight + TASK_GAP
    return
  }

  // Pathological case: the row alone is taller than a printable page — an unbroken
  // 6,000-character token, say. Flow it line by line so no line can cross the
  // content floor, and keep the checkbox beside the line that opens the row.
  lines.forEach((line, index) => {
    ensureSpace(state, LEAD.task)
    if (index === 0) drawTaskCheckbox(pdf, state.y)
    pdf.text(line, textX, state.y + LEAD.task)
    state.y += LEAD.task
  })

  state.y += TASK_ROW_TAIL + TASK_GAP
}

function drawEmptyState(state: Cursor): void {
  const { pdf } = state
  const message = "No Practice Package generated."

  pdf.setFont(FAMILY, "italic")
  pdf.setFontSize(SIZE.empty)
  pdf.setTextColor(COLORS.muted)

  ensureSpace(state, 20)
  pdf.text(message, (PAGE_W - pdf.getTextWidth(message)) / 2, state.y + 20)
  state.y += 26
}

/** Stamped last, so "Page x of y" knows the total. */
function stampFooters(pdf: jsPDF, meta: ResolvedMeta): void {
  const total = pdf.getNumberOfPages()

  for (let page = 1; page <= total; page++) {
    pdf.setPage(page)

    pdf.setDrawColor(COLORS.line)
    pdf.setLineWidth(0.2)
    pdf.line(MARGIN.left, FOOTER_RULE_Y, PAGE_W - MARGIN.right, FOOTER_RULE_Y)

    pdf.setFont(FAMILY, "normal")
    pdf.setFontSize(8)
    pdf.setTextColor(COLORS.muted)
    pdf.text(
      `ALICE - generated ${formatDate(meta.generatedAt)}`,
      MARGIN.left,
      FOOTER_BASELINE
    )

    const label = `Page ${page} of ${total}`
    pdf.text(label, PAGE_W - MARGIN.right - pdf.getTextWidth(label), FOOTER_BASELINE)
  }

  pdf.setPage(total)
}

/* =========================
   PUBLIC API
========================= */

export type PracticePackagePdfMeta = {
  clientName?: string
  sessionName?: string
  generatedAt?: Date
  /** Overrides the derived `ALICE_PracticePackage_YYYYMMDD_ClientName.pdf`. */
  fileName?: string
}

export function buildPracticePackagePdf(
  pkg: PracticePackage | null,
  meta: PracticePackagePdfMeta = {}
): jsPDF {
  const resolved: ResolvedMeta = {
    clientName: sanitizeForPdf(meta.clientName),
    sessionName: sanitizeForPdf(meta.sessionName),
    generatedAt: meta.generatedAt ?? new Date(),
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

  pdf.setProperties({
    title: "ALICE - Client Practice Task",
    subject: "Client practice package",
    creator: "ALICE",
  })

  const state: Cursor = { pdf, y: CONTENT_TOP }
  drawHeader(state, resolved)

  const tasks = collectHomeworkTasks(pkg)

  if (tasks.length === 0) {
    drawEmptyState(state)
  } else {
    drawSectionLabel(state, "Please complete the following tasks before your next session")
    for (const task of tasks) drawTask(state, task)
  }

  stampFooters(pdf, resolved)

  return pdf
}

export function downloadPracticePackagePdf(
  pkg: PracticePackage | null,
  meta: PracticePackagePdfMeta = {}
): void {
  const pdf = buildPracticePackagePdf(pkg, meta)
  pdf.save(meta.fileName?.trim() || buildPracticePackageFileName(meta))
}
