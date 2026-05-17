'use client'

import { create } from 'zustand'

/* =========================
   ✅ TYPES
   ========================= */
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
  clients: Client[]
  selectedClientId: string | null
  loading: boolean

  loadClients: () => Promise<void>
  selectClient: (clientId: string) => Promise<void>
  createClient: (name: string) => Promise<void>

  load: () => Promise<void>
  createCase: () => Promise<void>
  createSession: (caseId: string) => Promise<void>
  deleteCase: (caseId: string) => Promise<void>
  deleteSession: (caseId: string, sessionId: string) => Promise<void>

  renameClient: (name: string) => Promise<void>
  renameCase: (caseId: string, name: string) => Promise<void>
}

const API = 'https://clinical-ai-backend.neuvoteam.workers.dev'

/* =========================
   ✅ STORE
   ========================= */
export const useClientNavStore = create<ClientNavState>((set, get) => ({

  client: null,
  clients: [],
  selectedClientId: null,
  loading: false,

  /* =========================
     ✅ LOAD CLIENT LIST
     ========================= */
  loadClients: async () => {
    try {
      const res = await fetch(`${API}/clients`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)

      // ✅ Normalize (important fix)
      
      if (!Array.isArray(data)) {
        console.error('Unexpected clients response:', data)
        return
      }

      set({
        clients: data.map((c: any) => ({
          id: c.id,
          name: c.name || "Unnamed Client",
          cases: [],
        })),
      })

    } catch (err) {
      console.error('Load clients error:', err)
    }
  },

  /* =========================
     ✅ SELECT CLIENT
     ========================= */
  selectClient: async (clientId: string) => {
    try {
      const res = await fetch(`${API}/client/${clientId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)

      set({
        selectedClientId: clientId,
        client: data,
      })

    } catch (err) {
      console.error('Select client error:', err)
    }
  },

  /* =========================
     ✅ CREATE CLIENT
     ========================= */
  createClient: async (name: string) => {
    try {
      const res = await fetch(`${API}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)

      const newClient: Client = {
        id: data.id,
        name: data.name,
        cases: [],
      }

      set({
        clients: [...get().clients, newClient],
        selectedClientId: newClient.id,
        client: newClient,
      })

    } catch (err) {
      console.error('Create client error:', err)
    }
  },

  /* =========================
     ✅ INITIAL LOAD
     ========================= */
  load: async () => {
    set({ loading: true })

    try {
      const res = await fetch(`${API}/clients`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error)

      
        if (!Array.isArray(data)) {
          console.error('Unexpected clients response:', data)
          set({ loading: false })
          return
        }

        const clients = data.map((c: any) => ({
        id: c.id,
        name: c.name || "Unnamed Client",
        cases: [],
      }))

      if (clients.length === 0) {
        set({ clients, loading: false })
        return
      }

      const firstId = clients[0].id

      const clientRes = await fetch(`${API}/client/${firstId}`)
      const clientData = await clientRes.json()

      set({
        clients,
        selectedClientId: firstId,
        client: clientData,
        loading: false,
      })

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
  createSession: async (caseId: string) => {
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
              ? { ...c, sessions: [...c.sessions, data] }
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
  deleteCase: async (caseId: string) => {
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
  deleteSession: async (caseId: string, sessionId: string) => {
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

  /* =========================
     ✅ RENAME CLIENT
     ========================= */
  renameClient: async (name: string) => {
    const client = get().client
    if (!client) return

    try {
      await fetch(`${API}/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      set({
        client: { ...client, name },
        clients: get().clients.map((c) =>
          c.id === client.id ? { ...c, name } : c
        ),
      })

    } catch (err) {
      console.error('Rename client error:', err)
    }
  },

  /* =========================
     ✅ RENAME CASE
     ========================= */
  renameCase: async (caseId: string, name: string) => {
    const client = get().client
    if (!client) return

    try {
      await fetch(`${API}/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      set({
        client: {
          ...client,
          cases: client.cases.map((c) =>
            c.id === caseId ? { ...c, name } : c
          ),
        },
      })

    } catch (err) {
      console.error('Rename case error:', err)
    }
  },

}))