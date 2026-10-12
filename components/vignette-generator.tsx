"use client"

import { useEffect, useRef, useState } from "react"
import { useClientNavStore } from "@/stores/useClientNavStore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Sparkles,
  ClipboardPaste,
  BrainCircuit,
} from "lucide-react"
import {
  CLINICAL_AI_API_BASE as API_BASE,
  GROQ_TPM_LIMIT_NOTE,
  SESSION_NOTES_MAX_CHARS,
  SESSION_NOTES_WARN_CHARS,
  estimateTokens,
} from "@/lib/clinical-ai-api"
import { apiFetch } from "@/lib/auth"
import { isStructuredTask, type StoredPracticeTask } from "@/lib/practice-package"
import { decideSessionHydration } from "@/lib/session-hydration"
import { upsertTaskDraft } from "@/lib/tasks"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DynamicTaskForm } from "@/components/tasks/DynamicTaskForm"
import ReflectionCanvas from "@/components/canvas/ReflectionCanvas"
import { ModalitySelector } from "@/components/modality-selector"
import type { Modality } from "@/types/tasks"
import type { StructuredTask } from "@/lib/ai/schemas"

type StepId = 1 | 2 | 3

/**
 * The `/generate/structured-task` body, as this component reads it. `res.ok` is tested *after*
 * the parse, so one value has to cover every body the route can return: the structured task,
 * the `?allowDegraded=1` placeholder (`degradedGroqPayload`, backend/CloudFlare.js — a bare
 * `task_type` plus `degraded` / `warning`) and the route's JSON error envelope (`{ error }` /
 * `{ detail }`). Each is read on its own branch below — the task's own fields only after
 * `res.ok`, the envelope only in the `throw` — so this is the bag of members the component
 * consumes, not a claim that one body carries all of them.
 */
type StructuredTaskResponse = StructuredTask & {
  degraded?: boolean
  warning?: string
  error?: string
  detail?: string
}

const TASK_VARIANTS = ["activity_log", "thought_record", "reflection_prompt", "two_choice_worksheet"] as const

function isTaskVariant(v: string): v is (typeof TASK_VARIANTS)[number] {
  return (TASK_VARIANTS as readonly string[]).includes(v)
}

interface AnalysisResult {
  formulationId?: string
  inferredModality?: string
  riskFlags: unknown[]
  rationale: string
}

/** Must match the fallback string `handleAnalyze` returns in backend/CloudFlare.js. */
const PLACEHOLDER_RATIONALE = "Clinical synthesis unavailable."

function extractHomeworkList(task: StructuredTask & { homework?: string[] }): string[] {
  if (!task || typeof task !== "object") return []
  if (Array.isArray(task.homework) && task.homework.length > 0) {
    return task.homework
  }

  const items: string[] = []
  if (task.task_type === "two_choice_worksheet") {
    if (task.title) items.push(task.title)
    if (Array.isArray(task.prompts)) {
      task.prompts.forEach((p, idx: number) => {
        const q = typeof p === "string" ? p : p?.question
        if (q) items.push(`${idx + 1}. ${q}`)
      })
    }
    if (task.reflection_prompt) {
      items.push(`Reflection: ${task.reflection_prompt}`)
    }
  } else if (task.task_type === "thought_record") {
    items.push("Complete 3 C's Thought Record")
    if (task.situation) items.push(`Situation: ${task.situation}`)
    if (task.automatic_thought) items.push(`Catch It (Automatic Thought): ${task.automatic_thought}`)
    if (task.evidence_for || task.evidence_against) items.push("Check It: Review evidence for and against")
    if (task.balanced_thought) items.push(`Correct It (Balanced Thought): ${task.balanced_thought}`)
  } else if (task.task_type === "activity_log") {
    items.push("Weekly Activity Schedule")
    if (task.activity_description) items.push(`Scheduled Activity: ${task.activity_description}`)
    if (task.activity_date) items.push(`Target Date: ${task.activity_date}`)
    if (task.notes) items.push(`Notes: ${task.notes}`)
  } else if (task.task_type === "reflection_prompt") {
    items.push("Values & Defusion Canvas Reflection")
    if (task.prompt) items.push(task.prompt)
  }

  return items.length > 0 ? items : ["Complete assigned practice task"]
}

export default function VignetteGenerator({
  clientId,
  caseId,
  sessionId,
  sessionName,
}: {
  clientId: string
  caseId: string
  sessionId: string
  sessionName?: string
}) {
  const saveSessionContent = useClientNavStore((s) => s.saveSessionContent)
  /** Client name for the exported PDF header. */
  const clientName = useClientNavStore((s) => s.client?.name)

  const session = useClientNavStore((s) =>
    s.client?.cases.find((c) => c.id === caseId)
      ?.sessions.find((sess) => sess.id === sessionId)
  )

  /**
   * `GET /client/:id` embeds only `sessions(id,name)`, so the tree row is a stub
   * that shares this id without any payload — `sessionHydratedId` only matches
   * once `selectSession` has merged `GET /sessions/:id`. `hydratedSessionRef`
   * makes hydration one-shot per session, so later writes (blur-saves, renames,
   * the PATCH echo) can never reset the clinician's step.
   */
  const sessionHydratedId = useClientNavStore((s) => s.sessionHydratedId)
  const hydratedSessionRef = useRef<string | null>(null)

  const [step, setStep] = useState<StepId>(1)
  const [sessionInput, setSessionInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [practicePackage, setPracticePackage] = useState<StoredPracticeTask | null>(null)

  const [selectedModalities, setSelectedModalities] = useState<Modality[]>(["CBT"])
  const [activityFormat, setActivityFormat] = useState<"activity_log" | "thought_record" | "reflection_prompt" | "two_choice_worksheet">("thought_record")
  const [generatedSubmissionId, setGeneratedSubmissionId] = useState<string | null>(null)
  const [generatedTaskData, setGeneratedTaskData] = useState<StoredPracticeTask | null>(null)

  const [degradedWarning, setDegradedWarning] = useState<string | null>(null)
  const [linkStatus, setLinkStatus] = useState<string | null>(null)

  /**
   * Groq's 8,000 tokens/minute ceiling is an *input* limit and the notes are sent
   * twice per run (analyze, then practice package), so an over-long paste is
   * rejected before it can burn the clinician's minute.
   */
  const notesLength = sessionInput.length
  const notesTokens = estimateTokens(notesLength)
  const notesTooLong = notesLength > SESSION_NOTES_MAX_CHARS
  const notesLong = !notesTooLong && notesLength > SESSION_NOTES_WARN_CHARS
  const notesBudget = `≈${notesTokens.toLocaleString()} tokens of Groq's 8,000/minute`

  // DELIBERATELY RETAINED (lint rank 8g, register row B13). This is the session-hydration latch:
  // `lib/session-hydration.ts` decides wait/keep/hydrate and `tests/hydration-guard.test.mjs`
  // locks fifteen cases around it, so a careless fix here is riskier than the finding. The writes
  // below run only when the guard returns `hydrate` — once per session — and the derived-state
  // alternative (computing the phase from the store during render) would re-derive on every store
  // write: blur-saves, renames and the PATCH echo all replace the session object, and re-deriving
  // would bounce the clinician out of the phase they are in and discard unsaved notes. The rule
  // stays visible rather than silenced, because the guard's behaviour IS the behaviour the fifteen
  // tests pin.
  useEffect(() => {
    if (!session) {
      hydratedSessionRef.current = null
      setDegradedWarning(null)
      setStep(1)
      setSessionInput("")
      setAnalysis(null)
      setPracticePackage(null)
      return
    }

    // `wait` while the tree stub is all we have (GET /client/:id carries only
    // `sessions(id,name)`), `keep` for a later store write — blur-save, rename, PATCH
    // echo — so the phase is never re-derived from anything but the real payload.
    const action = decideSessionHydration({
      sessionId: session.id,
      sessionHydratedId,
      latchedSessionId: hydratedSessionRef.current,
    })

    if (action !== "hydrate") return

    hydratedSessionRef.current = session.id
    setDegradedWarning(null)

    setSessionInput(session.sessionNotes || "")

    const storedAnalysis = session.analysis as AnalysisResult | null
    setAnalysis(storedAnalysis)

    const parseModalities = (raw?: string | null): Modality[] => {
      if (!raw) return ["CBT"];
      const valid: Modality[] = ["CBT", "ACT", "DBT"];
      const parsed = Array.from(
        new Set(
          raw
            .split(",")
            .map((m) => m.trim().toUpperCase() as Modality)
            .filter((m): m is Modality => valid.includes(m))
        )
      );
      return parsed.length > 0 ? parsed : ["CBT"];
    };

    if (session.modality) {
      setSelectedModalities(parseModalities(session.modality));
    } else if (storedAnalysis?.inferredModality) {
      setSelectedModalities(parseModalities(storedAnalysis.inferredModality));
    } else {
      setSelectedModalities(["CBT"]);
    }

    if (storedAnalysis?.rationale === PLACEHOLDER_RATIONALE) {
      setDegradedWarning(
        "This session still holds a placeholder analysis from an earlier failed run — regenerate to replace it."
      )
    }

    // Try to load practice package if in session (from GET /sessions/:id). The stored value is
    // either shape (`StoredPracticeTask`); only the structured one carries an activity format.
    if (session.practicePackage) {
      const stored = session.practicePackage
      setPracticePackage(stored)
      setGeneratedTaskData(stored)
      if (isStructuredTask(stored)) {
        setActivityFormat(stored.task_type)
      }
      setStep(2)
    } else {
      setPracticePackage(null)
      setGeneratedTaskData(null)
      setStep(1)
    }
  }, [session, sessionHydratedId])

  const persistNotes = async (notes: string) => {
    setIsSaving(true)
    try {
      await saveSessionContent(caseId, sessionId, { sessionNotes: notes })
    } finally {
      setIsSaving(false)
    }
  }

  const handleHeidiImport = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text.length < 5) return alert("Clipboard is empty.")
      setSessionInput(text)
    } catch {
      alert("Please allow clipboard permissions.")
    }
  }

  /**
   * Programmatic A4 export (`lib/export-practice-pdf.ts`): vector text with
   * explicit page-boundary maths, so nothing overlaps or spills off the sheet.
   */
  const handleDownloadPdf = async () => {
    if (!practicePackage) {
      alert("Generate a practice package before exporting.")
      return
    }

    setIsExporting(true)
    try {
      const { downloadPracticePackagePdf } = await import("@/lib/export-practice-pdf")

      downloadPracticePackagePdf(practicePackage, {
        clientName,
        sessionName,
      })
    } catch (err) {
      console.error("❌ PDF EXPORT FAILED", err)
      alert(err instanceof Error ? err.message : "Could not export the PDF")
    } finally {
      setIsExporting(false)
    }
  }

  /**
   * Mints the single signed, expiring client link for the token-free practice
   * page. The Worker signs `v1|sessionId|exp` with `CLIENT_LINK_SECRET`, so the
   * raw session id alone no longer opens the client's material.
   */
  const handleCopyClientLink = async () => {
    setLinkStatus("Creating link…")

    try {
      const res = await apiFetch(`${API_BASE}/client-link/${sessionId}`)
      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.practiceUrl) {
        throw new Error(data?.error || "Could not create a client link")
      }

      const url = data.practiceUrl as string

      await navigator.clipboard.writeText(url)

      setLinkStatus(
        `Copied the client link — expires ${new Date(
          data.expiresAt
        ).toLocaleDateString()}`
      )
    } catch (err) {
      setLinkStatus(
        err instanceof Error ? err.message : "Could not create a client link"
      )
    }
  }

  const handleAnalyzeAndGenerate = async () => {
    console.log("🚀 GENERATE CLICK", {
      clientId,
      caseId,
      sessionId,
      step,
      notesLength: sessionInput.length,
    })

    if (!sessionInput) {
      console.warn("⛔ GENERATE BLOCKED: session notes are empty")
      return
    }

    // Defence in depth: `sessionInput` can be hydrated from the database by
    // `useClientNavStore`, which bypasses the textarea's own guard.
    if (notesTooLong) {
      console.warn("⛔ GENERATE BLOCKED: notes exceed the Groq token budget", {
        notesLength,
        notesTokens,
      })
      alert(
        `These notes are ${notesLength.toLocaleString()} characters (${notesBudget}). ` +
          `${GROQ_TPM_LIMIT_NOTE} Trim them to about ${SESSION_NOTES_MAX_CHARS.toLocaleString()} ` +
          "characters, or split the session, then try again."
      )
      return
    }

    setIsProcessing(true)
    setDegradedWarning(null)
    try {
      // 1. Analyze
      const analyzeUrl = `${API_BASE}/analyze/session?allowDegraded=1`
      const analyzePayload = {
        sessionNotes: sessionInput,
        clientId,
        sessionId,
      }

      console.log("➡️ POST", analyzeUrl, analyzePayload)

      const analyzeRes = await apiFetch(analyzeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analyzePayload),
      })
      const analyzeText = await analyzeRes.text()
      if (!analyzeText) {
        throw new Error(`Server returned ${analyzeRes.status} with empty response`)
      }
      const analyzeData = JSON.parse(analyzeText)

      console.log("⬅️ RESPONSE", analyzeUrl, analyzeRes.status, analyzeData)
      if (!analyzeRes.ok) {
        throw new Error(
          (analyzeData?.detail || analyzeData?.error || "Analysis failed") +
          " (Status: " + analyzeRes.status + ", Data: " + JSON.stringify(analyzeData) + ")"
        )
      }

      setAnalysis(analyzeData)

      if (analyzeData?.degraded) {
        setDegradedWarning(analyzeData.warning || "AI analysis was unavailable.")
      }

      // 2. Generate Structured Task
      const genUrl = `${API_BASE}/generate/structured-task?allowDegraded=1`
      const cleanModalities = selectedModalities.map((m) => m.toUpperCase() as Modality)
      const genPayload = {
        sessionContext: sessionInput,
        activityFormat: "auto",
        modalities: cleanModalities,
      }

      console.log("➡️ POST", genUrl, genPayload)

      const genRes = await apiFetch(genUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(genPayload),
      })
      const genText = await genRes.text()
      if (!genText) {
        throw new Error(`Server returned ${genRes.status} with empty response`)
      }
      const taskData = JSON.parse(genText) as StructuredTaskResponse

      console.log("⬅️ RESPONSE", genUrl, genRes.status, taskData)
      if (!genRes.ok) {
        throw new Error(
          taskData?.detail ||
            taskData?.error ||
            "Structured task generation failed"
        )
      }

      const derivedHomework = extractHomeworkList(taskData)
      const enrichedTaskData = {
        ...taskData,
        homework: derivedHomework,
      }

      setGeneratedTaskData(enrichedTaskData)
      setPracticePackage(enrichedTaskData)

      if (taskData?.degraded) {
        setDegradedWarning(taskData.warning || "AI generation was unavailable.")
      }

      // 3. Database Persistence: save draft
      const draft = await upsertTaskDraft({
        clientId,
        practitionerId: "00000000-0000-0000-0000-000000000000",
        taskType: activityFormat,
        formData: enrichedTaskData,
      })

      setGeneratedSubmissionId(draft.id)
      setActivityFormat(taskData.task_type || activityFormat)
      setStep(2)

      // 4. Save session content
      await saveSessionContent(caseId, sessionId, {
        sessionNotes: sessionInput,
        analysis: analyzeData,
        practicePackage: enrichedTaskData,
        homework: derivedHomework,
        modality: selectedModalities.join(", "),
      })
    } catch (err) {
      console.error(err)

      const message =
        err instanceof Error ? err.message : "Failed to generate structured task"

      /**
       * Groq's 429 body already says how long to wait ("Please try again in
       * 19.2525s"); surface that instead of a wall of text.
       */
      const retryIn = /try again in ([\d.]+)s/i.exec(message)

      alert(
        retryIn
          ? `Groq rate limit reached (8,000 tokens/minute). Try again in about ${Math.ceil(
              Number(retryIn[1])
            )} seconds, or shorten the notes.`
          : message
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRegenerateExplicit = async () => {
    console.log("🚀 REGENERATE CLICK", {
      activityFormat,
    })

    setIsProcessing(true)
    setDegradedWarning(null)
    try {
      const genUrl = `${API_BASE}/generate/structured-task?allowDegraded=1`
      const cleanModalities = selectedModalities.map((m) => m.toUpperCase() as Modality)
      const genPayload = {
        sessionContext: sessionInput,
        activityFormat,
        modalities: cleanModalities,
      }

      const genRes = await apiFetch(genUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(genPayload),
      })
      const genText = await genRes.text()
      if (!genText) {
        throw new Error(`Server returned ${genRes.status} with empty response`)
      }
      const taskData = JSON.parse(genText) as StructuredTaskResponse

      if (!genRes.ok) {
        throw new Error(taskData?.detail || taskData?.error || "Structured task generation failed")
      }

      const derivedHomework = extractHomeworkList(taskData)
      const enrichedTaskData = {
        ...taskData,
        homework: derivedHomework,
      }

      setGeneratedTaskData(enrichedTaskData)
      setPracticePackage(enrichedTaskData)

      if (taskData?.degraded) {
        setDegradedWarning(taskData.warning || "AI generation was unavailable.")
      }

      const draft = await upsertTaskDraft({
        clientId,
        practitionerId: "00000000-0000-0000-0000-000000000000",
        taskType: activityFormat,
        formData: enrichedTaskData,
      })

      setGeneratedSubmissionId(draft.id)

      await saveSessionContent(caseId, sessionId, {
        practicePackage: enrichedTaskData,
        homework: derivedHomework,
      })
    } catch (err) {
      console.error(err)
      const message = err instanceof Error ? err.message : "Failed to generate structured task"
      const retryIn = /try again in ([\d.]+)s/i.exec(message)
      alert(retryIn ? `Groq rate limit reached. Try again in about ${Math.ceil(Number(retryIn[1]))} seconds.` : message)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* SESSION TOP BAR & CONTEXT RIBBON */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground truncate">
                {sessionName || "Clinical Encounter"}
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                {selectedModalities.join(" / ")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {clientName ? `Patient: ${clientName} · ` : ""}
              {step === 1 ? "Phase 1: Input & Scribe Notes" : "Phase 2: Practice Package Formulated"}
              {isSaving ? " · Saving changes…" : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {practicePackage && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyClientLink}
                className="h-8 text-xs font-semibold"
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy Client Link
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={isExporting}
                className="h-8 text-xs font-semibold"
              >
                {isExporting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                )}
                Export PDF
              </Button>
            </>
          )}

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${step === 2 ? "bg-emerald-500" : "bg-amber-500"}`} />
            <span>PHASE {step} OF 2</span>
          </div>
        </div>
      </div>

      {/* DEGRADED ADVISORY */}
      {degradedWarning && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
        >
          ⚠️ AI Service Advisory: {degradedWarning}
        </div>
      )}

      {/* DUAL PANE WORKBENCH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT COLUMN: NOTES & SCRIBE INPUT (5 COLS) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="border-b pb-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold">Clinical Notes &amp; Scribe</CardTitle>
                  <CardDescription className="text-xs">
                    Paste from Heidi Health or dictate session notes
                  </CardDescription>
                </div>

                <Button
                  onClick={handleHeidiImport}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold bg-background shadow-xs shrink-0"
                >
                  <ClipboardPaste className="h-3.5 w-3.5 mr-1.5" />
                  Paste Heidi Notes
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              <Textarea
                value={sessionInput}
                onChange={(e) => setSessionInput(e.target.value)}
                onBlur={() => {
                  if (sessionInput.trim()) persistNotes(sessionInput)
                }}
                placeholder="Paste Heidi transcript/notes or record session observations here…"
                className="min-h-[260px] rounded-xl border-border/80 bg-background p-4 text-sm leading-relaxed font-sans focus-visible:ring-1 focus-visible:ring-primary resize-y"
              />

              {/* TOKEN & CHARACTER BUDGET METER */}
              <div className="space-y-1.5 rounded-xl border bg-muted/30 p-3 text-xs">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-muted-foreground">Groq TPM Input Budget</span>
                  <span className={notesTooLong ? "text-destructive font-bold" : notesLong ? "text-amber-600 font-bold" : "text-muted-foreground"}>
                    {notesLength.toLocaleString()} / {SESSION_NOTES_MAX_CHARS.toLocaleString()} chars
                  </span>
                </div>

                <Progress
                  value={Math.min(100, Math.round((notesTokens / 8000) * 100))}
                  className="h-1.5 bg-muted"
                />

                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{notesBudget}</span>
                  {notesTooLong ? (
                    <span className="text-destructive font-semibold">Exceeds Groq limit</span>
                  ) : notesLong ? (
                    <span className="text-amber-600 font-semibold">Approaching limit</span>
                  ) : (
                    <span>Normal budget</span>
                  )}
                </div>

                {notesTooLong && (
                  <p className="mt-1 text-[11px] font-medium text-destructive">
                    {GROQ_TPM_LIMIT_NOTE} Please trim notes to ~{SESSION_NOTES_MAX_CHARS.toLocaleString()} characters.
                  </p>
                )}
              </div>

              {/* MODALITY SELECTOR */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Therapeutic Framework
                </label>
                <ModalitySelector
                  selectedModalities={selectedModalities}
                  onChange={(mods) => setSelectedModalities(mods)}
                  disabled={isProcessing}
                />
              </div>

              {/* ANALYZE BUTTON */}
              <Button
                onClick={handleAnalyzeAndGenerate}
                className="h-11 w-full font-bold shadow-sm"
                disabled={!sessionInput || isProcessing || notesTooLong}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Synthesizing Formulation…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze &amp; Recommend Practice
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: CLINICAL SYNTHESIS & PRACTICE TASK (7 COLS) */}
        <div className="lg:col-span-7 space-y-4">
          {step === 1 && !practicePackage && !analysis ? (
            /* EMPTY WORKBENCH STATE */
            <Card className="border-dashed border-border/80 bg-card/60 shadow-xs">
              <CardContent className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <BrainCircuit className="h-7 w-7" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-base font-bold text-foreground">
                    Awaiting Session Formulation
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Paste clinical encounter notes on the left and select therapeutic frameworks (CBT / ACT / DBT). ALICE will synthesize clinical rationale and generate structured practice tasks here.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 max-w-sm w-full pt-2 text-left text-xs text-muted-foreground">
                  <div className="rounded-lg border bg-background p-2.5">
                    <p className="font-semibold text-foreground">CBT 3 C&apos;s</p>
                    <p className="text-[10px] mt-0.5">Catch, Check, Correct thought records</p>
                  </div>
                  <div className="rounded-lg border bg-background p-2.5">
                    <p className="font-semibold text-foreground">ACT Defusion</p>
                    <p className="text-[10px] mt-0.5">Interactive values reflection canvas</p>
                  </div>
                  <div className="rounded-lg border bg-background p-2.5">
                    <p className="font-semibold text-foreground">Activity Log</p>
                    <p className="text-[10px] mt-0.5">Weekly scheduling &amp; behavioural activation</p>
                  </div>
                  <div className="rounded-lg border bg-background p-2.5">
                    <p className="font-semibold text-foreground">Client Delivery</p>
                    <p className="text-[10px] mt-0.5">Signed, expiring links (no login required)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* ACTIVE FORMULATION & PRACTICE TASK WORKBENCH */
            <div className="space-y-4">

              {/* FORMULATION RATIONALE CARD */}
              <div className="rounded-xl border border-blue-200/70 bg-blue-50/50 p-4 text-xs font-medium leading-relaxed text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200 shadow-2xs">
                <span className="font-bold text-blue-950 dark:text-blue-100 uppercase tracking-wider text-[10px] block mb-1">
                  Clinical Synthesis &amp; Formulation
                </span>
                {analysis?.rationale && analysis.rationale !== PLACEHOLDER_RATIONALE
                  ? `"${analysis.rationale}"`
                  : `"No formulation rationale recorded yet. Click Analyze & Recommend to generate."`}
              </div>

              {/* PRACTICE TASK CARD */}
              <Card className="border-border/70 shadow-xs overflow-hidden">
                <CardHeader className="border-b bg-muted/30 p-4 sm:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <CardTitle className="text-base font-bold text-foreground">
                        Client Practice Task
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs mt-0.5">
                      Interactive task assigned to {clientName || "the patient"}
                    </CardDescription>
                  </div>

                  {/* FORMAT SELECTOR & REGENERATE */}
                  <div className="flex items-center gap-2">
                    <Select
                      value={activityFormat}
                      onValueChange={(val: string) => {
                        if (isTaskVariant(val)) setActivityFormat(val)
                      }}
                      disabled={isProcessing}
                    >
                      <SelectTrigger className="h-9 w-44 text-xs bg-background">
                        <SelectValue placeholder="Activity Format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="thought_record" className="text-xs">
                          Thought Record (CBT)
                        </SelectItem>
                        <SelectItem value="activity_log" className="text-xs">
                          Activity Log (Schedule)
                        </SelectItem>
                        <SelectItem value="two_choice_worksheet" className="text-xs">
                          Dual-Response Skills
                        </SelectItem>
                        <SelectItem value="reflection_prompt" className="text-xs">
                          Reflection Prompt (Canvas)
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      onClick={handleRegenerateExplicit}
                      disabled={isProcessing}
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs font-semibold bg-background shrink-0"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" />
                      )}
                      Regen
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-6">
                  {activityFormat === "reflection_prompt" ? (
                    <ReflectionCanvas
                      clientId={clientId}
                      submissionId={generatedSubmissionId}
                    />
                  ) : (
                    <DynamicTaskForm
                      clientId={clientId}
                      taskType={activityFormat}
                      initialData={generatedTaskData}
                      submissionId={generatedSubmissionId}
                    />
                  )}
                </CardContent>

                {/* SHARING & EXPORT BAR */}
                <div className="border-t bg-muted/20 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Client Delivery
                    </p>
                    {linkStatus ? (
                      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{linkStatus}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Signed expiring link valid for client homework.</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyClientLink}
                      className="h-9 text-xs font-semibold"
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy Client Link
                    </Button>

                    <Button
                      size="sm"
                      onClick={handleDownloadPdf}
                      disabled={isExporting || !practicePackage}
                      className="h-9 text-xs font-semibold shadow-xs"
                    >
                      {isExporting ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Export A4 PDF
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
