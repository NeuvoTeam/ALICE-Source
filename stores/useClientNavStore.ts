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

  load: (clientId: string) => void
  createCase: () => void
  createSession: (caseId: string) => void
  deleteCase: (caseId: string) => void
  deleteSession: (caseId: string, sessionId: string) => void
}

export const useClientNavStore = create<ClientNavState>((set) => ({
  client: {
    id: 'demo-client',
    name: 'Demo Client',
    cases: [
      {
        id: 'demo-case',
        name: 'Initial Case',
        sessions: [
          {
            id: 'demo-session',
            name: 'Session 1',
          },
        ],
      },
    ],
  },

  load: () => {},

  createCase: () =>
    set((state) => {
      if (!state.client) return state

      return {
        client: {
          ...state.client,
          cases: [
            ...state.client.cases,
            {
              id: crypto.randomUUID(),
              name: `Case ${state.client.cases.length + 1}`,
              sessions: [],
            },
          ],
        },
      }
    }),

  createSession: (caseId) =>
    set((state) => {
      if (!state.client) return state

      return {
        client: {
          ...state.client,
          cases: state.client.cases.map((c) =>
            c.id === caseId
              ? {
                  ...c,
                  sessions: [
                    ...c.sessions,
                    {
                      id: crypto.randomUUID(),
                      name: `Session ${c.sessions.length + 1}`,
                    },
                  ],
                }
              : c
          ),
        },
      }
    }),

  deleteCase: (caseId) =>
    set((state) => {
      if (!state.client) return state

      return {
        client: {
          ...state.client,
          cases: state.client.cases.filter((c) => c.id !== caseId),
        },
      }
    }),

  deleteSession: (caseId, sessionId) =>
    set((state) => {
      if (!state.client) return state

      return {
        client: {
          ...state.client,
          cases: state.client.cases.map((c) =>
            c.id === caseId
              ? {
                  ...c,
                  sessions: c.sessions.filter((s) => s.id !== sessionId),
                }
              : c
          ),
        },
      }
    }),
}))