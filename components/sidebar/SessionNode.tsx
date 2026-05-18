'use client'

import { Trash } from 'lucide-react'
import { useClientNavStore } from '@/stores/useClientNavStore'
import { useRouter } from 'next/navigation'
import EditableName from './EditableName'

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
  const { deleteSession, renameSession } = useClientNavStore()
  const router = useRouter()

  return (
    <div
      onClick={() =>
        router.push(`/cases/${caseId}/sessions/${session.id}`)
      }
      className="group flex cursor-pointer items-center justify-between rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
    >
      
      {/* ✅ prevent navigation when editing */}
      <div
        className="flex-1"
        onClick={(e) => e.stopPropagation()}
      >
        <EditableName
          value={session.name}
          onSave={(newName) =>
            renameSession(caseId, session.id, newName)
          }
        />
      </div>

      <button
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