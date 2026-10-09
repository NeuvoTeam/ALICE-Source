"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { CLINICAL_AI_API_BASE as API_BASE } from "@/lib/clinical-ai-api"
import { apiFetch } from "@/lib/auth"
import { Client } from "@/types";
import { DynamicTaskForm } from "@/components/tasks/DynamicTaskForm"

interface AssignedMaterial {
  id: string
  title?: string
  content: string
  scenario?: string
  skill?: string
  reflection?: string
  worksheetQuestions?: string[]
  createdAt?: string
  modality?: string
  practice_package?: any
}

export function ClientView({ client }: { client: Client }) {
  const CLIENT_ID = client.id;
  const [material, setMaterial] = useState<AssignedMaterial | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    setIsLoading(true)

    const fetchVignettes = async () => {
      try {
        const response = await apiFetch(`${API_BASE}/client/history?clientId=${CLIENT_ID}`)
        if (!response.ok) throw new Error("Failed to fetch")

        const data: AssignedMaterial[] = await response.json()
        
        // Find the newest material that is a worksheet
        const newest = data.find(m => m.practice_package?.task_type === 'two_choice_worksheet' || m.practice_package?.task_type === 'activity_log' || m.practice_package?.task_type === 'thought_record')
        setMaterial(newest || null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"))
      } finally {
        setIsLoading(false)
      }
    }

    fetchVignettes()
  }, [CLIENT_ID])

  if (isLoading) {
    return (
      <main className="flex-1 flex items-center justify-center bg-background p-8 min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </main>
    )
  }

  if (error) {
    return (
      <main className="flex-1 overflow-auto bg-background p-8">
        <h2 className="text-xl mb-4">{client.name} — Materials</h2>
        <p className="text-rose-500">Error loading data</p>
      </main>
    )
  }

  if (!material || !material.practice_package) {
    return (
      <main className="flex-1 flex items-center justify-center bg-background p-8 min-h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-medium mb-2">No active worksheets</h2>
          <p className="text-muted-foreground">You have completed all assigned worksheets.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-auto bg-background p-0 sm:p-8">
      <DynamicTaskForm 
        clientId={CLIENT_ID}
        taskType={material.practice_package.task_type}
        initialData={material.practice_package}
        onSubmitted={() => {
          // Just remove it from view once submitted for now
          setMaterial(null)
        }}
        onCancel={() => {
          setMaterial(null)
        }}
      />
    </main>
  )
}