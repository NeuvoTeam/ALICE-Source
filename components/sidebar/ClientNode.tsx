'use client'

import * as React from 'react'
import { Plus } from 'lucide-react'
import { CaseNode } from './CaseNode'
import { useClientNavStore } from '@/stores/useClientNavStore'

/**
 * IMPORTANT:
 * This MUST be a named export:
 *   export function ClientNode() { ... }
 * NOT a default export
 */
export function ClientNode() {
  const { client } = useClientNavStore()

  // Safety: store might be empty initially
  if (!client) {
    return (
      <div className="px-3 py-2 text-sm text-muted-foreground">
        No client selected
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* Client label */}
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-sm font-medium text-sidebar-foreground">
          {client.name}
        </span>

        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          onClick={() => {
            // placeholder for create case
            console.log('Create case')
          }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Cases */}
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
``