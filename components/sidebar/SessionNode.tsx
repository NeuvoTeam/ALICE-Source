'use client'

import { Trash } from 'lucide-react'
import { useClientNavStore } from '@/stores/useClientNavStore'
import EditableName from './EditableName'
import { cn } from '@/lib/utils'

type Session = {
  id: string
  name: string
}

export function SessionNode({
  session,
  caseId,
}: {
  session: Session
  caseId: string
}) {
  const { deleteSession, renameSession, selectSession, selectedSessionId } =
    useClientNavStore()
  const isSelected = selectedSessionId === session.id

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => void selectSession(caseId, session.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          void selectSession(caseId, session.id)
        }
      }}
      className={cn(
        'group flex cursor-pointer items-center justify-between rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground',
        isSelected && 'bg-sidebar-accent text-foreground font-medium'
      )}
    >
      <div className="min-w-0 flex-1">
        <EditableName
          value={session.name}
          onSave={(newName) =>
            renameSession(caseId, session.id, newName)
          }
        />
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          if (confirm('Delete this session?')) {
            deleteSession(caseId, session.id)
          }
        }}
        className="opacity-0 group-hover:opacity-100 transition hover:text-red-500"
      >
        <Trash className="h-3 w-3" />
      </button>
    </div>
  )
}
