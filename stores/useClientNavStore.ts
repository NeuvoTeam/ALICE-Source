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

/**
 * ✅ IMPORTANT
 * This MUST be a NAMED EXPORT
 * because we import it like:
 *
 *   import { useClientNavStore } from '@/stores/useClientNavStore'
 */
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
    set((state) =>
      state.client
        ? {
            client: {
              ...state.client,
              cases: [
                ...state.client.cases,
                {
                  id: crypto.randomUUID(),
                  name: 'New Case',
                  sessions: [],
                },
              ],
            },
          }
        : state
    ),

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
                      name: 'New Session',
                    },
                  ],
                }
              : c
          ),
        },
      }
    }),
}))
