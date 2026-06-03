'use client'

import * as React from 'react'

export function EditableText({
  value,
  onSave,
}: {
  value: string
  onSave: (value: string) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [text, setText] = React.useState(value)

  React.useEffect(() => {
    setText(value)
  }, [value])

  if (editing) {
    return (
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setEditing(false)
          if (text !== value) onSave(text)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            setText(value)
            setEditing(false)
          }
        }}
        className="w-full bg-transparent border rounded px-1 text-sm"
      />
    )
  }

  return (
    <span
      onDoubleClick={() => setEditing(true)}
      className="truncate cursor-text"
    >
      {value}
    </span>
  )
}
``