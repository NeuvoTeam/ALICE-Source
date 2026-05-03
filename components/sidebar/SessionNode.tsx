'use client'

type Session = {
  id: string
  name: string
}

/**
 * IMPORTANT:
 * This must be a NAMED EXPORT:
 *   export function SessionNode() { ... }
 */
export function SessionNode({ session }: { session: Session }) {
  return (
    <div
      className="flex w-full cursor-pointer items-center rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
    >
      <span className="truncate">{session.name}</span>
    </div>
  )
}