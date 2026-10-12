'use client'

import { useState, useEffect } from 'react'
import { Check, X } from 'lucide-react'

type Props = {
  value: string
  onSave: (value: string) => Promise<void>
  isEditing?: boolean
  onEditChange?: (editing: boolean) => void
}

export default function EditableName({ value, onSave, isEditing: externalIsEditing, onEditChange }: Props) {
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
    setName(value)
  }, [value])

  const handleSave = async () => {
    const trimmed = name.trim()

    if (!trimmed || trimmed === value) {
      setEditing(false)
      return
    }

    await onSave(trimmed)
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-1 min-w-0 w-full">
      
      {/* ===================== VIEW MODE ===================== */}
      {!isEditing && (
        <span
          className="truncate select-none cursor-pointer"
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditing(true)
          }}
        >
          {value}
        </span>
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
            className="bg-background/80 border-b border-primary outline-none text-xs w-full px-1 py-0.5 rounded-xs"
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
            className="rounded p-0.5 hover:bg-emerald-500/15 text-emerald-600 transition-colors"
            onClick={() => void handleSave()}
          >
            <Check className="h-3.5 w-3.5" />
          </button>

          {/* Cancel */}
          <button
            type="button"
            className="rounded p-0.5 hover:bg-muted text-muted-foreground transition-colors"
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
