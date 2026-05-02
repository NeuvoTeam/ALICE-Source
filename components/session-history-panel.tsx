"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"

interface Session {
  id: string
  date: string
  summary: string
  riskFlags?: string[]
}

interface SessionHistoryPanelProps {
  sessions: Session[]
}

export function SessionHistoryPanel({ sessions }: SessionHistoryPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (!sessions || sessions.length === 0) {
    return <div className="text-sm text-zinc-500 italic p-4">No session history available.</div>
  }

  return (
    <div className="space-y-4">
      {sessions.map((a) => (
        <Card key={a.id} className="rounded-2xl border-zinc-200">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{a.date}</p>
                <p className="text-sm text-zinc-700">{a.summary}</p>
              </div>
              <button 
                onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                className="p-1 hover:bg-zinc-100 rounded-full"
              >
                {expandedId === a.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>

            {/* TYPE GUARD: Explicitly checking existence and length */}
            {a.riskFlags && a.riskFlags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-zinc-100 animate-in fade-in slide-in-from-top-1">
                <p className="mb-2 text-[10px] font-bold tracking-wider text-zinc-400 uppercase flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                  Flagged considerations
                </p>
                <ul className="space-y-1">
                  {a.riskFlags.map((flag, idx) => (
                    <li key={idx} className="text-xs bg-amber-50 text-amber-800 px-2 py-1 rounded">
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}