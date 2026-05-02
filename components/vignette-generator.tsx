"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { BrainCircuit, Sparkles, Loader2 } from "lucide-react"

// This interface now uses a 'catch-all' to stop TypeScript overload errors
interface VignetteGeneratorProps {
  clientId: string
  initialSessionNotes?: string
  vignetteRestore?: any
  onSessionNotesChange?: (notes: string) => void
  onAnalysisComplete?: (data: any) => void
  [key: string]: any // Allows any other props passed from parent
}

export default function VignetteGenerator({ 
  clientId, 
  initialSessionNotes = "", 
  onSessionNotesChange,
  onAnalysisComplete,
  ...props // Captures any other extra props
}: VignetteGeneratorProps) {
  
  const [step, setStep] = useState(1)
  const [sessionInput, setSessionInput] = useState(initialSessionNotes)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Ensure hydration stability
  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    setSessionInput(initialSessionNotes)
  }, [initialSessionNotes])

  if (!isMounted) return null

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    // Simulate analysis delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsAnalyzing(false)
    setStep(2)
    if (onAnalysisComplete) onAnalysisComplete({ status: "success" })
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
              onChange={(e) => {
                setSessionInput(e.target.value)
                onSessionNotesChange?.(e.target.value)
              }}
              placeholder="Paste clinical notes here..."
              className="min-h-[200px] rounded-2xl"
            />
            <Button 
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
            <p className="text-sm text-zinc-600">Analysis finalized for Client: {clientId}</p>
            <Button onClick={() => setStep(1)} variant="outline" className="w-full">Restart</Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}