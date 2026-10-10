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
    return <div className="p-4 text-sm italic text-muted-foreground">No session history available.</div>
  }

  return (
    <div className="space-y-4">
      {sessions.map((a) => (
        <Card key={a.id} className="rounded-xl border-border">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{a.date}</p>
                <p className="text-sm text-card-foreground">{a.summary}</p>
              </div>
              <button
                type="button"
                aria-expanded={expandedId === a.id}
                aria-label={expandedId === a.id ? "Collapse flagged considerations" : "Expand flagged considerations"}
                onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                className="rounded-full p-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {expandedId === a.id ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>

            {/* TYPE GUARD: Explicitly checking existence and length */}
            {a.riskFlags && a.riskFlags.length > 0 && (
              <div className="mt-4 border-t border-border pt-4 animate-in fade-in slide-in-from-top-1">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-amber-500" aria-hidden="true" />
                  Flagged considerations
                </p>
                <ul className="space-y-1">
                  {a.riskFlags.map((flag, idx) => (
                    <li key={idx} className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
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