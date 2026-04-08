"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Calendar, AlertCircle, Loader2, ChevronLeft, Send } from "lucide-react"

const API_BASE = "https://clinical-ai-backend.neuvoteam.workers.dev"
const CLIENT_ID = "01c80187-20bf-4a7b-9bbd-3a6f17399405"

interface AssignedVignette {
  id: string
  title?: string
  content: string
  scenario?: string
  skill?: string
  reflection?: string
  worksheetQuestions?: string[]
  createdAt?: string
  modality?: string
}

export function ClientView() {
  const [vignettes, setVignettes] = useState<AssignedVignette[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [selectedVignette, setSelectedVignette] = useState<AssignedVignette | null>(null)
  const [worksheetAnswers, setWorksheetAnswers] = useState<Record<number, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSelectVignette = (vignette: AssignedVignette) => {
    setSelectedVignette(vignette)
    setWorksheetAnswers({})
  }

  const handleAnswerChange = (questionIndex: number, value: string) => {
    setWorksheetAnswers((prev) => ({
      ...prev,
      [questionIndex]: value,
    }))
  }

  const handleSubmitWorksheet = async () => {
    if (!selectedVignette) return
    setIsSubmitting(true)
    try {
      await fetch(`${API_BASE}/client/worksheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: CLIENT_ID,
          vignetteId: selectedVignette.id,
          answers: worksheetAnswers,
        }),
      })
      // Reset after submission
      setWorksheetAnswers({})
      alert("Your responses have been submitted successfully!")
    } catch (err) {
      console.error("Submit error:", err)
      alert("Failed to submit responses. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Extract worksheet questions from content if not provided separately
  const getWorksheetQuestions = (vignette: AssignedVignette): string[] => {
    if (vignette.worksheetQuestions && vignette.worksheetQuestions.length > 0) {
      return vignette.worksheetQuestions
    }
    // Default reflection questions if none provided
    return [
      "What feelings came up for you while reading this scenario?",
      "How might you apply the skill described to your own life?",
      "What challenges do you anticipate when practicing this skill?",
    ]
  }

  useEffect(() => {
    const fetchVignettes = async () => {
      try {
        const response = await fetch(`${API_BASE}/client/history?clientId=${CLIENT_ID}`)
        if (!response.ok) throw new Error("Failed to fetch")
        const data = await response.json()
        setVignettes(data)
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"))
      } finally {
        setIsLoading(false)
      }
    }
    fetchVignettes()
  }, [])

  // Render selected vignette detail view
  if (selectedVignette) {
    const questions = getWorksheetQuestions(selectedVignette)
    
    return (
      <main className="flex-1 overflow-auto bg-background p-8">
        <div className="mx-auto max-w-3xl">
          <Button
            variant="ghost"
            onClick={() => setSelectedVignette(null)}
            className="mb-6 gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Materials
          </Button>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{selectedVignette.title || "Therapeutic Vignette"}</CardTitle>
              {selectedVignette.modality && (
                <span className="inline-block w-fit rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {selectedVignette.modality}
                </span>
              )}
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="scenario" className="w-full">
                <TabsList className="mb-4 grid w-full grid-cols-3">
                  <TabsTrigger value="scenario">The Scenario</TabsTrigger>
                  <TabsTrigger value="skill">The Skill</TabsTrigger>
                  <TabsTrigger value="worksheet">Your Reflection</TabsTrigger>
                </TabsList>
                
                <TabsContent value="scenario">
                  <div className="rounded-lg border border-border bg-muted/30 p-6">
                    <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                      {selectedVignette.scenario || selectedVignette.content || "No scenario content available."}
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="skill">
                  <div className="rounded-lg border border-border bg-muted/30 p-6">
                    <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                      {selectedVignette.skill || "Review the scenario and identify the coping skill being demonstrated."}
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="worksheet">
                  <div className="space-y-6">
                    {questions.map((question, index) => (
                      <div key={index} className="rounded-lg border border-border bg-muted/30 p-4">
                        <label className="mb-3 block font-medium text-foreground">
                          {index + 1}. {question}
                        </label>
                        <Textarea
                          placeholder="Type your answer here..."
                          value={worksheetAnswers[index] || ""}
                          onChange={(e) => handleAnswerChange(index, e.target.value)}
                          className="min-h-[100px] resize-y bg-background"
                        />
                      </div>
                    ))}
                    
                    <Button
                      onClick={handleSubmitWorksheet}
                      disabled={isSubmitting || Object.keys(worksheetAnswers).length === 0}
                      className="w-full gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Submit Reflection
                        </>
                      )}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-auto bg-background p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-2xl font-semibold text-foreground">Your Assigned Materials</h2>
          <p className="text-muted-foreground">
            Review the therapeutic vignettes assigned to you by your clinician.
          </p>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading your materials...</p>
          </div>
        )}

        {error && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="flex items-center gap-3 p-6">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <p className="text-sm text-destructive">
                Unable to load your materials. Please try again later or contact your clinician.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && vignettes.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-medium text-foreground">No Materials Yet</h3>
              <p className="text-muted-foreground">
                Your clinician has not assigned any vignettes yet. Check back later.
              </p>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && vignettes.length > 0 && (
          <div className="space-y-4">
            {vignettes.map((vignette) => (
              <Card 
                key={vignette.id} 
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => handleSelectVignette(vignette)}
              >
                <CardContent className="p-6">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="font-medium text-foreground">
                      {vignette.title || "Therapeutic Vignette"}
                    </h3>
                    {vignette.createdAt && (
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {new Date(vignette.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {vignette.modality && (
                    <span className="mb-3 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {vignette.modality}
                    </span>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
                    {vignette.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
