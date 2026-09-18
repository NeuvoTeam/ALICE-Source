"use client"

import { useState, useEffect } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { ClinicalClient, ClinicalHierarchy } from "@/lib/clinical-hierarchy"

export interface ClinicalFolderTreeProps {
  hierarchy?: ClinicalHierarchy | { clients?: ClinicalClient[] } | null
  selectedClientId?: string | null
  selectedCaseId?: string | null
}

export function ClinicalFolderTree({
  hierarchy,
  selectedClientId,
  selectedCaseId,
}: ClinicalFolderTreeProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({})

  // This ensures the component logic only runs on the client
  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null // Return nothing until the component is "hydrated"

  const toggleFolder = (id: string) => {
    setOpenStates((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-1 w-full text-zinc-700">
      {hierarchy?.clients?.map((client: ClinicalClient) => (
        <div key={client.id} className="w-full">
          <Collapsible
            open={!!openStates[client.id]} // Force boolean
            onOpenChange={() => toggleFolder(client.id)}
          >
            {/* ... rest of your code ... */}
          </Collapsible>
        </div>
      ))}
    </div>
  )
}
