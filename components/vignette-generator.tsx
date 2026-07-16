"use client"

import { useEffect, useRef, useState } from "react"
import { useClientNavStore } from "@/stores/useClientNavStore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  CheckCircle2,
  Download,
  Loader2,
  Sparkles,
  ClipboardPaste,
  BrainCircuit,
} from "lucide-react"
import { CLINICAL_AI_API_BASE as API_BASE } from "@/lib/clinical-ai-api"

type StepId = 1 | 2 | 3

interface AnalysisResult {
  formulationId?: string
  inferredModality?: string
  riskFlags: any[]
  rationale: string
}

interface PracticePackage {
  homework: string[]
  scenario: {
    title: string
    difficulty: string
    situation: string
    objectives: string[]
    coachTips: string[]
  }
  quiz: {
    question: string
    answer: string
    rationale: string
  }[]
}

const MODERN_COLOR_SYNTAX_RE = /\b(lab|oklch|oklab|lch)\(|color-mix\(/i

let colorScratchEl: HTMLDivElement | null = null

function getColorScratchEl(): HTMLDivElement {
  if (!colorScratchEl) {
    colorScratchEl = document.createElement("div")
    colorScratchEl.setAttribute("aria-hidden", "true")
    colorScratchEl.style.cssText =
      "position:absolute;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;visibility:hidden;"
    document.body.appendChild(colorScratchEl)
  }
  return colorScratchEl
}

/**
 * Chromium often serializes computed colors as lab()/oklch(); html2canvas's parser rejects those.
 */
function coerceStyleValueForHtml2Canvas(
  prop: string,
  value: string,
  priority: string
): string {
  if (!value || !MODERN_COLOR_SYNTAX_RE.test(value)) return value
  const scratch = getColorScratchEl()
  const reset =
    "position:absolute;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;visibility:hidden;"
  scratch.style.cssText = reset
  try {
    scratch.style.setProperty(prop, value, priority as "important" | "")
    const resolved = getComputedStyle(scratch).getPropertyValue(prop)
    if (resolved && !MODERN_COLOR_SYNTAX_RE.test(resolved)) return resolved.trim()
  } catch {
    /* ignore */
  } finally {
    scratch.style.cssText = reset
  }
  try {
    const ctx = document.createElement("canvas").getContext("2d")
    if (ctx) {
      ctx.fillStyle = "#000"
      ctx.fillStyle = value
      const c = ctx.fillStyle
      if (typeof c === "string" && c && !MODERN_COLOR_SYNTAX_RE.test(c)) return c
    }
  } catch {
    /* ignore */
  }
  if (prop === "color") return "rgb(0, 0, 0)"
  if (prop === "fill" || prop === "stroke") return "rgb(0, 0, 0)"
  if (/(^|-)color$/.test(prop)) return "rgb(128, 128, 128)"
  if (prop.includes("shadow")) return "none"
  if (prop.startsWith("background")) return "rgba(0, 0, 0, 0)"
  if (prop.startsWith("border")) return "none"
  return "transparent"
}

/** html2canvas cannot parse oklch/lab(); inline sRGB-safe values onto the clone before rasterizing. */
function inlineComputedStylesForCapture(original: Element, clone: Element) {
  if (
    !(original instanceof HTMLElement || original instanceof SVGElement) ||
    !(clone instanceof HTMLElement || clone instanceof SVGElement)
  ) {
    return
  }
  const computed = window.getComputedStyle(original)
  for (let i = 0; i < computed.length; i++) {
    const name = computed.item(i)
    const value = computed.getPropertyValue(name)
    const priority = computed.getPropertyPriority(name)
    const safe = coerceStyleValueForHtml2Canvas(name, value, priority)
    clone.style.setProperty(name, safe, priority as "important" | "")
  }
  clone.removeAttribute("class")
  for (let i = 0; i < original.children.length; i++) {
    inlineComputedStylesForCapture(original.children[i], clone.children[i])
  }
}

/** Tailwind v4 emits oklch/lab in cloned <style> tags; html2canvas throws when parsing those rules. */
function stripClonedDocumentStyles(documentClone: Document) {
  documentClone
    .querySelectorAll('style, link[rel="stylesheet"], link[rel~="stylesheet"]')
    .forEach((node) => node.remove())
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

  const [step, setStep] = useState<StepId>(1)
  const [sessionInput, setSessionInput] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [practicePackage, setPracticePackage] = useState<PracticePackage | null>(null)

  const worksheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
    setAnalysis(session.analysis as AnalysisResult | null)

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

  const handleDownloadPdf = async () => {
    if (!worksheetRef.current) return
    setIsExporting(true)
    try {
      const [jsPDF, html2canvas] = await Promise.all([
        import("jspdf").then((m) => m.default),
        import("html2canvas").then((m) => m.default),
      ])
      const canvas = await html2canvas(worksheetRef.current, {
        scale: 2,
        onclone: (documentClone, clonedRoot) => {
          const orig = worksheetRef.current
          if (orig && clonedRoot) inlineComputedStylesForCapture(orig, clonedRoot)
          stripClonedDocumentStyles(documentClone)
        },
      })
      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF("p", "mm", "a4")
      pdf.addImage(imgData, "PNG", 10, 10, 190, (canvas.height * 190) / canvas.width)
      pdf.save(`ALICE-practice-package-${clientId}.pdf`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleAnalyzeAndGenerate = async () => {
    if (!sessionInput) return
    setIsProcessing(true)
    try {
      // 1. Analyze
      const analyzeRes = await fetch(`${API_BASE}/analyze/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionNotes: sessionInput,
          clientId,
          sessionId,
        }),
      })
      const analyzeData = await analyzeRes.json()
      if (!analyzeRes.ok) throw new Error(analyzeData?.error || "Analysis failed")

      setAnalysis(analyzeData)

      // 2. Generate Practice Package
      const genRes = await fetch(`${API_BASE}/generate/practice-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionNotes: sessionInput,
          clientId,
          sessionId,
        }),
      })
      const genData = await genRes.json()
      if (!genRes.ok) throw new Error(genData?.error || "Practice package generation failed")

      setPracticePackage(genData)
      setStep(3)

      // 3. Save practice package to session
      await saveSessionContent(caseId, sessionId, {
        sessionNotes: sessionInput,
        analysis: analyzeData,
        practicePackage: genData,
      })
    } catch (err) {
      console.error(err)
      alert(err instanceof Error ? err.message : "Failed to generate practice package")
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
            <Button
              onClick={() => setStep(2)}
              className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg"
              disabled={!sessionInput || isProcessing}
            >
              Next
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right">
            <div className="p-6 rounded-[2rem] bg-blue-50/50 border border-blue-100 text-sm italic font-medium text-blue-900 leading-relaxed">
              {analysis?.rationale
                ? `"${analysis.rationale}"`
                : `"Ready to analyze and generate your practice package."`}
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
            <div
              ref={worksheetRef}
              className="p-10 border-2 rounded-[2.5rem] bg-white text-zinc-900 space-y-8 shadow-sm"
            >
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
                    {practicePackage.homework && practicePackage.homework.length > 0 ? (
                      <div className="space-y-4">
                      {practicePackage.homework.map((item: any, i) => (
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

                  {/* Section 2: Role Play Scenario */}
                  {false && (
                    <section>
                      <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">
                        2. Role Play Scenario
                      </h4>
                      {practicePackage.scenario ? (
                        <div className="space-y-3">
                          <div>
                            <span className="font-bold uppercase text-[10px] text-zinc-500 mr-2">
                              Title:
                            </span>
                            <span className="font-bold text-zinc-800">{practicePackage.scenario.title}</span>
                          </div>
                          <div>
                            <span className="font-bold uppercase text-[10px] text-zinc-500 mr-2">
                              Difficulty:
                            </span>
                            <span className="text-zinc-700">{practicePackage.scenario.difficulty}</span>
                          </div>
                          <div>
                            <span className="font-bold uppercase text-[10px] text-zinc-500 mr-2">
                              Situation:
                            </span>
                            <span className="text-zinc-700">{practicePackage.scenario.situation}</span>
                          </div>
                          <div>
                            <span className="font-bold uppercase text-[10px] text-zinc-500 mr-2">
                              Objectives:
                            </span>
                            {practicePackage.scenario.objectives &&
                            practicePackage.scenario.objectives.length > 0 ? (
                              <ul className="list-disc ml-6 text-zinc-800">
                                {practicePackage.scenario.objectives.map((obj, i) => (
                                  <li key={i} className="text-xs">{obj}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-zinc-500 italic">None</span>
                            )}
                          </div>
                          <div>
                            <span className="font-bold uppercase text-[10px] text-zinc-500 mr-2">
                              Coach Tips:
                            </span>
                            {practicePackage.scenario.coachTips &&
                            practicePackage.scenario.coachTips.length > 0 ? (
                              <ul className="list-disc ml-6 text-zinc-800">
                                {practicePackage.scenario.coachTips.map((tip, i) => (
                                  <li key={i} className="text-xs">{tip}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-zinc-500 italic">None</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-zinc-400 italic">No role play scenario provided.</div>
                      )}
                    </section>
                  )}
             

                  {/* Section 3: Quiz */}
                  {false && (
                    <section>
                      <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">
                        3. Quiz
                      </h4>
                      {practicePackage.quiz && practicePackage.quiz.length > 0 ? (
                        <div className="space-y-6">
                          {practicePackage.quiz.map((qz, i) => (
                            <div
                              key={i}
                              className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 space-y-1"
                            >
                              <div>
                                <span className="font-bold uppercase text-[10px] text-zinc-500 mr-2">
                                  Q{i + 1}:
                                </span>
                                <span className="text-zinc-700 font-medium">{qz.question}</span>
                              </div>
                              <div>
                                <span className="font-bold uppercase text-[10px] text-green-700 mr-2">
                                  Answer:
                                </span>
                                <span className="text-zinc-700">{qz.answer}</span>
                              </div>
                              <div>
                                <span className="font-bold uppercase text-[10px] text-blue-600 mr-2">
                                  Rationale:
                                </span>
                                <span className="text-zinc-700">{qz.rationale}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-zinc-400 italic">No quiz provided.</div>
                      )}
                    </section>
                  )}
             
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
                disabled={isExporting}
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