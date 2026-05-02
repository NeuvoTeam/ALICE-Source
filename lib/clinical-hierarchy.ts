export type SessionAnalysisRecord = {
  id: string
  at: string
  notesSnapshot: string
  inferredModality?: string
  rationale: string
  riskFlags: unknown[]
}

export type SessionWorksheetRecord = {
  id: string
  at: string
  modality: string
  scenario: string
  quiz: string[]
  homework: string[]
}

export type ClinicalSession = {
  id: string
  label: string
  notes: string
  analyses: SessionAnalysisRecord[]
  worksheets: SessionWorksheetRecord[]
}

export type ClinicalCase = {
  id: string
  label: string
  sessions: ClinicalSession[]
}

export type ClinicalClient = {
  id: string
  label: string
  cases: ClinicalCase[]
}

export type ClinicalHierarchy = {
  clients: ClinicalClient[]
}

const STORAGE_KEY = "mindcare-clinical-hierarchy-v1"

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function normalizeSession(raw: {
  id: string
  label: string
  notes?: string
  analyses?: SessionAnalysisRecord[]
  worksheets?: SessionWorksheetRecord[]
}): ClinicalSession {
  return {
    id: raw.id,
    label: raw.label,
    notes: typeof raw.notes === "string" ? raw.notes : "",
    analyses: Array.isArray(raw.analyses) ? raw.analyses : [],
    worksheets: Array.isArray(raw.worksheets) ? raw.worksheets : [],
  }
}

function normalizeHierarchy(raw: ClinicalHierarchy): ClinicalHierarchy {
  return {
    clients: raw.clients.map((c) => ({
      ...c,
      cases: c.cases.map((k) => ({
        ...k,
        sessions: k.sessions.map((s) => normalizeSession(s)),
      })),
    })),
  }
}

function emptySession(label: string): ClinicalSession {
  return {
    id: newId(),
    label,
    notes: "",
    analyses: [],
    worksheets: [],
  }
}

function seedHierarchy(): ClinicalHierarchy {
  return {
    clients: [
      {
        id: newId(),
        label: "Sample client",
        cases: [
          {
            id: newId(),
            label: "Intake & assessment",
            sessions: [emptySession("Session 1")],
          },
        ],
      },
    ],
  }
}

export function loadClinicalHierarchy(): ClinicalHierarchy {
  if (typeof window === "undefined") {
    return { clients: [] }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      const initial = seedHierarchy()
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
      return initial
    }
    const parsed = JSON.parse(raw) as ClinicalHierarchy
    if (!parsed?.clients?.length) {
      const initial = seedHierarchy()
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
      return initial
    }
    return normalizeHierarchy(parsed)
  } catch {
    const initial = seedHierarchy()
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
    return initial
  }
}

export function saveClinicalHierarchy(data: ClinicalHierarchy): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // ignore quota / private mode
  }
}

export function findClient(h: ClinicalHierarchy, clientId: string): ClinicalClient | undefined {
  return h.clients.find((c) => c.id === clientId)
}

export function findCase(
  h: ClinicalHierarchy,
  clientId: string,
  caseId: string,
): ClinicalCase | undefined {
  return findClient(h, clientId)?.cases.find((c) => c.id === caseId)
}

export function findSession(
  h: ClinicalHierarchy,
  clientId: string,
  caseId: string,
  sessionId: string,
): ClinicalSession | undefined {
  return findCase(h, clientId, caseId)?.sessions.find((s) => s.id === sessionId)
}

function mapSession(
  h: ClinicalHierarchy,
  clientId: string,
  caseId: string,
  sessionId: string,
  fn: (s: ClinicalSession) => ClinicalSession,
): ClinicalHierarchy {
  return {
    clients: h.clients.map((c) =>
      c.id !== clientId
        ? c
        : {
            ...c,
            cases: c.cases.map((k) =>
              k.id !== caseId
                ? k
                : {
                    ...k,
                    sessions: k.sessions.map((s) => (s.id !== sessionId ? s : fn(s))),
                  },
            ),
          },
    ),
  }
}

export function addClient(h: ClinicalHierarchy, label: string): ClinicalHierarchy {
  return {
    clients: [
      ...h.clients,
      {
        id: newId(),
        label: label.trim() || "New client",
        cases: [
          {
            id: newId(),
            label: "New case",
            sessions: [emptySession("Session 1")],
          },
        ],
      },
    ],
  }
}

export function addCase(h: ClinicalHierarchy, clientId: string, label: string): ClinicalHierarchy {
  return {
    clients: h.clients.map((c) =>
      c.id !== clientId
        ? c
        : {
            ...c,
            cases: [
              ...c.cases,
              {
                id: newId(),
                label: label.trim() || "New case",
                sessions: [emptySession("Session 1")],
              },
            ],
          },
    ),
  }
}

export function addSession(
  h: ClinicalHierarchy,
  clientId: string,
  caseId: string,
  label: string,
): ClinicalHierarchy {
  return {
    clients: h.clients.map((c) =>
      c.id !== clientId
        ? c
        : {
            ...c,
            cases: c.cases.map((k) =>
              k.id !== caseId
                ? k
                : {
                    ...k,
                    sessions: [...k.sessions, emptySession(label.trim() || "New session")],
                  },
            ),
          },
    ),
  }
}

export function updateSessionNotes(
  h: ClinicalHierarchy,
  clientId: string,
  caseId: string,
  sessionId: string,
  notes: string,
): ClinicalHierarchy {
  return mapSession(h, clientId, caseId, sessionId, (s) => ({ ...s, notes }))
}

export function appendSessionAnalysis(
  h: ClinicalHierarchy,
  clientId: string,
  caseId: string,
  sessionId: string,
  analysis: {
    notesSnapshot: string
    inferredModality?: string
    rationale: string
    riskFlags: unknown[]
  },
): ClinicalHierarchy {
  const record: SessionAnalysisRecord = {
    id: newId(),
    at: new Date().toISOString(),
    notesSnapshot: analysis.notesSnapshot,
    inferredModality: analysis.inferredModality,
    rationale: analysis.rationale,
    riskFlags: analysis.riskFlags,
  }
  return mapSession(h, clientId, caseId, sessionId, (s) => ({
    ...s,
    analyses: [...s.analyses, record],
  }))
}

export function appendSessionWorksheet(
  h: ClinicalHierarchy,
  clientId: string,
  caseId: string,
  sessionId: string,
  worksheet: {
    modality: string
    scenario: string
    quiz: string[]
    homework: string[]
  },
): ClinicalHierarchy {
  const record: SessionWorksheetRecord = {
    id: newId(),
    at: new Date().toISOString(),
    modality: worksheet.modality,
    scenario: worksheet.scenario,
    quiz: worksheet.quiz,
    homework: worksheet.homework,
  }
  return mapSession(h, clientId, caseId, sessionId, (s) => ({
    ...s,
    worksheets: [...s.worksheets, record],
  }))
}
