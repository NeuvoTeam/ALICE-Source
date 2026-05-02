"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react"
import {
  type ClinicalHierarchy,
  addCase,
  addClient,
  addSession,
  appendSessionAnalysis,
  appendSessionWorksheet,
  findCase,
  findClient,
  findSession,
  loadClinicalHierarchy,
  saveClinicalHierarchy,
  updateSessionNotes,
} from "@/lib/clinical-hierarchy"

export function useClinicalWorkspace() {
  const [hierarchy, setHierarchy] = useState<ClinicalHierarchy>(() => loadClinicalHierarchy())
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  useEffect(() => {
    saveClinicalHierarchy(hierarchy)
  }, [hierarchy])

  useLayoutEffect(() => {
    if (hierarchy.clients.length === 0) return
    if (selectedClientId && findClient(hierarchy, selectedClientId)) return
    const c = hierarchy.clients[0]
    setSelectedClientId(c.id)
    setSelectedCaseId(c.cases[0]?.id ?? null)
    setSelectedSessionId(c.cases[0]?.sessions[0]?.id ?? null)
  }, [hierarchy, selectedClientId])

  const selectClient = useCallback(
    (id: string) => {
      const c = findClient(hierarchy, id)
      if (!c) return
      setSelectedClientId(id)
      const firstCase = c.cases[0]
      setSelectedCaseId(firstCase?.id ?? null)
      setSelectedSessionId(firstCase?.sessions[0]?.id ?? null)
    },
    [hierarchy],
  )

  const selectCase = useCallback(
    (id: string) => {
      if (!selectedClientId) return
      const k = findCase(hierarchy, selectedClientId, id)
      if (!k) return
      setSelectedCaseId(id)
      setSelectedSessionId(k.sessions[0]?.id ?? null)
    },
    [hierarchy, selectedClientId],
  )

  const selectCasePath = useCallback(
    (clientId: string, caseId: string) => {
      const k = findCase(hierarchy, clientId, caseId)
      if (!k) return
      setSelectedClientId(clientId)
      setSelectedCaseId(caseId)
      setSelectedSessionId(k.sessions[0]?.id ?? null)
    },
    [hierarchy],
  )

  const selectSession = useCallback((id: string) => {
    setSelectedSessionId(id)
  }, [])

  const selectSessionPath = useCallback(
    (clientId: string, caseId: string, sessionId: string) => {
      setSelectedClientId(clientId)
      setSelectedCaseId(caseId)
      setSelectedSessionId(sessionId)
    },
    [],
  )

  const onAddClient = useCallback((label: string) => {
    let newClientId = ""
    let newCaseId: string | null = null
    let newSessionId: string | null = null
    setHierarchy((h) => {
      const next = addClient(h, label)
      const added = next.clients[next.clients.length - 1]
      newClientId = added.id
      newCaseId = added.cases[0]?.id ?? null
      newSessionId = added.cases[0]?.sessions[0]?.id ?? null
      return next
    })
    setSelectedClientId(newClientId)
    setSelectedCaseId(newCaseId)
    setSelectedSessionId(newSessionId)
  }, [])

  const onAddCase = useCallback(
    (label: string) => {
      if (!selectedClientId) return
      let newCaseId = ""
      let newSessionId: string | null = null
      setHierarchy((h) => {
        const next = addCase(h, selectedClientId, label)
        const c = findClient(next, selectedClientId)
        const added = c?.cases[c.cases.length - 1]
        if (added) {
          newCaseId = added.id
          newSessionId = added.sessions[0]?.id ?? null
        }
        return next
      })
      if (newCaseId) {
        setSelectedCaseId(newCaseId)
        setSelectedSessionId(newSessionId)
      }
    },
    [selectedClientId],
  )

  const onAddSession = useCallback(
    (label: string) => {
      if (!selectedClientId || !selectedCaseId) return
      let newSessionId = ""
      setHierarchy((h) => {
        const next = addSession(h, selectedClientId, selectedCaseId, label)
        const k = findCase(next, selectedClientId, selectedCaseId)
        const added = k?.sessions[k.sessions.length - 1]
        if (added) newSessionId = added.id
        return next
      })
      if (newSessionId) setSelectedSessionId(newSessionId)
    },
    [selectedClientId, selectedCaseId],
  )

  const onAddSessionForCase = useCallback(
    (clientId: string, caseId: string, label: string) => {
      let newSessionId = ""
      setHierarchy((h) => {
        const next = addSession(h, clientId, caseId, label)
        const k = findCase(next, clientId, caseId)
        const added = k?.sessions[k.sessions.length - 1]
        if (added) newSessionId = added.id
        return next
      })
      setSelectedClientId(clientId)
      setSelectedCaseId(caseId)
      if (newSessionId) setSelectedSessionId(newSessionId)
    },
    [],
  )

  const persistSessionNotes = useCallback(
    (notes: string) => {
      if (!selectedClientId || !selectedCaseId || !selectedSessionId) return
      setHierarchy((h) =>
        updateSessionNotes(h, selectedClientId, selectedCaseId, selectedSessionId, notes),
      )
    },
    [selectedClientId, selectedCaseId, selectedSessionId],
  )

  const persistSessionAnalysis = useCallback(
    (analysis: {
      notesSnapshot: string
      inferredModality?: string
      rationale: string
      riskFlags: unknown[]
    }) => {
      if (!selectedClientId || !selectedCaseId || !selectedSessionId) return
      setHierarchy((h) =>
        appendSessionAnalysis(
          h,
          selectedClientId,
          selectedCaseId,
          selectedSessionId,
          analysis,
        ),
      )
    },
    [selectedClientId, selectedCaseId, selectedSessionId],
  )

  const persistSessionWorksheet = useCallback(
    (worksheet: {
      modality: string
      scenario: string
      quiz: string[]
      homework: string[]
    }) => {
      if (!selectedClientId || !selectedCaseId || !selectedSessionId) return
      setHierarchy((h) =>
        appendSessionWorksheet(
          h,
          selectedClientId,
          selectedCaseId,
          selectedSessionId,
          worksheet,
        ),
      )
    },
    [selectedClientId, selectedCaseId, selectedSessionId],
  )

  const sessionNotes = useMemo(() => {
    if (!selectedClientId || !selectedCaseId || !selectedSessionId) return ""
    return (
      findSession(hierarchy, selectedClientId, selectedCaseId, selectedSessionId)?.notes ?? ""
    )
  }, [hierarchy, selectedClientId, selectedCaseId, selectedSessionId])

  const selectedSession = useMemo(() => {
    if (!selectedClientId || !selectedCaseId || !selectedSessionId) return undefined
    return findSession(hierarchy, selectedClientId, selectedCaseId, selectedSessionId)
  }, [hierarchy, selectedClientId, selectedCaseId, selectedSessionId])

  const sessionContextKey = useMemo(() => {
    if (!selectedClientId || !selectedCaseId || !selectedSessionId) return ""
    return `${selectedClientId}:${selectedCaseId}:${selectedSessionId}`
  }, [selectedClientId, selectedCaseId, selectedSessionId])

  return {
    hierarchy,
    selectedClientId,
    selectedCaseId,
    selectedSessionId,
    selectClient,
    selectCase,
    selectCasePath,
    selectSession,
    selectSessionPath,
    onAddClient,
    onAddCase,
    onAddSession,
    onAddSessionForCase,
    persistSessionNotes,
    persistSessionAnalysis,
    persistSessionWorksheet,
    sessionNotes,
    selectedSession,
    sessionContextKey,
    clientIdForApi: selectedClientId ?? "",
  }
}

export type ClinicalWorkspace = ReturnType<typeof useClinicalWorkspace>
