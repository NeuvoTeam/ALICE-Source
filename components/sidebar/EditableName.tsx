'use client'

import { useState, useEffect } from 'react'
import { Check, X, Pencil } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

type Props = {
  value: string
  onSave: (value: string) => Promise<void>
  isEditing?: boolean
  onEditChange?: (editing: boolean) => void
  /**
   * Whether the inline rename pencil stays tappable on coarse pointers.
   * The session row turns this off: on a 390 px drawer the pencil's 44 px box
   * sat across the row's geometric centre and squeezed the session name to
   * 31 px. Sessions keep rename reachable via the kebab's "Rename session".
   * Case rows have no menu, so they keep the pencil.
   */
  showPencilOnCoarse?: boolean
}

export default function EditableName({
  value,
  onSave,
  isEditing: externalIsEditing,
  onEditChange,
  showPencilOnCoarse = true,
}: Props) {
  const { toast } = useToast()
  const [internalIsEditing, setInternalIsEditing] = useState(false)
  const isEditing = externalIsEditing !== undefined ? externalIsEditing : internalIsEditing

  const setEditing = (next: boolean) => {
    if (externalIsEditing === undefined) {
      setInternalIsEditing(next)
    }
    onEditChange?.(next)
  }

  const [name, setName] = useState(value)

  // Keep name synced if value changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(value)
  }, [value])

  const handleSave = async () => {
    const trimmed = name.trim()

    if (!trimmed || trimmed === value) {
      setName(value)
      setEditing(false)
      return
    }

    try {
      await onSave(trimmed)
      setEditing(false)
    } catch (err) {
      setName(value)
      setEditing(false)
      toast({
        title: "Rename failed",
        description: err instanceof Error ? err.message : "Rename failed",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="flex items-center gap-1 min-w-0 w-full">
      
      {/* ===================== VIEW MODE ===================== */}
      {!isEditing && (
        <>
          <span
            className="truncate select-none cursor-pointer"
            onDoubleClick={(e) => {
              e.stopPropagation()
              setEditing(true)
            }}
          >
            {value}
          </span>
          <button
            type="button"
            aria-label={`Rename ${value}`}
            onClick={(e) => {
              e.stopPropagation()
              setEditing(true)
            }}
            className={cn(
              "rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto shrink-0",
              showPencilOnCoarse
                ? "pointer-coarse:opacity-100 pointer-coarse:pointer-events-auto pointer-coarse:size-11 pointer-coarse:inline-flex pointer-coarse:items-center pointer-coarse:justify-center"
                : "pointer-coarse:hidden"
            )}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </>
      )}

      {/* ===================== EDIT MODE ===================== */}
      {isEditing && (
        <div
          className="flex items-center gap-1 min-w-0 w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="bg-background/80 border-b border-primary outline-none text-xs w-full px-1 py-0.5 rounded-xs pointer-coarse:min-h-11"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleSave()
              }
              if (e.key === 'Escape') {
                setName(value)
                setEditing(false)
              }
            }}
          />

          {/* Save */}
          <button
            type="button"
            className="rounded p-0.5 hover:bg-emerald-500/15 text-emerald-600 transition-colors pointer-coarse:size-11 pointer-coarse:inline-flex pointer-coarse:items-center pointer-coarse:justify-center shrink-0"
            onClick={() => void handleSave()}
          >
            <Check className="h-3.5 w-3.5" />
          </button>

          {/* Cancel */}
          <button
            type="button"
            className="rounded p-0.5 hover:bg-muted text-muted-foreground transition-colors pointer-coarse:size-11 pointer-coarse:inline-flex pointer-coarse:items-center pointer-coarse:justify-center shrink-0"
            onClick={() => {
              setName(value)
              setEditing(false)
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
