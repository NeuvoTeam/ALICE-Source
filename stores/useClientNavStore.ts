'use client'

import { create } from 'zustand'

/* =========================
   TYPES
========================= */
export type Session = { id: string; name: string }

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
  error: string | null

  loadClients: () => Promise<void>
  selectClient: (clientId: string) => Promise<void>
  createClient: (name?: string) => Promise<void>
  clearClient: () => void

  load: () => Promise<void>

  createCase: () => Promise<void>
  createSession: (caseId: string) => Promise<void>

  deleteCase: (caseId: string) => Promise<void>
  deleteSession: (caseId: string, sessionId: string) => Promise<void>

  renameClient: (name: string) => Promise<void>
  renameCase: (caseId: string, name: string) => Promise<void>
  renameSession: (caseId: string, sessionId: string, name: string) => Promise<void>

  loadLatestSession: () => Promise<void>

  analyzeSession: (notes: string) => Promise<any>
  generateVignette: (notes: string, modality?: string) => Promise<any>
}

/* =========================
   SAFE FETCH
========================= */
const API = 'https://clinical-ai-backend.neuvoteam.workers.dev'

async function safeFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options)
  const data = await res.json().catch(() => null)

  if (!res.ok) throw new Error(data?.error || 'Request failed')

  return data
}

/* =========================
   NORMALIZER (STABLE)
========================= */
function normalizeClientTree(client: any): Client {
  return {
    id: client.id,
    name: client.name || 'Unnamed Client',
    cases: (client.cases || []).map((c: any) => ({
      id: c.id,
      name: c.name || 'Unnamed Case', // ✅ FIXED
      sessions: (c.sessions || []).map((s: any) => ({
        id: s.id,
        name: s.name || 'Unnamed Session', // ✅ FIXED
      })),
    })),
  }
}

/* =========================
   STORE
========================= */
export const useClientNavStore = create<ClientNavState>((set, get) => ({

  client: null,
  clients: [],
  selectedClientId: null,

  loading: false,
  error: null,

  /* ========================= */
  loadClients: async () => {
    try {
      set({ error: null })

      const data = await safeFetch(`${API}/clients`)

      set({
        clients: data.map((c: any) => ({
          id: c.id,
          name: c.name || 'Unnamed Client',
          cases: [],
        })),
      })

    } catch (err: any) {
      set({ error: err.message })
    }
  },

  /* ========================= */
  selectClient: async (clientId: string) => {
    try {
      console.log("✅ selectClient called with:", clientId); 

      set({ error: null })

      const data = await safeFetch(`${API}/client/${clientId}`)

      console.log("✅ API client data:", data);

      set({
        selectedClientId: clientId,
        client: normalizeClientTree(data),
      })

    } catch (err: any) {
      set({ error: err.message })
    }
  },

  /* ========================= */
  createClient: async (name?: string) => {
    try {
      const data = await safeFetch(`${API}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      set({
        clients: [...get().clients, {
          id: data.id,
          name: data.name || 'Unnamed Client',
          cases: [],
        }],
      })

      await get().selectClient(data.id)

    } catch (err: any) {
      set({ error: err.message })
    }
  },

  /* ========================= */
  load: async () => {
    set({ loading: true, error: null })

    try {
      const clients = await safeFetch(`${API}/clients`)

      if (!clients.length) {
        set({ clients: [], loading: false })
        return
      }

      set({
        clients,
        loading: false,
      })

    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  /* ========================= */
  createCase: async () => {
    const client = get().client
    if (!client) return

    try {
      await safeFetch(`${API}/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: client.id }),
      })

      await get().selectClient(client.id) // ✅ consistency

    } catch (err: any) {
      set({ error: err.message })
    }
  },

  createSession: async (caseId: string) => {
    const client = get().client
    if (!client) return

    try {
      await safeFetch(`${API}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      })

      await get().selectClient(client.id)

    } catch (err: any) {
      set({ error: err.message })
    }
  },

  deleteCase: async (caseId: string) => {
    const client = get().client
    if (!client) return

    try {
      await safeFetch(`${API}/cases/${caseId}`, { method: 'DELETE' })
      await get().selectClient(client.id)

    } catch (err: any) {
      set({ error: err.message })
    }
  },

  deleteSession: async (caseId: string, sessionId: string) => {
    const client = get().client
    if (!client) return

    try {
      await safeFetch(`${API}/sessions/${sessionId}`, { method: 'DELETE' })
      await get().selectClient(client.id)

    } catch (err: any) {
      set({ error: err.message })
    }
  },

  renameClient: async (name: string) => {
    const client = get().client
    if (!client) return
  
    // ✅ 1. Optimistic UI update
    set({
      client: { ...client, name },
      clients: get().clients.map((c) =>
        c.id === client.id ? { ...c, name } : c
      ),
    })
  
    try {
      // ✅ 2. Persist to backend
      await safeFetch(`${API}/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
  
    } catch (err: any) {
      // ❌ Optional: rollback if needed
      set({ error: err.message })
    }
  },
  

  renameCase: async (caseId: string, name: string) => {
    const client = get().client
    if (!client) return
  
    set({
      client: {
        ...client,
        cases: client.cases.map((c) =>
          c.id === caseId ? { ...c, name } : c
        ),
      },
    })
  
    try {
      await safeFetch(`${API}/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  renameSession: async (
    caseId: string,
    sessionId: string,
    name: string
  ) => {
    const client = get().client
    if (!client) return
  
    set({
      client: {
        ...client,
        cases: client.cases.map((c) =>
          c.id === caseId
            ? {
                ...c,
                sessions: c.sessions.map((s) =>
                  s.id === sessionId ? { ...s, name } : s
                ),
              }
            : c
        ),
      },
    })
  
    try {
      await safeFetch(`${API}/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  loadLatestSession: async () => {
    try {
      return await safeFetch(`${API}/latest-session`)
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  analyzeSession: (notes) =>
    safeFetch(`${API}/analyze/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionNotes: notes }),
    }),

  generateVignette: (notes, modality) =>
    safeFetch(`${API}/generate/vignette`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionNotes: notes, modality }),
    }),

    clearClient: () => {
      set({
        client: null,
        selectedClientId: null,
      })},
    
}))