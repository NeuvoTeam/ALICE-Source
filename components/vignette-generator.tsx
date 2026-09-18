"use client"

import { useEffect, useState } from "react"
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
import type { PracticePackage } from "@/lib/practice-package"

type StepId = 1 | 2 | 3

interface AnalysisResult {
  formulationId?: string
  inferredModality?: string
  riskFlags: any[]
  rationale: string
}

/** Must match the fallback string `handleAnalyze` returns in backend/CloudFlare.js. */
const PLACEHOLDER_RATIONALE = "Clinical synthesis unavailable."

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

  const [step, setStep] = useState<StepId>(1)
  const [sessionInput, setSessionInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [practicePackage, setPracticePackage] = useState<PracticePackage | null>(null)
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

  useEffect(() => {
    setDegradedWarning(null)

    const session = useClientNavStore
      .getState()
      .client?.cases.find((c) => c.id === caseId)
      ?.sessions.find((sess) => sess.id === sessionId)

    if (!session) {
      setStep(1)
      setSessionInput("")
      setAnalysis(null)
      setPracticePackage(null)
      return
    }

    setSessionInput(session.sessionNotes || "")

    const storedAnalysis = session.analysis as AnalysisResult | null
    setAnalysis(storedAnalysis)

    if (storedAnalysis?.rationale === PLACEHOLDER_RATIONALE) {
      setDegradedWarning(
        "This session still holds a placeholder analysis from an earlier failed run — regenerate to replace it."
      )
    }

    // Try to load practice package if in session (from GET /sessions/:id)
    if (session.practicePackage) {
      setPracticePackage(session.practicePackage)
      setStep(3)
    } else {
      setPracticePackage(null)
      setStep(1)
    }
  }, [sessionId, caseId])

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
    } catch (err) {
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
      const analyzeUrl = `${API_BASE}/analyze/session`
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
      const analyzeData = await analyzeRes.json()

      console.log("⬅️ RESPONSE", analyzeUrl, analyzeRes.status, analyzeData)
      if (!analyzeRes.ok) {
        throw new Error(
          analyzeData?.detail || analyzeData?.error || "Analysis failed"
        )
      }

      setAnalysis(analyzeData)

      if (analyzeData?.degraded) {
        setDegradedWarning(analyzeData.warning || "AI analysis was unavailable.")
      }

      // 2. Generate Practice Package
      const genUrl = `${API_BASE}/generate/practice-package`
      const genPayload = {
        sessionNotes: sessionInput,
        modality: analyzeData?.inferredModality,
        clientId,
        sessionId,
      }

      console.log("➡️ POST", genUrl, genPayload)

      const genRes = await apiFetch(genUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(genPayload),
      })
      const genData = await genRes.json()

      console.log("⬅️ RESPONSE", genUrl, genRes.status, genData)
      if (!genRes.ok) {
        throw new Error(
          genData?.detail ||
            genData?.error ||
            "Practice package generation failed"
        )
      }

      setPracticePackage(genData)

      if (genData?.degraded) {
        setDegradedWarning(genData.warning || "AI generation was unavailable.")
      }

      setStep(3)

      // 3. Save practice package to session
      await saveSessionContent(caseId, sessionId, {
        sessionNotes: sessionInput,
        analysis: analyzeData,
        practicePackage: genData,
        modality: analyzeData?.inferredModality,
      })
    } catch (err) {
      console.error(err)

      const message =
        err instanceof Error ? err.message : "Failed to generate practice package"

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

  return (
    <Card className="max-w-2xl mx-auto shadow-2xl border-t-4 border-t-primary rounded-[2.5rem] overflow-hidden bg-white">
      <CardHeader className="border-b bg-zinc-50/50 pb-6 px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-2xl">
              <BrainCircuit className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xl font-black tracking-tight text-zinc-800 uppercase">
              ALICE 
            </CardTitle>
          </div>
          <div className="flex flex-col items-end gap-1">
            {sessionName && (
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                {sessionName}
              </span>
            )}
            <div className="px-3 py-1 bg-white border rounded-full text-[10px] font-bold text-zinc-400">
              PHASE {step}
              {isSaving ? " · saving…" : ""}
            </div>
          </div>
        </div>
        <Progress value={step * 33.3} className="h-1.5 mt-6 bg-zinc-100" />
      </CardHeader>

      {degradedWarning && (
        <div className="mx-8 mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900">
          ⚠️ AI unavailable: {degradedWarning}
        </div>
      )}

      <CardContent className="pt-8 px-8 pb-10">
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
                className="min-h-[220px] text-base p-6 bg-zinc-50 border-2 rounded-[2rem] focus:border-primary/20"
              />
              <Button
                onClick={handleHeidiImport}
                variant="outline"
                size="sm"
                className="absolute top-4 right-4 rounded-full bg-white shadow-sm"
              >
                <ClipboardPaste className="h-4 w-4 mr-2" /> Paste from Heidi
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <div
                aria-live="polite"
                className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider"
              >
                <span className="text-zinc-400">
                  {notesLength.toLocaleString()} /{" "}
                  {SESSION_NOTES_MAX_CHARS.toLocaleString()} characters ·{" "}
                  {notesBudget}
                </span>
                {notesTooLong ? (
                  <span className="text-red-600">Too long to send</span>
                ) : notesLong ? (
                  <span className="text-amber-600">Long note</span>
                ) : null}
              </div>

              {notesTooLong && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-900">
                  {GROQ_TPM_LIMIT_NOTE} Trim these notes to about{" "}
                  {SESSION_NOTES_MAX_CHARS.toLocaleString()} characters — as they
                  stand, the request is rejected before any AI work happens.
                </div>
              )}

              {notesLong && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900">
                  {GROQ_TPM_LIMIT_NOTE} Generation should still work, but a second
                  run inside the same minute may be rate limited.
                </div>
              )}
            </div>

            <Button
              onClick={() => setStep(2)}
              className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg"
              disabled={!sessionInput || isProcessing || notesTooLong}
            >
              Next
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right">
            <div className="p-6 rounded-[2rem] bg-blue-50/50 border border-blue-100 text-sm italic font-medium text-blue-900 leading-relaxed">
              {analysis?.rationale &&
              analysis.rationale !== PLACEHOLDER_RATIONALE
                ? `"${analysis.rationale}"`
                : `"No formulation yet — run Analyze & Generate. (An earlier run stored no usable analysis.)"`}
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                className="flex-1 h-12 rounded-xl"
                disabled={isProcessing}
              >
                Back
              </Button>
              <Button
                onClick={handleAnalyzeAndGenerate}
                className="flex-[2] h-12 rounded-xl text-md font-bold"
                disabled={!sessionInput || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  <Sparkles className="mr-2" />
                )}
                Analyze & Generate Practice Package
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in zoom-in-95">
            <div className="p-10 border-2 rounded-[2.5rem] bg-white text-zinc-900 space-y-8 shadow-sm">
              <div className="flex justify-between items-start border-b pb-8">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight leading-none">
                    Client Practice Task
                  </h3>
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mt-3">
                    ALICE
                  </p>
                </div>
                <div className="h-10 w-10 bg-green-50 border border-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="text-green-600 h-6 w-6" />
                </div>
              </div>

              {!practicePackage ? (
                <div className="text-center py-10 text-zinc-400 italic text-lg font-bold">
                  No Practice Package generated.
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Section 1: Homework */}
                  <section>
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">
  Please complete the following tasks before your next session
</h4>
                    {practicePackage?.homework && practicePackage.homework.length > 0 ? (
                      <div className="space-y-4">
                      {practicePackage?.homework?.map((item: any, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3"
                        >
                          <span className="text-lg leading-6 shrink-0">
                            ☐
                          </span>
                    
                          <span className="text-sm text-zinc-700 font-medium leading-6">
                            {typeof item === "string"
                              ? item
                              : item.task || JSON.stringify(item)}
                          </span>
                        </div>
                      ))}
                    </div>
                    ) : (
                      <div className="text-sm text-zinc-400 italic">No homework tasks found.</div>
                    )}
                  </section>

                </div>
              )}
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-3">
              <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                Client link · signed &amp; expiring
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleCopyClientLink}
                  className="w-full h-11 rounded-xl font-bold"
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy Client Link
                </Button>
              </div>

              {linkStatus && (
                <div className="text-[11px] font-medium text-zinc-500">
                  {linkStatus}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="h-12 rounded-2xl"
              >
                Adjust
              </Button>
              <Button
                onClick={handleDownloadPdf}
                className="flex-1 bg-zinc-900 text-white h-12 rounded-2xl font-bold"
                disabled={isExporting || !practicePackage}
              >
                {isExporting ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  <Download className="mr-2" />
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
