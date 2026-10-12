"use client"

import { useEffect, useRef, useState } from "react"
import { useClientNavStore } from "@/stores/useClientNavStore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    <Card className="max-w-2xl mx-auto shadow-2xl border-t-4 border-t-primary rounded-4xl overflow-hidden bg-card text-card-foreground">
      <CardHeader className="border-b border-border bg-muted/50 px-5 pb-6 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <BrainCircuit className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xl font-black tracking-tight text-foreground uppercase">
              ALICE 
            </CardTitle>
          </div>
          <div className="flex flex-col items-end gap-1">
            {sessionName && (
              <span className="max-w-[12rem] truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {sessionName}
              </span>
            )}
            <div className="px-3 py-1 rounded-full border border-border bg-background text-[10px] font-bold text-muted-foreground">
              PHASE {step}
              {isSaving ? " · saving…" : ""}
            </div>
          </div>
        </div>
        <Progress value={step * 33.3} className="mt-6 h-1.5 bg-muted" />
      </CardHeader>

      {degradedWarning && (
        <div className="mx-5 mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900 sm:mx-8 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          ⚠️ AI unavailable: {degradedWarning}
        </div>
      )}

      <CardContent className="px-5 pt-8 pb-10 sm:px-8">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="relative">
              <Textarea
                value={sessionInput}
                onChange={(e) => setSessionInput(e.target.value)}
                onBlur={() => {
                  if (sessionInput.trim()) persistNotes(sessionInput)
                }}
                placeholder="Paste Heidi notes here..."
                className="min-h-[220px] rounded-4xl border-2 bg-muted/50 p-6 text-base focus:border-primary/20"
              />
              <Button
                onClick={handleHeidiImport}
                variant="outline"
                size="sm"
                className="absolute top-4 right-4 rounded-full border-border bg-background shadow-sm"
              >
                <ClipboardPaste className="h-4 w-4 mr-2" /> Paste from Heidi
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <div
                aria-live="polite"
                className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider"
              >
                <span className="text-muted-foreground">
                  {notesLength.toLocaleString()} /{" "}
                  {SESSION_NOTES_MAX_CHARS.toLocaleString()} characters ·{" "}
                  {notesBudget}
                </span>
                {notesTooLong ? (
                  <span className="text-destructive">Too long to send</span>
                ) : notesLong ? (
                  <span className="text-amber-600 dark:text-amber-400">Long note</span>
                ) : null}
              </div>

              {notesTooLong && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                  {GROQ_TPM_LIMIT_NOTE} Trim these notes to about{" "}
                  {SESSION_NOTES_MAX_CHARS.toLocaleString()} characters — as they
                  stand, the request is rejected before any AI work happens.
                </div>
              )}

              {notesLong && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                  {GROQ_TPM_LIMIT_NOTE} Generation should still work, but a second
                  run inside the same minute may be rate limited.
                </div>
              )}
            </div>

            <div className="space-y-4 py-4">
              <ModalitySelector 
                selectedModalities={selectedModalities}
                onChange={(mods) => {
                  setSelectedModalities(mods);
                }}
                disabled={isProcessing}
              />
            </div>

            <Button
              onClick={handleAnalyzeAndGenerate}
              className="h-14 w-full rounded-md text-lg font-bold shadow-lg"
              disabled={!sessionInput || isProcessing || notesTooLong}
            >
              {isProcessing ? (
                <Loader2 className="animate-spin mr-2" aria-hidden="true" />
              ) : (
                <Sparkles className="mr-2" aria-hidden="true" />
              )}
              Analyze & Recommend
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right">
            <div className="rounded-4xl border border-blue-100 bg-blue-50/50 p-6 text-sm italic font-medium leading-relaxed text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
              {analysis?.rationale &&
              analysis.rationale !== PLACEHOLDER_RATIONALE
                ? `"${analysis.rationale}"`
                : `"No formulation yet — run Analyze & Recommend. (An earlier run stored no usable analysis.)"`}
            </div>

            <div className="p-6 border-2 rounded-4xl bg-white text-zinc-900 space-y-8 shadow-sm sm:p-10">
              <div className="flex flex-col gap-6 border-b pb-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight leading-none">
                      Client Practice Task
                    </h3>
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mt-3">
                      ALICE
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-green-100 bg-green-50 dark:border-green-900/50 dark:bg-green-950/40">
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/50 p-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Override Activity Format
                    </label>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Select
                      value={activityFormat}
                      onValueChange={(val: string) => {
                        if (isTaskVariant(val)) setActivityFormat(val)
                      }}
                      disabled={isProcessing}
                    >
                      <SelectTrigger className="h-12 flex-1 rounded-md border-input bg-background">
                        <SelectValue placeholder="Select activity format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="activity_log">Activity Log (activity_log)</SelectItem>
                        <SelectItem value="thought_record">Thought Record (thought_record)</SelectItem>
                        <SelectItem value="two_choice_worksheet">Dual-Response Skills (two_choice_worksheet)</SelectItem>
                        <SelectItem value="reflection_prompt">Reflection Prompt (reflection_prompt)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleRegenerateExplicit}
                      disabled={isProcessing}
                      variant="outline"
                      className="h-12 rounded-md border-input bg-background px-6"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4 mr-2 text-primary" aria-hidden="true" />}
                      {isProcessing ? "Generating..." : "Regenerate"}
                    </Button>
                  </div>
                </div>
              </div>

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
            </div>
            
            <div className="rounded-xl border border-border bg-muted/50 p-4 space-y-3">
              <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                Client link · signed &amp; expiring
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleCopyClientLink}
                  className="w-full h-11 rounded-md font-bold"
                >
                  <Copy className="h-4 w-4 mr-2" aria-hidden="true" /> Copy Client Link
                </Button>
              </div>

              {linkStatus && (
                <div className="text-[11px] font-medium text-muted-foreground">
                  {linkStatus}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="h-12 rounded-md"
              >
                Back to Notes
              </Button>
              <Button
                onClick={handleDownloadPdf}
                className="h-12 flex-1 rounded-md bg-foreground font-bold text-background hover:bg-foreground/90"
                disabled={isExporting || !practicePackage}
              >
                {isExporting ? (
                  <Loader2 className="animate-spin mr-2" aria-hidden="true" />
                ) : (
                  <Download className="mr-2" aria-hidden="true" />
                )}
                Export PDF
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
