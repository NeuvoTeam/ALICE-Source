"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { VignetteGenerator } from "@/components/vignette-generator"

import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileCheck,
  ScrollText,
} from "lucide-react"

/* ─────────────────────────────
   Constants & Types
───────────────────────────── */

const API_BASE = "https://clinical-ai-backend.neuvoteam.workers.dev"
const CLIENT_ID = "0d4593bf-ab30-413e-bd17-0982685fad86"

interface RiskFlag {
  label: string
  severity: "low" | "moderate" | "high" | "unspecified"
  confidence: number
  evidence: string[]
}

interface AnalysisResult {
  inferredModality?: string
  riskFlags: RiskFlag[]
  rationale: string
}

interface SavedVignette {
  id: string
  content: string
  created_at: string
}

interface MainContentProps {
  activeTab: "vignette" | "summaries"
}

const MODALITIES = [
  { value: "cbt", label: "Cognitive Behavioral Therapy (CBT)" },
  { value: "dbt", label: "Dialectical Behavior Therapy (DBT)" },
  { value: "psychodynamic", label: "Psychodynamic Therapy" },
  { value: "humanistic", label: "Humanistic / Person-Centered" },
  { value: "emdr", label: "EMDR" },
  { value: "act", label: "Acceptance & Commitment Therapy (ACT)" },
  { value: "motivational", label: "Motivational Interviewing" },
]

/* ─────────────────────────────
   Helpers
───────────────────────────── */

/**
 * Normalise risk flags so the UI never crashes
 * and remains backward compatible.
 */
function normalizeRiskFlags(raw: any[]): RiskFlag[] {
  return raw.map((flag) => {
    if (typeof flag === "string") {
      return {
        label: flag,
        severity: "unspecified",
        confidence: 0.5,
        evidence: [],
      }
    }

    return {
      label: flag.label ?? "Unspecified risk",
      severity: flag.severity ?? "unspecified",
      confidence:
        typeof flag.confidence === "number" ? flag.confidence : 0.5,
      evidence: Array.isArray(flag.evidence) ? flag.evidence : [],
    }
  })
}

/**
 * Highlight evidence phrases inline in the clinical rationale.
 */
function highlightRationale(rationale: string, flags: RiskFlag[]) {
  let html = rationale

  flags.forEach((flag) => {
    flag.evidence.forEach((phrase) => {
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const regex = new RegExp(`(${escaped})`, "gi")
      html = html.replace(
        regex,
        `<mark class="bg-amber-200 rounded px-1">$1</mark>`
      )
    })
  })

  return html
}

/* ─────────────────────────────
   Component
───────────────────────────── */

export function MainContent({ activeTab }: MainContentProps) {
  const { toast } = useToast()

  /* ── Primary State ── */
  const [sessionInput, setSessionInput] = useState("")
  const [analysisResult, setAnalysisResult] =
    useState<AnalysisResult | null>(null)
  const [editableRationale, setEditableRationale] = useState("")
  const [selectedModality, setSelectedModality] = useState("cbt")

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const [vignetteContent, setVignetteContent] = useState("")
  const [savedVignettes, setSavedVignettes] = useState<SavedVignette[]>([])

  /* ─────────────────────────────
     Fetch saved vignettes
  ───────────────────────────── */

  const fetchVignettes = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/vignettes?clientId=${CLIENT_ID}`
      )
      const text = await res.text()
      setSavedVignettes(JSON.parse(text))
    } catch (err) {
      console.error("Failed to fetch vignettes", err)
    }
  }

  useEffect(() => {
    if (activeTab === "vignette") {
      fetchVignettes()
    }
  }, [activeTab])

  /* ─────────────────────────────
     Handlers
  ───────────────────────────── */

  const handleAnalyze = async () => {
    if (!sessionInput.trim()) return

    setIsAnalyzing(true)
    setAnalysisResult(null)
    setVignetteContent("")

    try {
      const res = await fetch(`${API_BASE}/analyze/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionNotes: sessionInput,
          clientId: CLIENT_ID,
        }),
      })

      const data = await res.json()
      const normalizedFlags = normalizeRiskFlags(
        Array.isArray(data.riskFlags) ? data.riskFlags : []
      )

      setAnalysisResult({
        inferredModality: data.inferredModality,
        rationale: data.rationale || "",
        riskFlags: normalizedFlags,
      })

      setEditableRationale(data.rationale || "")

      if (data.inferredModality) {
        const match = MODALITIES.find(
          (m) => m.value === data.inferredModality.toLowerCase()
        )
        if (match) setSelectedModality(match.value)
      }
    } catch (err) {
      console.error(err)
      toast({
        title: "Analysis Error",
        description: "Unable to analyze session notes.",
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleGenerateVignette = async () => {
    if (!analysisResult) return

    setIsGenerating(true)

    try {
      const res = await fetch(`${API_BASE}/generate/vignette`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionNotes: sessionInput,
          verifiedModality: selectedModality,
          clientId: CLIENT_ID,
        }),
      })

      const data = await res.json()

      // Defensive guard: never render JSON as vignette
      if (String(data.content).trim().startsWith("{")) {
        throw new Error("Invalid vignette output")
      }

      setVignetteContent(data.content)

      toast({
        title: "Vignette Created",
        description: "Saved to client record.",
      })

      fetchVignettes()
    } catch (err) {
      console.error(err)
      toast({
        title: "Generation Error",
        description: "Failed to generate vignette.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  /* ─────────────────────────────
     Render
  ───────────────────────────── */

  if (activeTab === "summaries") {
    return (
      <main className="p-8 text-center text-muted-foreground">
        <ScrollText className="mx-auto mb-4" />
        Session summaries coming soon.
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-auto bg-background p-8">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Session Input */}
        <Card>
          <CardHeader>
            <CardTitle>Session Input</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={sessionInput}
              onChange={(e) => setSessionInput(e.target.value)}
              placeholder="Enter session notes..."
              className="min-h-[160px] mb-4"
            />
            <Button onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              Analyze
            </Button>
          </CardContent>
        </Card>

        {/* Analysis Review */}
        {analysisResult && (
          <Card>
            <CardHeader>
              <CardTitle>Risk Flags & Clinical Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Risk Flags */}
              {analysisResult.riskFlags.length > 0 ? (
                analysisResult.riskFlags.map((flag, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 ${
                      flag.severity === "high"
                        ? "bg-red-50 border-red-200"
                        : flag.severity === "moderate"
                        ? "bg-amber-50 border-amber-200"
                        : flag.severity === "low"
                        ? "bg-green-50 border-green-200"
                        : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">{flag.label}</span>
                      <span className="text-xs text-muted-foreground">
                        Confidence:{" "}
                        {Math.round(flag.confidence * 100)}%
                      </span>
                    </div>

                    <div className="text-xs italic text-muted-foreground">
                      Severity:{" "}
                      {flag.severity === "unspecified"
                        ? "NOT SPECIFIED – review manually"
                        : flag.severity.toUpperCase()}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  No significant risks identified
                </div>
              )}

              {/* Inline highlighted rationale */}
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{
                  __html: highlightRationale(
                    editableRationale,
                    analysisResult.riskFlags
                  ),
                }}
              />

              {/* Modality Verification */}
              <Select
                value={selectedModality}
                onValueChange={setSelectedModality}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select modality" />
                </SelectTrigger>
                <SelectContent>
                  {MODALITIES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="secondary"
                onClick={handleGenerateVignette}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <FileCheck />
                )}
                Verify & Generate Vignette
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Generated Vignette */}
        {vignetteContent && (
          <VignetteGenerator
            clientId={CLIENT_ID}
            scenario={vignetteContent}
          />
        )}

        {/* Historical Vignettes (Audit Ready) */}
        {savedVignettes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Previous Vignettes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {savedVignettes.map((v) => (
                <Card key={v.id} className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">
                    Generated:{" "}
                    {new Date(v.created_at).toLocaleString()}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">
                    {v.content}
                  </p>
                </Card>
              ))}
            </CardContent>
          </Card>
        )}

      </div>
    </main>
  )
}