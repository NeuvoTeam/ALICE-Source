"use client"

import { useState } from "react"

import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VignetteGenerator } from "@/components/vignette-generator"
import { 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  FileCheck,
  ScrollText
} from "lucide-react"

const API_BASE = "https://clinical-ai-backend.neuvoteam.workers.dev"

interface AnalysisResult {
  formulationId?: string
  inferredModality?: string
  riskFlags: string[]
  rationale: string
}

interface MainContentProps {
  activeTab: "vignette" | "summaries"
}

const MODALITIES = [
  { value: "cbt", label: "Cognitive Behavioral Therapy (CBT)" },
  { value: "dbt", label: "Dialectical Behavior Therapy (DBT)" },
  { value: "psychodynamic", label: "Psychodynamic Therapy" },
  { value: "humanistic", label: "Humanistic/Person-Centered" },
  { value: "emdr", label: "EMDR" },
  { value: "act", label: "Acceptance & Commitment Therapy (ACT)" },
  { value: "motivational", label: "Motivational Interviewing" },
]

export function MainContent({ activeTab }: MainContentProps) {
  const { toast } = useToast()
  const [selectedClientId] = useState("0d4593bf-ab30-413e-bd17-0982685fad86")
  const [sessionInput, setSessionInput] = useState<string>("")
  const [selectedModality, setSelectedModality] = useState<string>("cbt")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [editableRationale, setEditableRationale] = useState<string>("")
  const [isGeneratingVignette, setIsGeneratingVignette] = useState(false)
  const [vignetteScenario, setVignetteScenario] = useState<string>("")
  const [vignetteSkill, setVignetteSkill] = useState<string>("")
  const [vignetteReflection, setVignetteReflection] = useState<string>("")

  const handleAnalyze = async () => {
    if (!sessionInput.trim()) return
    
    setIsAnalyzing(true)
    setAnalysisResult(null)
    setVignetteScenario("")
    setVignetteSkill("")
    setVignetteReflection("")
    
    try {
      const response = await fetch(`${API_BASE}/analyze/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sessionNotes: sessionInput,
          clientId: selectedClientId,
        }),
      })
      
      if (!response.ok) throw new Error("Analysis failed")
      
      const data = await response.json()
      setAnalysisResult({
        formulationId: data.formulationId,
        inferredModality: data.inferredModality,
        riskFlags: Array.isArray(data.riskFlags) ? data.riskFlags : [],
        rationale: data.rationale || "",
      })
      setEditableRationale(data.rationale || "")
      
      // Auto-select the inferred modality if available
      if (data.inferredModality) {
        const matchedModality = MODALITIES.find(
          (m) => m.value.toLowerCase() === data.inferredModality.toLowerCase()
        )
        if (matchedModality) {
          setSelectedModality(matchedModality.value)
        }
      }
    } catch (error) {
      console.error("Analysis error:", error)
      setAnalysisResult({
        riskFlags: ["Error occurred during analysis"],
        rationale: "Unable to analyze session. Please try again.",
      })
      setEditableRationale("Unable to analyze session. Please try again.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleGenerateVignette = async () => {
    if (!analysisResult) return
    
    setIsGeneratingVignette(true)
    
    try {
      const payload: {
        sessionNotes: string
        verifiedModality: string
        clientId: string
        formulationId?: string
      } = {
        sessionNotes: sessionInput,
        verifiedModality: selectedModality,
        clientId: selectedClientId,
      }
      
      if (analysisResult.formulationId) {
        payload.formulationId = analysisResult.formulationId
      }
      
      const response = await fetch(`${API_BASE}/generate/vignette`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      
      if (!response.ok) throw new Error("Vignette generation failed")
      
      const data = await response.json()
      
      // Parse the response - expect scenario, skill, reflection or fall back to full content
      setVignetteScenario(data.scenario || data.vignette || data.content || "")
      setVignetteSkill(data.skill || "")
      setVignetteReflection(data.reflection || "")
      
      toast({
        title: "Saved to Client Record",
        description: "The vignette has been successfully saved to the client's record.",
      })
    } catch (error) {
      console.error("Vignette generation error:", error)
      setVignetteScenario("Unable to generate vignette. Please try again.")
      setVignetteSkill("")
      setVignetteReflection("")
      toast({
        title: "Error",
        description: "Failed to save vignette. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingVignette(false)
    }
  }

  if (activeTab === "summaries") {
    return (
      <main className="flex-1 overflow-auto bg-background p-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-6 text-2xl font-semibold text-foreground">Session Summaries</h2>
          <Card>
            <CardContent className="flex min-h-[400px] items-center justify-center p-12">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <ScrollText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-medium text-foreground">Coming Soon</h3>
                <p className="text-muted-foreground">
                  AI-powered session summaries will be available in a future update.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-auto bg-background p-8">
      <div className="mx-auto max-w-4xl">
        <h2 className="mb-2 text-2xl font-semibold text-foreground">Session Analysis</h2>
        <p className="mb-6 text-muted-foreground">
          Enter session notes for AI-powered risk analysis and vignette generation.
        </p>

        {/* Session Input */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base font-medium">Session Input</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Enter your session notes here... Include observations, client statements, and clinical impressions."
              value={sessionInput}
              onChange={(e) => setSessionInput(e.target.value)}
              className="mb-4 min-h-[180px] resize-y bg-input"
            />
            <Button 
              onClick={handleAnalyze} 
              disabled={!sessionInput.trim() || isAnalyzing}
              className="gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analyze
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysisResult && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Risk Flags & Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Risk Flags */}
              <div className="mb-4">
                <p className="mb-2 text-sm font-medium text-foreground">Identified Risk Flags:</p>
                {analysisResult.riskFlags && analysisResult.riskFlags.length > 0 ? (
                  <ul className="space-y-2">
                    {analysisResult.riskFlags.map((flag, index) => (
                      <li 
                        key={index}
                        className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        {flag}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    No significant risk flags identified.
                  </div>
                )}
              </div>

              {/* Editable Rationale */}
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">
                  Clinical Rationale <span className="font-normal text-muted-foreground">(editable)</span>
                </p>
                <Textarea
                  value={editableRationale}
                  onChange={(e) => setEditableRationale(e.target.value)}
                  className="min-h-[120px] resize-y bg-input"
                  placeholder="AI-generated rationale will appear here..."
                />
              </div>

              {/* Modality Selector */}
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-foreground">
                  Verified Modality
                  {analysisResult.inferredModality && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      (AI suggested: {analysisResult.inferredModality})
                    </span>
                  )}
                </p>
                <Select value={selectedModality} onValueChange={setSelectedModality}>
                  <SelectTrigger className="w-full max-w-sm">
                    <SelectValue placeholder="Select modality" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODALITIES.map((modality) => (
                      <SelectItem key={modality.value} value={modality.value}>
                        {modality.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Generate Vignette Button */}
              <div className="mt-4">
                <Button 
                  onClick={handleGenerateVignette}
                  disabled={isGeneratingVignette}
                  variant="secondary"
                  className="gap-2"
                >
                  {isGeneratingVignette ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating Vignette...
                    </>
                  ) : (
                    <>
                      <FileCheck className="h-4 w-4" />
                      Verify & Generate Vignette
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {vignetteScenario && (
          <VignetteGenerator
            scenario={vignetteScenario}
            skill={vignetteSkill}
            reflection={vignetteReflection}
            clientId={selectedClientId}
          />
        )}
      </div>
    </main>
  )
}
