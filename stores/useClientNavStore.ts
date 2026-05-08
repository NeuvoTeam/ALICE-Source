'use client'

import { create } from 'zustand'

/* =====================
   Types
   ===================== */

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
}

/* =====================
   Store
   ===================== */

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

  /* ✅ FIXED: Proper immutable update */
  createCase: () =>
    set((state) => {
      if (!state.client) return state

      const nextIndex = state.client.cases.length + 1

      return {
        client: {
          ...state.client,
          cases: [
            ...state.client.cases,
            {
              id: crypto.randomUUID(),
              name: `Case ${nextIndex}`,
              sessions: [],
            },
          ],
        },
      }
    }),

  /* ✅ FIXED: Correct nested update */
  createSession: (caseId) =>
    set((state) => {
      if (!state.client) return state

      return {
        client: {
          ...state.client,
          cases: state.client.cases.map((c) => {
            if (c.id !== caseId) return c

            const nextIndex = c.sessions.length + 1

            return {
              ...c,
              sessions: [
                ...c.sessions,
                {
                  id: crypto.randomUUID(),
                  name: `Session ${nextIndex}`,
                },
              ],
            }
          }),
        },
      }
    }),
}))
