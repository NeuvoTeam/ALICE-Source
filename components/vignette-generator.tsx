"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { BrainCircuit, Sparkles, Loader2 } from "lucide-react"

interface VignetteGeneratorProps {
  clientId: string
  initialSessionNotes?: string
}

export default function VignetteGenerator({ clientId, initialSessionNotes = "" }: VignetteGeneratorProps) {
  const [step, setStep] = useState(1)
  const [sessionInput, setSessionInput] = useState(initialSessionNotes)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<any>(null)

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    
    // We send sessionNotes explicitly to match backend expectations
    const payload = {
      sessionNotes: typeof sessionInput === 'string' ? sessionInput : "",
      clientId: clientId
    }

    try {
      const response = await fetch('/api/analyze/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      // If we don't get a 200 OK, the text() method will reveal the HTML error page
      if (!response.ok) {
        const errorText = await response.text()
        console.error("SERVER ERROR HTML:", errorText)
        throw new Error(`Server returned ${response.status}: Route might be missing.`)
      }
      
      const data = await response.json()
      setAnalysisResult(data)
      setStep(2)
    } catch (error: any) {
      console.error("Fetch Error:", error)
      alert("Error: " + error.message + ". Check Console for details.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <Card className="max-w-2xl mx-auto border-t-4 border-primary rounded-3xl bg-white shadow-xl">
      <CardHeader className="pb-6 border-b">
        <CardTitle className="text-xl font-black uppercase text-zinc-800 flex items-center gap-2">
          <BrainCircuit className="text-primary" /> Bastion Clinical
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-8">
        {step === 1 && (
          <div className="space-y-4">
            <Textarea 
              value={sessionInput} 
              onChange={(e) => setSessionInput(e.target.value)}
              placeholder="Paste clinical notes here..."
              className="min-h-[200px] rounded-2xl"
            />
            <Button 
              type="button" 
              onClick={handleAnalyze} 
              className="w-full h-12 rounded-xl"
              disabled={isAnalyzing}
            >
              {isAnalyzing ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />} 
              Analyze Context
            </Button>
          </div>
        )}
        
        {step === 2 && (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200">
              <p className="text-sm font-semibold text-zinc-800 mb-2">Analysis Result:</p>
              <p className="text-sm text-zinc-600 whitespace-pre-wrap">
                {analysisResult?.vignette || "No vignette content returned."}
              </p>
            </div>
            <Button onClick={() => setStep(1)} variant="outline" className="w-full">Start New Analysis</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}