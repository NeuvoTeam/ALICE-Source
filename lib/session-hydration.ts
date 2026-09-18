/**
 * The hydration guard behind `components/vignette-generator.tsx`.
 *
 * `GET /client/:id` embeds only `sessions(id,name)` (`backend/CloudFlare.js`), so the
 * tree row that mounts the generator is a content-less stub that shares the session's
 * id. The real row arrives when `selectSession` merges `GET /sessions/:id` and sets
 * `sessionHydratedId`, so hydration must (a) wait for that signal and (b) happen
 * exactly once per session: the store replaces the session object on every write —
 * blur-saves, renames, the `PATCH` echo — and re-deriving the phase from a later write
 * would bounce the clinician out of Phase 1/2 and discard unsaved notes.
 *
 * Pure: no IO, no timers, no imports, so `tests/hydration-guard.test.mjs` can drive it
 * directly under Node's type stripping.
 */

export type HydrationAction = 'wait' | 'keep' | 'hydrate'

export function decideSessionHydration(input: {
  sessionId: string
  sessionHydratedId: string | null
  latchedSessionId: string | null
}): HydrationAction {
  // The stub shares the id but carries no payload yet.
  if (input.sessionHydratedId !== input.sessionId) return 'wait'

  // Already hydrated for this session: a later store write must not reset the phase.
  if (input.latchedSessionId === input.sessionId) return 'keep'

  return 'hydrate'
}
