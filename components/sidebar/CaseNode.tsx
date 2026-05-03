'use client'

import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { SessionNode } from './SessionNode'

type Session = {
  id: string
  name: string
}

type Case = {
  id: string
  name: string
  sessions: Session[]
}

/**
 * IMPORTANT:
 * This must be a NAMED EXPORT:
 *   export function CaseNode() { ... }
 */
export function CaseNode({ caseData }: { caseData: Case }) {
  const [open, setOpen] = React.useState(true)

  return (
    <div className="space-y-1">
      {/* Case row */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50"
      >
        <ChevronRight
          className={`h-4 w-4 transition-transform ${
            open ? 'rotate-90' : ''
          }`}
        />
        <span className="truncate">{caseData.name}</span>
      </button>

      {/* Sessions */}
      {open && (
        <div className="ml-6 space-y-1">
          {caseData.sessions.length === 0 && (
            <div className="px-3 py-1 text-xs text-muted-foreground">
              No sessions
            </div>
          )}

          {caseData.sessions.map((s) => (
            <SessionNode key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  )
}
``