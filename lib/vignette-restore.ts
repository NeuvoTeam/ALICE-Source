import type { ClinicalSession } from "@/lib/clinical-hierarchy"

export type VignetteRestoredAnalysis = {
  formulationId?: string
  inferredModality?: string
  riskFlags: unknown[]
  rationale: string
}

export type VignetteRestoredState = {
  step: 1 | 2 | 3
  sessionNotes: string
  modality: string
  analysis: VignetteRestoredAnalysis | null
  content: {
    scenario: string
    quiz: string[]
    homework: string[]
  }
}

function toAnalysis(record: {
  inferredModality?: string
  rationale: string
  riskFlags: unknown[]
}): VignetteRestoredAnalysis {
  return {
    inferredModality: record.inferredModality,
    rationale: record.rationale,
    riskFlags: record.riskFlags ?? [],
  }
}

/** Latest worksheet wins (full vignette UI); else latest analysis (step 2); else notes-only step 1. */
export function buildVignetteRestoreFromSession(
  session: ClinicalSession | undefined,
  currentNotes: string,
): VignetteRestoredState | null {
  if (!session) return null

  const lastW = session.worksheets[session.worksheets.length - 1]
  const lastA = session.analyses[session.analyses.length - 1]
  const notes = currentNotes

  if (lastW) {
    return {
      step: 3,
      sessionNotes: notes,
      modality: (lastW.modality || lastA?.inferredModality || "cbt").toLowerCase(),
      analysis: lastA ? toAnalysis(lastA) : null,
      content: {
        scenario: lastW.scenario,
        quiz: lastW.quiz,
        homework: lastW.homework,
      },
    }
  }

  if (lastA) {
    return {
      step: 2,
      sessionNotes: notes,
      modality: (lastA.inferredModality || "cbt").toLowerCase(),
      analysis: toAnalysis(lastA),
      content: { scenario: "", quiz: [], homework: [] },
    }
  }

  return {
    step: 1,
    sessionNotes: notes,
    modality: "cbt",
    analysis: null,
    content: { scenario: "", quiz: [], homework: [] },
  }
}
