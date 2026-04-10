"use client"

import { useCallback, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { FileCheck, Loader2, Sparkles } from "lucide-react"

type StepId = 1 | 2 | 3

interface AnalysisResult {
  formulationId?: string
  inferredModality?: string
  riskFlags: string[]
  rationale: string
}

const MODALITIES = [
  { value: "cbt", label: "Cognitive Behavioral Therapy (CBT)" },
  { value: "dbt", label: "Dialectical Behavior Therapy (DBT)" },
  { value: "act", label: "Acceptance & Commitment Therapy (ACT)" },
  { value: "psychodynamic", label: "Psychodynamic Therapy" },
  { value: "humanistic", label: "Humanistic/Person-Centered" },
]

interface VignetteGeneratorProps {
  clientId: string
  scenario?: string
  skill?: string
  reflection?: string
}

export function VignetteGenerator({
  clientId,
  scenario: externalScenario,
  skill: externalSkill,
  reflection: externalReflection,
}: VignetteGeneratorProps) {
  // 1. Setup API Base from your .env.local
  const API_BASE = "https://clinical-ai-backend.neuvoteam.workers.dev"
  
  const [step, setStep] = useState<StepId>(1)
  const [sessionInput, setSessionInput] = useState<string>("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [editableRationale, setEditableRationale] = useState<string>("")
  const [selectedModality, setSelectedModality] = useState<string>("cbt")

  const [isGeneratingVignette, setIsGeneratingVignette] = useState(false)
  const [scenario, setScenario] = useState<string>("")
  const [skill, setSkill] = useState<string>("")
  const [reflection, setReflection] = useState<string>("")

  const resolvedScenario = externalScenario ?? scenario
  const resolvedSkill = externalSkill ?? skill
  const resolvedReflection = externalReflection ?? reflection

  const isExternalVignette = Boolean(externalScenario)

  const worksheetRef = useRef<HTMLDivElement>(null)

  const progress = step === 1 ? 33 : step === 2 ? 66 : 100

  const handleAnalyze = useCallback(async () => {
    if (!sessionInput.trim()) return
    setIsAnalyzing(true)
    try {
      const response = await fetch(`${API_BASE}/analyze/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionNotes: sessionInput, clientId }),
      })
      const data = await response.json()
      setAnalysisResult(data)
      setEditableRationale(data.rationale || "")
      if (data.inferredModality) setSelectedModality(data.inferredModality.toLowerCase())
      setStep(2)
    } catch (e) {
      console.error(e)
    } finally {
      setIsAnalyzing(false)
    }
  }, [clientId, sessionInput])

  const handleGenerateVignette = useCallback(async () => {
    setIsGeneratingVignette(true)
    try {
      const response = await fetch(`${API_BASE}/generate/vignette`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionNotes: sessionInput,
          verifiedModality: selectedModality,
          clientId,
        }),
      })
      const data = await response.json()
      // Support common Gemini response formats
      setScenario(data.scenario || data.content || "")
      setSkill(data.skill || "Skill practice based on " + selectedModality.toUpperCase())
      setReflection(data.reflection || "Reflect on how this applies to your week.")
      setStep(3)
    } catch (e) {
      console.error(e)
    } finally {
      setIsGeneratingVignette(false)
    }
  }, [clientId, selectedModality, sessionInput])

  return (
    <Card className="max-w-2xl mx-auto border-none shadow-none bg-transparent">
      <CardHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Progress value={progress} className="h-1" />
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              Step {step} of 3
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {step === 1 && (
          <div className="space-y-8 text-center py-10">
            <h2 className="text-3xl font-medium tracking-tight">How can I help you today?</h2>
            <Textarea
              value={sessionInput}
              onChange={(e) => setSessionInput(e.target.value)}
              placeholder="Type or paste session notes..."
              className="min-h-[150px] text-lg border-none focus-visible:ring-0 bg-muted/20 rounded-2xl p-6"
            />
            <Button 
              size="lg" 
              onClick={handleAnalyze} 
              disabled={isAnalyzing || !sessionInput}
              className="rounded-full px-10 bg-black text-white hover:bg-zinc-800"
            >
              {isAnalyzing ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
              Analyze Session
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
             <div className="space-y-2">
                <label className="text-sm font-medium">Verify Clinical Modality</label>
                <Select value={selectedModality} onValueChange={setSelectedModality}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODALITIES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
             </div>
             <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
                <p className="text-xs font-bold text-orange-800 uppercase mb-2">Risk Flags</p>
                <ul className="text-sm text-orange-900 list-disc pl-4">
                  {analysisResult?.riskFlags?.map((flag, i) => <li key={i}>{flag}</li>) || <li>No risks detected</li>}
                </ul>
             </div>
             <div className="flex justify-between pt-4">
               <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
               <Button onClick={handleGenerateVignette} disabled={isGeneratingVignette}>
                 {isGeneratingVignette ? <Loader2 className="animate-spin mr-2" /> : <FileCheck className="mr-2" />}
                 Verify & Generate Worksheet
               </Button>
             </div>
          </div>
        )}

        {(step === 3 || isExternalVignette) && (
          <div className="space-y-6">
            <div
              id="worksheet"
              ref={worksheetRef}
              className="p-8 border rounded-2xl bg-white shadow-sm space-y-8"
            >
              <div className="border-b pb-4">
                <h3 className="text-xl font-bold text-zinc-900">
                  Therapeutic Homework
                </h3>
                <p className="text-sm text-muted-foreground">
                  Focused on {selectedModality.toUpperCase()}
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase text-zinc-400">
                  The Scenario
                </h4>
                <p className="text-zinc-700 leading-relaxed">
                  {resolvedScenario}
                </p>
              </div>

              {resolvedSkill && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-zinc-400">
                    The Skill
                  </h4>
                  <p className="text-zinc-700 leading-relaxed">
                    {resolvedSkill}
                  </p>
                </div>
              )}

              {resolvedReflection && (
                <div className="pt-6 border-t">
                  <h4 className="text-sm font-bold mb-4 italic">
                    Reflection Exercise:
                  </h4>
                  <p className="text-zinc-700 leading-relaxed">
                    {resolvedReflection}
                  </p>
                </div>
              )}
            </div>

            {!isExternalVignette && (
              <div className="flex justify-between items-center">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Back
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}