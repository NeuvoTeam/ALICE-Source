'use client'

import { create } from 'zustand'

export type Session = {
  id: string
  name: string
}

export type Case = {
  id: string
  name: string
  sessions: Session[]
}

export type Client = {
  id: string
  name: string
  cases: Case[]
}

type ClientNavState = {
  client: Client | null
  loading: boolean

  load: () => Promise<void>
  createCase: () => Promise<void>
  createSession: (caseId: string) => Promise<void>
  deleteCase: (caseId: string) => Promise<void>
  deleteSession: (caseId: string, sessionId: string) => Promise<void>
}

/* ✅ 👉 CHANGE THIS to your worker URL */
const API = 'https://clinical-ai-backend.neuvoteam.workers.dev'

export const useClientNavStore = create<ClientNavState>((set, get) => ({
  client: null,
  loading: true,

  /* =========================
     ✅ LOAD CLIENT TREE
     ========================= */
  load: async () => {
    set({ loading: true })

    try {
      const res = await fetch(`${API}/clients`)
      const data = await res.json()

      if (!res.ok) throw new Error(data?.error || 'Load failed')

      set({ client: data, loading: false })
    } catch (err) {
      console.error('Load error:', err)
      set({ loading: false })
    }
  },

  /* =========================
     ✅ CREATE CASE
     ========================= */
  createCase: async () => {
    const client = get().client
    if (!client) return

    try {
      const res = await fetch(`${API}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)

      // ✅ optimistic update
      set({
        client: {
          ...client,
          cases: [...client.cases, { ...data, sessions: [] }],
        },
      })
    } catch (err) {
      console.error('Create case error:', err)
    }
  },

  /* =========================
     ✅ CREATE SESSION
     ========================= */
  createSession: async (caseId) => {
    const client = get().client
    if (!client) return

    try {
      const res = await fetch(`${API}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)

      set({
        client: {
          ...client,
          cases: client.cases.map((c) =>
            c.id === caseId
              ? {
                  ...c,
                  sessions: [...c.sessions, data],
                }
              : c
          ),
        },
      })
    } catch (err) {
      console.error('Create session error:', err)
    }
  },

  /* =========================
     ✅ DELETE CASE
     ========================= */
  deleteCase: async (caseId) => {
    const client = get().client
    if (!client) return

    try {
      const res = await fetch(`${API}/cases/${caseId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Delete failed')

      set({
        client: {
          ...client,
          cases: client.cases.filter((c) => c.id !== caseId),
        },
      })
    } catch (err) {
      console.error('Delete case error:', err)
    }
  },

  /* =========================
     ✅ DELETE SESSION
     ========================= */
  deleteSession: async (caseId, sessionId) => {
    const client = get().client
    if (!client) return

    try {
      const res = await fetch(`${API}/sessions/${sessionId}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Delete failed')

      set({
        client: {
          ...client,
          cases: client.cases.map((c) =>
            c.id === caseId
              ? {
                  ...c,
                  sessions: c.sessions.filter((s) => s.id !== sessionId),
                }
              : c
          ),
        },
      })
    } catch (err) {
      console.error('Delete session error:', err)
    }
  },
}))