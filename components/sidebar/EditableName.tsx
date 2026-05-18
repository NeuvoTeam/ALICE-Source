'use client'

import { useState } from 'react'
import { Pencil, Check, X } from 'lucide-react'

type Props = {
  value: string
  onSave: (value: string) => Promise<void>
}

export default function EditableName({ value, onSave }: Props) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(value)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    const trimmed = name.trim()

    if (!trimmed || trimmed === value) {
      setIsEditing(false)
      return
    }

    setLoading(true)
    await onSave(trimmed)
    setLoading(false)
    setIsEditing(false)
  }

  return (
    <div className="flex items-center gap-1 min-w-0">
      
      {/* ===================== VIEW MODE ===================== */}
      {!isEditing && (
        <>
          <span className="truncate">{value}</span>

          {/* ✅ Larger click target + subtle hover */}
          <div
            className="p-1 rounded hover:bg-sidebar-accent/50 cursor-pointer opacity-0 group-hover:opacity-100 transition"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3 w-3 opacity-70 hover:opacity-100" />
          </div>
        </>
      )}

      {/* ===================== EDIT MODE ===================== */}
      {isEditing && (
        <>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="bg-transparent border-b border-border outline-none text-sm w-full"

            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSave()
                }
              
                if (e.key === 'Escape') {
                  setName(value)
                  setIsEditing(false)
                }
              }}
            />

          {/* ✅ Save */}
          <div
            className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/20 cursor-pointer"
            onClick={handleSave}
          >
            <Check className="h-3 w-3 text-green-600" />
          </div>

          {/* ✅ Cancel */}
          <div
            className="p-1 rounded hover:bg-muted cursor-pointer"
            onClick={() => {
              setName(value)
              setIsEditing(false)
            }}
          >
            <X className="h-3 w-3 opacity-70 hover:opacity-100" />
          </div>
        </>
      )}
    </div>
  )
}
