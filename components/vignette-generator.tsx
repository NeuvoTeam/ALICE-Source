"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { 
  CheckCircle2, 
  Download, 
  FileCheck, 
  Loader2, 
  Sparkles, 
  ClipboardPaste,
  AlertTriangle,
  FileText,
  HelpCircle,
  PencilLine,
  BrainCircuit,
  Activity,
  ShieldCheck
} from "lucide-react"
import { CLINICAL_AI_API_BASE as API_BASE } from "@/lib/clinical-ai-api"

type StepId = 1 | 2 | 3

interface AnalysisResult {
  formulationId?: string
  inferredModality?: string
  riskFlags: any[]
  rationale: string
}

const MODALITIES = [
  { value: "cbt", label: "Cognitive Behavioral Therapy (CBT)" },
  { value: "dbt", label: "Dialectical Behavior Therapy (DBT)" },
  { value: "act", label: "Acceptance & Commitment Therapy (ACT)" },
]

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
function coerceStyleValueForHtml2Canvas(prop: string, value: string, priority: string): string {
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

export default function VignetteGenerator({ clientId }: { clientId: string }) {
  const [step, setStep] = useState<StepId>(1)
  const [sessionInput, setSessionInput] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [modality, setModality] = useState("cbt")
  const [content, setContent] = useState({ 
    scenario: "", 
    quiz: [] as string[], 
    homework: [] as string[] 
  })

  const worksheetRef = useRef<HTMLDivElement>(null)

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
      pdf.save(`ALICE-worksheet-${clientId}.pdf`)
    } finally {
      setIsExporting(false)
    }
  }

  const handleAnalyze = async () => {
    if (!sessionInput) return
    setIsAnalyzing(true)
    try {
      const res = await fetch(`${API_BASE}/analyze/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionNotes: sessionInput, clientId }),
      })
      const data = await res.json()
      setAnalysis(data)
      if (data.inferredModality) setModality(data.inferredModality.toLowerCase())
      setStep(2)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const res = await fetch(`${API_BASE}/generate/vignette`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionNotes: sessionInput, verifiedModality: modality, clientId }),
      })
      const data = await res.json()
      
      setContent({
        scenario: data.scenario || "The client presented with symptoms consistent with the selected modality. The session focused on the intersection of cognitive distortions and physiological arousal. We practiced identifying 'hot thoughts' and applying grounding techniques to reduce emotional intensity. Moving forward, the clinical objective is to reinforce adaptive coping mechanisms identified today.",
        quiz: data.quiz || [
          "What was the primary physiological trigger identified today?",
          "Can you describe the core skill we practiced to manage this?",
          "How will you recognize the need to apply this skill this week?"
        ],
        homework: data.homework || [
          `Complete one ${modality.toUpperCase()} digital entry daily.`,
          "Identify one situation to apply the target skill.",
          "Rate your distress before and after skill usage."
        ]
      })
      setStep(3)
    } finally {
      setIsGenerating(false)
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
            <CardTitle className="text-xl font-black tracking-tight text-zinc-800 uppercase">ALICE Clinical</CardTitle>
          </div>
          <div className="px-3 py-1 bg-white border rounded-full text-[10px] font-bold text-zinc-400">PHASE {step}</div>
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
                placeholder="Paste Heidi notes here..."
                className="min-h-[220px] text-base p-6 bg-zinc-50 border-2 rounded-[2rem] focus:border-primary/20"
              />
              <Button onClick={handleHeidiImport} variant="outline" size="sm" className="absolute top-4 right-4 rounded-full bg-white shadow-sm">
                <ClipboardPaste className="h-4 w-4 mr-2" /> Paste from Heidi
              </Button>
            </div>
            <Button onClick={handleAnalyze} className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg" disabled={!sessionInput || isAnalyzing}>
              {isAnalyzing ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />} Analyze Context
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right">
            <div className="p-6 rounded-[2rem] bg-blue-50/50 border border-blue-100 text-sm italic font-medium text-blue-900 leading-relaxed">
              "{analysis?.rationale || "Synthesizing formulation details..."}"
            </div>
            
            {/* CLINICAL CONFIDENCE SECTION */}
            <div className="grid grid-cols-2 gap-3">
              {analysis?.riskFlags.map((flag: any, i: number) => (
                <div key={i} className="p-3 rounded-2xl border bg-zinc-50 border-zinc-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-3 w-3 ${flag?.severity === 'high' ? 'text-red-500' : 'text-zinc-400'}`} />
                      <span className="text-[10px] font-black text-zinc-700 uppercase">
                        {typeof flag === 'object' ? flag.label : flag}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-zinc-400">
                      {Math.round((flag?.confidence || 0.85) * 100)}%
                    </span>
                  </div>
                  <div className="h-1 w-full bg-zinc-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${flag?.severity === 'high' ? 'bg-red-400' : 'bg-primary'}`}
                      style={{ width: `${(flag?.confidence || 0.85) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-2">Framework Selection</label>
              <Select value={modality} onValueChange={setModality}>
                <SelectTrigger className="h-14 rounded-2xl border-2 font-bold text-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODALITIES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="ghost" onClick={() => setStep(1)} className="flex-1 h-12 rounded-xl">Back</Button>
              <Button onClick={handleGenerate} className="flex-[2] h-12 rounded-xl text-md font-bold" disabled={isGenerating}>
                {isGenerating ? <Loader2 className="animate-spin mr-2" /> : "Build Clinical Worksheet"}
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
                  <h3 className="text-2xl font-black uppercase tracking-tight leading-none">Clinical Practice</h3>
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mt-3">{modality} Technique Integration</p>
                </div>
                <div className="h-10 w-10 bg-green-50 border border-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="text-green-600 h-6 w-6" />
                </div>
              </div>
              
              <div className="space-y-8">
                <section>
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">I. Case Summary (5-Line Narrative)</h4>
                  <p className="leading-relaxed text-zinc-800 text-sm font-medium line-clamp-5">{content.scenario}</p>
                </section>

                <section className="bg-zinc-50/80 p-7 rounded-[2rem] border border-zinc-100">
                  <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-5 flex items-center gap-2">
                    <HelpCircle className="h-3 w-3" /> II. Skills Retrieval Quiz
                  </h4>
                  <div className="space-y-5">
                    {content.quiz.map((q, i) => (
                      <div key={i} className="flex gap-3 items-start border-b border-dashed border-zinc-200 pb-2">
                        <span className="text-xs font-black text-primary">{i+1}.</span>
                        <p className="text-xs text-zinc-700 font-bold leading-tight">{q}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bg-white p-7 border-2 border-primary/10 rounded-[2.5rem]">
                  <h4 className="text-[10px] font-black text-primary uppercase mb-5 flex items-center gap-2">
                    <Activity className="h-3 w-3" /> III. Digital {modality.toUpperCase()} Template Preview
                  </h4>
                  
                  {modality === 'cbt' ? (
                    <div className="space-y-3">
                      <div className="p-4 bg-zinc-50 rounded-xl border text-[10px] font-bold text-zinc-500">Trigger [Typeform Text Field]</div>
                      <div className="p-4 bg-zinc-50 rounded-xl border text-[10px] font-bold text-zinc-500">The Hot Thought [Typeform Long Text]</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-[10px] font-black text-green-700">Evidence FOR</div>
                        <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-[10px] font-black text-red-700">Evidence AGAINST</div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-4 bg-zinc-50 rounded-xl border text-[10px] font-bold text-zinc-500">Urge to Act (0-5 Rating)</div>
                      <div className="p-4 bg-zinc-50 rounded-xl border text-[10px] font-bold text-zinc-500">Emotion Intensity (0-100%)</div>
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-[10px] font-black text-blue-700">Target Skill Used [Dropdown]</div>
                    </div>
                  )}
                </section>

                <section>
                  <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <PencilLine className="h-3 w-3" /> IV. Homework Tasks (Dot Points)
                  </h4>
                  <ul className="space-y-3 ml-2">
                    {content.homework.map((item, i) => (
                      <li key={i} className="text-xs text-zinc-600 font-medium flex items-start gap-3">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary/40 mt-1.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="h-12 rounded-2xl">Adjust</Button>
              <Button onClick={handleDownloadPdf} className="flex-1 bg-zinc-900 text-white h-12 rounded-2xl font-bold" disabled={isExporting}>
                {isExporting ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2" />} Export PDF
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}