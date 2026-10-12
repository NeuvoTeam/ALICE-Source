"use client"

import { useState, useEffect } from "react"
import { Loader2, PanelLeft, PanelLeftClose } from "lucide-react"
import { useSidebar } from "@/components/dashboard-shell"
import { CLINICAL_AI_API_BASE as API_BASE } from "@/lib/clinical-ai-api"
import { apiFetch } from "@/lib/auth"
import { Client } from "@/types";
import { isStructuredTask, type PracticePackage } from "@/lib/practice-package";
import type { StructuredTask } from "@/lib/ai/schemas";
import { DynamicTaskForm } from "@/components/tasks/DynamicTaskForm"

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
  const { isOpen, toggleSidebar } = useSidebar()

  useEffect(() => {
    // No pre-set: `isLoading` initialises to `true` and this effect is the loader's only
    // caller, so the call only ever re-set the value the state already held (lint rank 8g,
    // register row B8).
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
      <main className="flex-1 flex flex-col bg-background p-4 sm:p-8 min-h-[50vh]">
        <div className="flex items-center gap-3 mb-6 pb-3 border-b">
          <button
            type="button"
            onClick={toggleSidebar}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
            title={isOpen ? "Collapse navigation sidebar" : "Expand navigation sidebar"}
            aria-label={isOpen ? "Collapse navigation sidebar" : "Expand navigation sidebar"}
          >
            {isOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
          </button>
          <div>
            <h2 className="text-lg font-bold text-foreground">{client.name} — Assigned Materials</h2>
            <p className="text-xs text-muted-foreground">Interactive practice worksheets and reflections</p>
          </div>
        </div>
        <div className="text-center py-12">
          <h3 className="text-base font-medium mb-1">No active worksheets</h3>
          <p className="text-xs text-muted-foreground">You have completed all assigned worksheets.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 overflow-auto bg-background p-4 sm:p-8">
      <div className="flex items-center gap-3 mb-6 pb-3 border-b">
        <button
          type="button"
          onClick={toggleSidebar}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          title={isOpen ? "Collapse navigation sidebar" : "Expand navigation sidebar"}
          aria-label={isOpen ? "Collapse navigation sidebar" : "Expand navigation sidebar"}
        >
          {isOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </button>
        <div>
          <h2 className="text-lg font-bold text-foreground">{client.name} — Assigned Materials</h2>
          <p className="text-xs text-muted-foreground">Interactive practice worksheets and reflections</p>
        </div>
      </div>
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