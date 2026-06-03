'use client'

import * as React from 'react'
import { Plus } from 'lucide-react'
import { CaseNode } from './CaseNode'
import { useClientNavStore } from '@/stores/useClientNavStore'
import EditableName from './EditableName'

export function ClientNode() {
  const { client, loading, createCase, load, renameClient } = useClientNavStore()

  if (!client) {
    console.log("STORE CLIENT:", client);
    return (
      <div className="px-3 py-2 text-sm text-muted-foreground">
        No client selected
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* Client header */}
      <div className="flex items-center justify-between px-3 py-1">
        
        <EditableName
          value={client.name}
          onSave={renameClient}
        />

        <button
          type="button"
          onClick={createCase}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Cases list */}
      <div className="ml-2 space-y-1">
        {client.cases.length === 0 && (
          <div className="px-3 py-1 text-xs text-muted-foreground">
            No cases yet
          </div>
        )}

        {client.cases.map((c) => (
          <CaseNode key={c.id} caseData={c} />
        ))}
      </div>
    </div>
  )
}