'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useClientNavStore } from '@/stores/useClientNavStore'

/** Handles bookmarked /cases/.../sessions/... URLs by selecting the session and returning home. */
export default function SessionRoutePage() {
  const params = useParams<{ caseId: string; sessionId: string }>()
  const router = useRouter()
  const selectSession = useClientNavStore((s) => s.selectSession)

  useEffect(() => {
    if (params?.caseId && params?.sessionId) {
      selectSession(params.caseId, params.sessionId)
    }
    router.replace('/')
  }, [params?.caseId, params?.sessionId, selectSession, router])

  return null
}
