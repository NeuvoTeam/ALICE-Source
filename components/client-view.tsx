"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Calendar, AlertCircle, Loader2, ChevronLeft, Send } from "lucide-react"
import { CLINICAL_AI_API_BASE as API_BASE } from "@/lib/clinical-ai-api"
import { Client } from "@/types";

// ✅ moved OUTSIDE component (important)
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

export function ClientView({ client }: { client: Client }) {

  const CLIENT_ID = client.id;

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

      setWorksheetAnswers({})
      alert("Your responses have been submitted successfully!")
    } catch (err) {
      console.error("Submit error:", err)
      alert("Failed to submit responses. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const getWorksheetQuestions = (vignette: AssignedVignette): string[] => {
    if (vignette.worksheetQuestions && vignette.worksheetQuestions.length > 0) {
      return vignette.worksheetQuestions
    }

    return [
      "What feelings came up for you while reading this scenario?",
      "How might you apply the skill described to your own life?",
      "What challenges do you anticipate when practicing this skill?",
    ]
  }

  // ✅ FIX: re-fetch when client changes
  useEffect(() => {
    setIsLoading(true)

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
  }, [CLIENT_ID]) // ✅ critical fix

  // =========================
  // SELECTED VIEW
  // =========================
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
              <Tabs defaultValue="scenario">

                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="scenario">Scenario</TabsTrigger>
                  <TabsTrigger value="skill">Skill</TabsTrigger>
                  <TabsTrigger value="worksheet">Reflection</TabsTrigger>
                </TabsList>

                <TabsContent value="scenario">
                  <p>{selectedVignette.scenario || selectedVignette.content}</p>
                </TabsContent>

                <TabsContent value="skill">
                  <p>{selectedVignette.skill || "Review the scenario."}</p>
                </TabsContent>

                <TabsContent value="worksheet">
                  {questions.map((q, i) => (
                    <div key={i}>
                      <p>{q}</p>
                      <Textarea
                        value={worksheetAnswers[i] || ""}
                        onChange={(e) => handleAnswerChange(i, e.target.value)}
                      />
                    </div>
                  ))}

                  <Button onClick={handleSubmitWorksheet}>
                    {isSubmitting ? "Submitting..." : "Submit"}
                  </Button>
                </TabsContent>

              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  // =========================
  // LIST VIEW
  // =========================
  return (
    <main className="flex-1 overflow-auto bg-background p-8">

      <h2 className="text-xl mb-4">{client.name} — Materials</h2>

      {isLoading && <Loader2 className="animate-spin" />}

      {error && <p>Error loading data</p>}

      {vignettes.map((v) => (
        <Card key={v.id} onClick={() => handleSelectVignette(v)}>
          <CardContent>
            <p>{v.title || "Vignette"}</p>
          </CardContent>
        </Card>
      ))}

    </main>
  )
}