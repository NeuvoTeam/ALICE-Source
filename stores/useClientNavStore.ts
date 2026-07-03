'use client'

import { create } from 'zustand'
import { CLINICAL_AI_API_BASE as API } from '@/lib/clinical-ai-api'
import {
  resolveDefaultSession,
  setLastSession,
} from '@/lib/last-session-access'

/* =========================
   TYPES
========================= */
export type Session = {
  id: string
  name: string
  sessionNotes?: string
  vignette?: string
  homework?: string[]
  quiz?: string[]
  analysis?: {
    rationale?: string
    inferredModality?: string
    riskFlags?: unknown[]
  } | null
  modality?: string | null
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
  selectedCaseId: string | null
  selectedSessionId: string | null

  loading: boolean
  error: string | null

  loadClients: () => Promise<void>
  selectClient: (
    clientId: string,
    options?: { bootstrap?: boolean }
  ) => Promise<void>
  selectSession: (caseId: string, sessionId: string) => Promise<void>
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

  saveSessionContent: (
    caseId: string,
    sessionId: string,
    payload: Partial<
      Pick<
        Session,
        'sessionNotes' | 'vignette' | 'homework' | 'quiz' | 'analysis' | 'modality'
      >
    >
  ) => Promise<void>

  loadLatestSession: () => Promise<void>

  analyzeSession: (
    notes: string,
    sessionId?: string
  ) => Promise<any>
  generateVignette: (
    notes: string,
    modality?: string,
    sessionId?: string
  ) => Promise<any>
}

/* =========================
   SAFE FETCH
========================= */
async function safeFetch(url: string, options?: RequestInit) {
  console.log("🌐 SAFE FETCH:", url);

  const res = await fetch(url, options);

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    console.error("❌ FAILED URL:", url);
    console.error("❌ RESPONSE:", data);

    throw new Error(data?.error || "Request failed");
  }

  return data;
}

/* =========================
   NORMALIZER (STABLE)
========================= */
function normalizeSession(s: any): Session {
  return {
    id: s.id,
    name: s.name || 'Unnamed Session',
    sessionNotes: s.sessionNotes ?? s.session_notes ?? '',
    vignette: s.vignette ?? '',
    homework: Array.isArray(s.homework) ? s.homework : [],
    quiz: Array.isArray(s.quiz) ? s.quiz : [],
    analysis: s.analysis ?? null,
    modality: s.modality ?? null,
  }
}

function normalizeClientTree(client: any): Client {
  return {
    id: client.id,
    name: client.name || 'Unnamed Client',
    cases: (client.cases || []).map((c: any) => ({
      id: c.id,
      name: c.name || 'Unnamed Case',
      sessions: (c.sessions || []).map(normalizeSession),
    })),
  }
}

async function bootstrapNewClientWorkspace(clientId: string) {
  const caseData = await safeFetch(`${API}/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  })

  const sessionData = await safeFetch(`${API}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId: caseData.id }),
  })

  return { caseId: caseData.id as string, sessionId: sessionData.id as string }
}

function mergeSessionInClient(
  client: Client,
  caseId: string,
  sessionId: string,
  patch: Partial<Session>
): Client {
  return {
    ...client,
    cases: client.cases.map((c) =>
      c.id === caseId
        ? {
            ...c,
            sessions: c.sessions.map((s) =>
              s.id === sessionId ? { ...s, ...patch } : s
            ),
          }
        : c
    ),
  }
}

/* =========================
   STORE
========================= */
export const useClientNavStore = create<ClientNavState>((set, get) => ({

  client: null,
  clients: [],
  selectedClientId: null,
  selectedCaseId: null,
  selectedSessionId: null,

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
  selectClient: async (clientId, options) => {
    try {
      set({ error: null })

      const data = await safeFetch(`${API}/client/${clientId}`)
      const client = normalizeClientTree(data)

      set({
        selectedClientId: clientId,
        client,
        selectedCaseId: null,
        selectedSessionId: null,
      })

      if (options?.bootstrap) {
        const { caseId, sessionId } = await bootstrapNewClientWorkspace(clientId)
        const refreshed = await safeFetch(`${API}/client/${clientId}`)
        set({ client: normalizeClientTree(refreshed) })
        await get().selectSession(caseId, sessionId)
        return
      }

      const target = resolveDefaultSession(client, clientId)
      if (target) {
        await get().selectSession(target.caseId, target.sessionId)
      }
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  selectSession: async (caseId, sessionId) => {
    const clientId = get().selectedClientId
    if (clientId) {
      setLastSession(clientId, caseId, sessionId)
    }

    set({ selectedCaseId: caseId, selectedSessionId: sessionId })

    try {
      const data = await safeFetch(`${API}/sessions/${sessionId}`)
      const client = get().client
      if (client?.id && data?.id) {
        set({
          client: mergeSessionInClient(
            client,
            caseId,
            sessionId,
            normalizeSession(data)
          ),
        })
      }
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

      await get().selectClient(data.id, { bootstrap: true })

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

      const updated = get().client
      const caseData = updated?.cases.find((c) => c.id === caseId)
      const newest = caseData?.sessions[caseData.sessions.length - 1]
      if (newest) {
        await get().selectSession(caseId, newest.id)
      }

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

    const { selectedSessionId } = get()

    try {
      await safeFetch(`${API}/sessions/${sessionId}`, { method: 'DELETE' })
      if (selectedSessionId === sessionId) {
        set({ selectedCaseId: null, selectedSessionId: null })
      }
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

  saveSessionContent: async (caseId, sessionId, payload) => {
    const client = get().client
    if (!client) return

    set({
      client: mergeSessionInClient(client, caseId, sessionId, payload),
    })

    try {
      const body: Record<string, unknown> = {}
      if (payload.sessionNotes !== undefined) body.sessionNotes = payload.sessionNotes
      if (payload.vignette !== undefined) body.vignette = payload.vignette
      if (payload.homework !== undefined) body.homework = payload.homework
      if (payload.quiz !== undefined) body.quiz = payload.quiz
      if (payload.analysis !== undefined) body.analysis = payload.analysis
      if (payload.modality !== undefined) body.modality = payload.modality

      const data = await safeFetch(`${API}/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (data?.id) {
        set({
          client: mergeSessionInClient(
            get().client!,
            caseId,
            sessionId,
            normalizeSession(data)
          ),
        })
      }
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

  analyzeSession: (notes, sessionId) =>
    safeFetch(`${API}/analyze/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionNotes: notes, sessionId }),
    }),

  generateVignette: (notes, modality, sessionId) =>
    safeFetch(`${API}/generate/vignette`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionNotes: notes,
        verifiedModality: modality,
        modality,
        sessionId,
      }),
    }),

    clearClient: () => {
      set({
        client: null,
        selectedClientId: null,
        selectedCaseId: null,
        selectedSessionId: null,
      })},
    
}))