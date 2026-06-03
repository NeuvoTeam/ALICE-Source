const STORAGE_KEY = 'alice:last-session-by-client'

type ClientTree = {
  cases: { id: string; sessions: { id: string }[] }[]
}

export type LastSessionRef = {
  caseId: string
  sessionId: string
  accessedAt: number
}

function readAll(): Record<string, LastSessionRef> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAll(map: Record<string, LastSessionRef>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function getLastSession(clientId: string): LastSessionRef | null {
  return readAll()[clientId] ?? null
}

export function setLastSession(
  clientId: string,
  caseId: string,
  sessionId: string
) {
  const map = readAll()
  map[clientId] = { caseId, sessionId, accessedAt: Date.now() }
  writeAll(map)
}

export function sessionExistsInTree(
  client: ClientTree,
  caseId: string,
  sessionId: string
): boolean {
  const caseData = client.cases.find((c) => c.id === caseId)
  return Boolean(caseData?.sessions.some((s) => s.id === sessionId))
}

/** Last accessed session, or the most recently listed session in the tree. */
export function resolveDefaultSession(
  client: ClientTree,
  clientId: string
): { caseId: string; sessionId: string } | null {
  const last = getLastSession(clientId)
  if (last && sessionExistsInTree(client, last.caseId, last.sessionId)) {
    return { caseId: last.caseId, sessionId: last.sessionId }
  }

  for (let i = client.cases.length - 1; i >= 0; i--) {
    const caseData = client.cases[i]
    const newest = caseData.sessions[caseData.sessions.length - 1]
    if (newest) {
      return { caseId: caseData.id, sessionId: newest.id }
    }
  }

  return null
}
