"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { CLINICAL_AI_API_BASE as API_BASE } from "@/lib/clinical-ai-api"
import { apiFetch } from "@/lib/auth"
import { Client } from "@/types";
import type { PracticePackage } from "@/lib/practice-package";
import type { StructuredTask } from "@/lib/ai/schemas";
import { DynamicTaskForm } from "@/components/tasks/DynamicTaskForm"

/**
 * `GET /client/history` returns `practice_package` in whichever shape the Worker
 * stored: a structured task (has `task_type`) or a PracticePackage from
 * `/generate/practice-package`.
 */
function isStructuredTask(
  pkg: StructuredTask | PracticePackage | null | undefined
): pkg is StructuredTask {
  return !!pkg && typeof pkg === "object" && "task_type" in pkg;
}

/** The three variants `DynamicTaskForm` renders — `reflection_prompt` uses the canvas instead. */
const FORM_TASK_TYPES = ["two_choice_worksheet", "activity_log", "thought_record"] as const;

/**
 * A structured task this component can render. The body proves the narrowing
 * (`isStructuredTask` plus the same three `task_type` literals the old filter used,
 * in the same order), so the claim is exactly what was checked.
 */
function isRenderableTask(
  pkg: StructuredTask | PracticePackage | null | undefined
): pkg is Extract<StructuredTask, { task_type: (typeof FORM_TASK_TYPES)[number] }> {
  return isStructuredTask(pkg) && FORM_TASK_TYPES.some((t) => t === pkg.task_type);
}

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
  practice_package?: StructuredTask | PracticePackage | null
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
        const newest = data.find(m => isRenderableTask(m.practice_package))
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

  if (!material || !isRenderableTask(material.practice_package)) {
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