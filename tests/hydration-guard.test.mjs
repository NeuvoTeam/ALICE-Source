/**
 * Regression tests for the session-hydration guard (`lib/session-hydration.ts`).
 *
 *   npm test               ->  node tests/worker.test.mjs && node tests/pdf-export.test.mjs
 *                              && node tests/hydration-guard.test.mjs
 *   npm run test:hydration ->  node tests/hydration-guard.test.mjs
 *
 * Background: `GET /client/:id` embeds only `sessions(id,name)`, so the tree row that mounts
 * `components/vignette-generator.tsx` is a content-less stub that shares the session's id; the
 * real row only lands when `selectSession` merges `GET /sessions/:id` and sets
 * `sessionHydratedId`. Reading the store imperatively on mount (deps `[sessionId, caseId]`) left
 * the clinician on an empty Phase 1 forever — commit `c902331`.
 *
 * The guard is *imported* from the production module (Node's type stripping loads the `.ts` file,
 * exactly as `tests/pdf-export.test.mjs` does). Only the effect's state writes are mirrored by
 * `runEffect`, so a drift in the guard fails here instead of hiding inside a copy of it, and
 * `runOldEffect` reproduces the previous behaviour as a counter-example.
 */
import assert from "node:assert/strict"

import { decideSessionHydration } from "../lib/session-hydration.ts"

/** Must match the fallback string `handleAnalyze` returns in backend/CloudFlare.js. */
const PLACEHOLDER_RATIONALE = "Clinical synthesis unavailable."

/** `normalizeSession` fills every field, so the stub differs from a real row only by content. */
const stub = (id) => ({
  id,
  name: "Session 1",
  sessionNotes: "",
  analysis: null,
  practicePackage: null,
})

const row = (id, overrides = {}) => ({ ...stub(id), ...overrides })

/** The payload `POST /generate/practice-package` stores. */
const PACKAGE = { homework: [{ task: "Log mood daily" }], scenario: {}, quiz: [] }

/** The local state `components/vignette-generator.tsx` keeps alongside the store. */
const component = (id) => ({
  id,
  latchedSessionId: null,
  step: 1,
  sessionInput: "",
  analysis: null,
  practicePackage: null,
  warning: null,
})

/** Mirrors the hydration effect: the guard is imported, only the writes are mirrored. */
function runEffect(c, session, sessionHydratedId) {
  if (!session) {
    c.latchedSessionId = null
    c.warning = null
    c.step = 1
    c.sessionInput = ""
    c.analysis = null
    c.practicePackage = null
    return
  }

  const action = decideSessionHydration({
    sessionId: session.id,
    sessionHydratedId,
    latchedSessionId: c.latchedSessionId,
  })

  if (action !== "hydrate") return

  c.latchedSessionId = session.id
  c.warning = null
  c.sessionInput = session.sessionNotes || ""

  const storedAnalysis = session.analysis ?? null
  c.analysis = storedAnalysis

  if (storedAnalysis?.rationale === PLACEHOLDER_RATIONALE) {
    c.warning = "placeholder analysis from an earlier failed run"
  }

  if (session.practicePackage) {
    c.practicePackage = session.practicePackage
    c.step = 3
  } else {
    c.practicePackage = null
    c.step = 1
  }
}

/** The pre-`c902331` effect: deps `[sessionId, caseId]`, one `getState()` read at mount. */
function runOldEffect(c, session) {
  c.warning = null

  if (!session) {
    c.step = 1
    c.sessionInput = ""
    c.analysis = null
    c.practicePackage = null
    return
  }

  c.sessionInput = session.sessionNotes || ""
  c.analysis = session.analysis ?? null

  if (session.practicePackage) {
    c.practicePackage = session.practicePackage
    c.step = 3
  } else {
    c.practicePackage = null
    c.step = 1
  }
}

let passed = 0

function pass(label, extra = "") {
  passed += 1
  console.log(`PASS  ${passed} ${label}${extra ? "  " + extra : ""}`)
}

async function main() {
  /* 1. The guard's decision table. */
  assert.equal(
    decideSessionHydration({ sessionId: "s1", sessionHydratedId: null, latchedSessionId: null }),
    "wait",
    "a tree stub with no signal must not hydrate"
  )
  assert.equal(
    decideSessionHydration({ sessionId: "s1", sessionHydratedId: "s9", latchedSessionId: null }),
    "wait",
    "another session's signal must not release this one"
  )
  assert.equal(
    decideSessionHydration({ sessionId: "s1", sessionHydratedId: "s1", latchedSessionId: "s1" }),
    "keep",
    "a later write for an already-hydrated session must be ignored"
  )
  assert.equal(
    decideSessionHydration({ sessionId: "s1", sessionHydratedId: "s1", latchedSessionId: "s9" }),
    "hydrate",
    "a latch for a different session must not block hydration"
  )
  assert.equal(
    decideSessionHydration({ sessionId: "s1", sessionHydratedId: "s1", latchedSessionId: null }),
    "hydrate",
    "the payload landing is the one moment hydration may run"
  )
  pass("guard: wait on the stub, keep when latched, hydrate when the payload lands")

  /* 2. The reported race: the stub arrives first and must not be mistaken for the payload. */
  const raced = component("s1")
  runEffect(raced, stub("s1"), null)
  assert.equal(raced.latchedSessionId, null, "the stub must not latch")
  assert.equal(raced.step, 1, "the stub leaves the clinician on Phase 1")
  assert.equal(raced.sessionInput, "")
  pass("race: the GET /client/:id stub never latches")

  /* 3. The payload arrives: notes, analysis and Phase 3 appear. */
  runEffect(
    raced,
    row("s1", {
      sessionNotes: "Heidi notes",
      analysis: { rationale: "Real formulation." },
      practicePackage: PACKAGE,
    }),
    "s1"
  )
  assert.equal(raced.step, 3, "a stored package rehydrates straight to Phase 3")
  assert.equal(raced.sessionInput, "Heidi notes", "the notes come from the payload")
  assert.equal(raced.analysis?.rationale, "Real formulation.")
  assert.equal(raced.practicePackage, PACKAGE)
  pass("race: the payload rehydrates the notes, the analysis and Phase 3")

  /* 4. A later store write must not re-derive the phase or overwrite the box. */
  raced.sessionInput = "half-typed edit"
  runEffect(raced, row("s1", { practicePackage: PACKAGE, sessionNotes: "edited server-side" }), "s1")
  assert.equal(raced.step, 3, "a later write must not re-derive the phase")
  assert.equal(raced.sessionInput, "half-typed edit", "in-progress notes stay in the box")
  pass("later write cannot reset the phase or stomp edits")

  /* 5. A brand-new session hydrates from an empty payload and latches. */
  const fresh = component("s2")
  runEffect(fresh, stub("s2"), null)
  runEffect(fresh, row("s2"), "s2")
  assert.equal(fresh.latchedSessionId, "s2", "an empty payload still completes hydration")
  assert.equal(fresh.step, 1)
  pass("empty session: hydration completes on Phase 1")

  /* 6. Next -> blur fires persistNotes; the arriving write must not bounce Phase 2. */
  fresh.sessionInput = "typed notes"
  fresh.step = 2
  runEffect(fresh, row("s2", { sessionNotes: "typed notes" }), "s2")
  assert.equal(fresh.step, 2, "the blur-save must not bounce Phase 2 back to Phase 1")
  assert.equal(fresh.sessionInput, "typed notes")
  pass("blur-save after Next keeps Phase 2 and the typed notes")

  /* 7. Phase 3 -> Adjust -> Back -> edit -> blur must keep the clinician on Phase 1. */
  const adjusting = component("s3")
  runEffect(adjusting, stub("s3"), null)
  runEffect(adjusting, row("s3", { practicePackage: PACKAGE }), "s3")
  assert.equal(adjusting.step, 3, "a stored package lands on Phase 3")
  adjusting.step = 2
  adjusting.step = 1
  adjusting.sessionInput = "more notes"
  runEffect(adjusting, row("s3", { practicePackage: PACKAGE, sessionNotes: "more notes" }), "s3")
  assert.equal(adjusting.step, 1, "the clinician stays where they navigated")
  assert.equal(adjusting.sessionInput, "more notes")
  pass("Adjust -> Back -> blur-save stays on Phase 1 with the edits")

  /* 8. The placeholder advisory is raised on hydration and survives a later write. */
  const placeholder = component("s4")
  runEffect(placeholder, stub("s4"), null)
  runEffect(placeholder, row("s4", { analysis: { rationale: PLACEHOLDER_RATIONALE } }), "s4")
  assert.ok(placeholder.warning, "the placeholder advisory must be shown")
  runEffect(
    placeholder,
    row("s4", { analysis: { rationale: PLACEHOLDER_RATIONALE }, sessionNotes: "n" }),
    "s4"
  )
  assert.ok(placeholder.warning, "a later write must not clear the advisory")
  pass("placeholder advisory survives a later write")

  /* 9. A real formulation must not raise it. */
  const healthy = component("s5")
  runEffect(healthy, stub("s5"), null)
  runEffect(healthy, row("s5", { analysis: { rationale: "Real formulation." } }), "s5")
  assert.equal(healthy.warning, null, "a real formulation must not warn")
  pass("no advisory for a real formulation")

  /* 10. A failed GET /sessions/:id leaves an empty Phase 1 rather than the stub. */
  const failed = component("s6")
  runEffect(failed, stub("s6"), null)
  assert.equal(failed.latchedSessionId, null, "the stub must never latch")
  assert.equal(failed.step, 1)
  assert.equal(failed.sessionInput, "")
  assert.equal(failed.practicePackage, null)
  pass("failed GET /sessions/:id leaves an empty Phase 1")

  /* 11. Switching away and back remounts `key={selectedSessionId}` with the store hydrated. */
  const remounted = component("s7")
  runEffect(remounted, row("s7", { practicePackage: PACKAGE }), "s7")
  assert.equal(remounted.step, 3, "a remount hydrates straight from the hydrated store")
  pass("remount hydrates immediately")

  /* 12. Re-selecting the same session clears the signal and re-sets it; the phase must hold. */
  const reselected = component("s8")
  runEffect(reselected, stub("s8"), null)
  runEffect(reselected, row("s8", { practicePackage: PACKAGE }), "s8")
  reselected.step = 2
  runEffect(reselected, row("s8", { practicePackage: PACKAGE }), null)
  runEffect(reselected, row("s8", { practicePackage: PACKAGE }), "s8")
  assert.equal(reselected.step, 2, "re-selecting the same session must not re-derive the phase")
  pass("re-selecting the same session leaves the clinician where they were")

  /* 13. Losing the session clears local state and re-arms the latch. */
  const lost = component("s10")
  runEffect(lost, row("s10", { practicePackage: PACKAGE }), "s10")
  assert.equal(lost.step, 3)
  runEffect(lost, null, "s10")
  assert.equal(lost.step, 1, "losing the session returns to Phase 1")
  assert.equal(lost.sessionInput, "")
  assert.equal(lost.latchedSessionId, null, "the latch is cleared")
  pass("losing the session clears local state and re-arms the latch")

  /* 14. ...so a session that comes back hydrates again. */
  runEffect(lost, row("s10", { practicePackage: PACKAGE }), "s10")
  assert.equal(lost.step, 3, "a returning session hydrates again")
  pass("the cleared latch hydrates a returning session")

  /* 15. Counter-example: the previous effect left Phase 1 empty after the payload landed. */
  const before = component("s1")
  runOldEffect(before, stub("s1"))
  assert.equal(before.step, 1, "the old effect stayed on Phase 1")
  assert.equal(before.sessionInput, "")
  assert.equal(before.practicePackage, null)
  pass("counter-example: the pre-c902331 effect stuck on an empty Phase 1")
}

const TOTAL_CHECKS = 15

main()
  .then(() => {
    if (passed !== TOTAL_CHECKS) {
      throw new Error(`${passed} checks ran but TOTAL_CHECKS is ${TOTAL_CHECKS}`)
    }
    console.log(`\n${passed}/${TOTAL_CHECKS} checks passed`)
  })
  .catch((err) => {
    console.error(`\nFAILED after ${passed} passing checks:\n`, err)
    process.exitCode = 1
  })
