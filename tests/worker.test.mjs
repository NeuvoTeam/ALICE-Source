/**
 * Regression tests for the clinical AI Worker (`backend/CloudFlare.js`).
 *
 *   npm test        ->  node tests/worker.test.mjs
 *
 * No network, no secrets, no database: `globalThis.fetch` is stubbed and the
 * Worker's own `fetch` handler is driven with synthetic `Request`s. The Worker
 * is copied to a temporary `.mjs` first because this package has no
 * `"type": "module"`, so Node would otherwise parse its ESM syntax as CommonJS.
 */
import assert from "node:assert/strict"
import { copyFile, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

const WORKER_SOURCE = new URL("../backend/CloudFlare.js", import.meta.url)

/** A well-formed answer. */
const VALID = JSON.stringify({
  rationale: "Real formulation.",
  inferredModality: "CBT",
  riskFlags: [],
})

/** Unparseable even after repair: a trailing comma before the closing brace. */
const INVALID =
  '{"rationale":"Real formulation.","inferredModality":"CBT","riskFlags":[],}'

/** Repairable: an unescaped inner quote — the live residual failure signature. */
const REPAIRABLE =
  '{"rationale":"Client said "I am a failure" out loud","inferredModality":"CBT","riskFlags":[]}'

/** Repairable inside a nested value: the live package failure at position ~1395. */
const REPAIRABLE_PACKAGE =
  '{"homework":["Log mood daily, noting when he said "I am a failure""],"scenario":{"title":"Repaired scenario","difficulty":"easy","situation":"He said "stop" and left.","objectives":["objective"],"coachTips":["tip"]},"quiz":[{"question":"q","answer":"a","rationale":"r"}]}'

/** The other reproduced failure: finish_reason "length", half-written object. */
const TRUNCATED =
  '{"homework":["Log mood daily"],"scenario":{"title":"Performance review'

/** A complete practice package. */
const PACKAGE = JSON.stringify({
  homework: ["Log mood daily"],
  scenario: {
    title: "Test scenario",
    difficulty: "easy",
    situation: "Role-play.",
    objectives: ["objective"],
    coachTips: ["tip"],
  },
  quiz: [{ question: "q", answer: "a", rationale: "r" }],
})

const env = {
  SUPABASE_URL: "https://project.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "test-only",
  SUPABASE_ANON_KEY: "anon-test-only",
  GROQ_API_KEY: "gsk_test_only",
  GROQ_MODEL: "openai/gpt-oss-20b",
  ALLOWED_ORIGINS: "http://localhost:3000",
}

const NOTES = "Client reports low mood and avoids social contact."

/** The only token the stubbed Supabase `/auth/v1/user` accepts. */
const VALID_TOKEN = "Bearer test-token"

const tempDir = await mkdtemp(join(tmpdir(), "alice-worker-test-"))
const workerFile = join(tempDir, "CloudFlare.mjs")

await copyFile(WORKER_SOURCE, workerFile)

const worker = (await import(pathToFileURL(workerFile).href)).default

let calls = []
let groqSteps = []

/** Stubs Groq *and* Supabase REST, recording every outbound request. */
function installFetch(steps) {
  groqSteps = steps
  calls = []

  globalThis.fetch = async (url, init = {}) => {
    const href = String(url)
    const record = {
      url: href,
      method: init.method || "GET",
      body: init.body ? JSON.parse(init.body) : null,
    }

    const isGroq = href.includes("api.groq.com")
    const isAuth = href.includes("/auth/v1/user")
    record.kind = isGroq ? "groq" : isAuth ? "auth" : "supabase"
    calls.push(record)

    // The Worker validates the caller's token here before touching any data.
    if (isAuth) {
      const sent = (init.headers && init.headers.Authorization) || ""

      if (sent !== VALID_TOKEN) {
        return new Response(
          JSON.stringify({ error: "invalid claim: missing sub claim" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        )
      }

      return new Response(
        JSON.stringify({ id: "user-1", email: "clinician@example.com" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    if (!isGroq) {
      // Supabase REST with `Prefer: return=representation` answers with an array.
      return new Response(
        JSON.stringify([
          {
            id: "sess-1",
            name: "Session 1",
            practice_package: { homework: ["Practice task A"] },
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    const index = calls.filter((c) => c.kind === "groq").length - 1
    const step = groqSteps[Math.min(index, groqSteps.length - 1)]

    if (step.error) {
      return new Response(JSON.stringify({ error: { message: step.error } }), {
        status: step.status || 429,
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: { content: step.content },
            finish_reason: step.finishReason || "stop",
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }
}

const groqCalls = () => calls.filter((c) => c.kind === "groq")
const supabaseCalls = () => calls.filter((c) => c.kind === "supabase")
const authCalls = () => calls.filter((c) => c.kind === "auth")
const pathOf = (c) => new URL(c.url).pathname
const queryOf = (c) => new URL(c.url).search

/**
 * `options.token` defaults to the accepted clinician token; pass `null` to send
 * no Authorization header at all (the anonymous case the guard must reject).
 */
async function call(method, path, payload, overrideEnv = env, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    Origin: "http://localhost:3000",
  }

  if (options.token !== null) {
    headers.Authorization = options.token || VALID_TOKEN
  }

  const res = await worker.fetch(
    new Request(`https://worker.test${path}`, {
      method,
      headers,
      body: payload ? JSON.stringify(payload) : undefined,
    }),
    overrideEnv
  )

  const text = await res.text()

  return {
    status: res.status,
    // `OPTIONS` answers with a null body, so parse only when there is one.
    body: text ? JSON.parse(text) : null,
  }
}

let passed = 0

function pass(label, extra = "") {
  passed += 1
  console.log(`PASS  ${passed} ${label}${extra ? "  " + extra : ""}`)
}

async function main() {
  /* 1. Clean answer: JSON mode on, no retry, temperature preserved. */
  installFetch([{ content: VALID }])
  let r = await call("POST", "/analyze/session", { sessionNotes: NOTES })
  assert.equal(r.status, 200)
  assert.equal(r.body.rationale, "Real formulation.")
  assert.equal(groqCalls().length, 1, "a clean answer must not retry")
  // The default response format is "off": the prompt asks for JSON and nothing is
  // forced at the API level — measured as the most reliable of the three modes.
  assert.equal(groqCalls()[0].body.response_format, undefined)
  assert.equal(groqCalls()[0].body.reasoning_effort, "low")
  assert.equal(groqCalls()[0].body.temperature, 0.3)
  assert.equal(groqCalls()[0].body.max_tokens, undefined, "deprecated param dropped")
  pass("analyze: JSON mode + reasoning_effort=low, single call")

  /* 2. Invalid JSON then good: exactly one corrective retry at temperature 0. */
  installFetch([{ content: INVALID }, { content: VALID }])
  r = await call("POST", "/analyze/session", { sessionNotes: NOTES })
  assert.equal(r.status, 200)
  assert.equal(r.body.rationale, "Real formulation.")
  assert.equal(groqCalls().length, 2, "expected exactly one retry")
  assert.equal(groqCalls()[1].body.temperature, 0)
  assert.equal(groqCalls()[1].body.messages.length, 3)
  assert.match(groqCalls()[1].body.messages[2].content, /not valid JSON/)
  assert.equal(groqCalls()[1].body.response_format, undefined)
  pass("analyze: invalid JSON recovered by one temperature-0 retry")

  /* 3. Invalid twice: honest 502 with PHI-free diagnostics. */
  installFetch([{ content: INVALID }, { content: INVALID }])
  r = await call("POST", "/analyze/session", { sessionNotes: NOTES })
  assert.equal(r.status, 502)
  assert.equal(r.body.code, "BAD_AI_RESPONSE")
  assert.equal(r.body.reason, "invalid_json")
  assert.equal(r.body.attempts, 2)
  assert.equal(r.body.finishReason, "stop")
  assert.equal(r.body.length, INVALID.length)
  assert.ok(r.body.parseError)
  assert.equal(
    r.body.detail,
    "The model returned content that could not be parsed as JSON"
  )
  pass("analyze: 502 BAD_AI_RESPONSE + reason/parseError", r.body.parseError)

  /* 4. Truncated then good: the retry gets a bigger output budget. */
  installFetch([{ content: TRUNCATED, finishReason: "length" }, { content: VALID }])
  r = await call("POST", "/analyze/session", { sessionNotes: NOTES })
  assert.equal(r.status, 200)
  assert.equal(groqCalls()[1].body.max_completion_tokens, 4096)
  pass("analyze: truncation retried with max_completion_tokens=4096")

  /* 5. Truncated twice: reported as truncation, not as a JSON parse error. */
  installFetch([
    { content: TRUNCATED, finishReason: "length" },
    { content: TRUNCATED, finishReason: "length" },
  ])
  r = await call("POST", "/analyze/session", { sessionNotes: NOTES })
  assert.equal(r.status, 502)
  assert.equal(r.body.code, "AI_TRUNCATED")
  assert.equal(r.body.reason, "truncated")
  assert.match(r.body.detail, /cut off/)
  pass("analyze: 502 AI_TRUNCATED (not BAD_AI_RESPONSE)")

  /* 6. Practice package: both classes, plus the degraded 200. */
  installFetch([{ content: INVALID }, { content: INVALID }])
  r = await call("POST", "/generate/practice-package", {
    sessionNotes: NOTES,
    modality: "cbt",
  })
  assert.equal(r.status, 502)
  assert.equal(r.body.code, "BAD_AI_RESPONSE")
  assert.equal(groqCalls().length, 2)

  installFetch([
    { content: TRUNCATED, finishReason: "length" },
    { content: TRUNCATED, finishReason: "length" },
  ])
  r = await call("POST", "/generate/practice-package?allowDegraded=1", {
    sessionNotes: NOTES,
    modality: "cbt",
  })
  assert.equal(r.status, 200)
  assert.equal(r.body.degraded, true)
  assert.equal(r.body.code, "AI_TRUNCATED")
  assert.equal(
    r.body.warning,
    "The model's answer was cut off before the JSON was complete"
  )
  assert.equal(r.body.scenario.title, "Practice Scenario")
  pass("package: 502 and degraded 200 both carry a truthful code")

  /* 7. A Groq failure on the retry stays GROQ_ERROR. */
  installFetch([{ content: INVALID }, { error: "Rate limit reached", status: 429 }])
  r = await call("POST", "/analyze/session", { sessionNotes: NOTES })
  assert.equal(r.status, 502)
  assert.equal(r.body.code, "GROQ_ERROR")
  assert.equal(r.body.groqStatus, 429)
  pass("analyze: retry that 429s reports GROQ_ERROR")

  /* 8. /ai/probe is the triage route and explains itself. */
  installFetch([{ content: INVALID }, { content: PACKAGE }])
  r = await call("GET", "/ai/probe?prompt=package")
  assert.equal(r.body.parse_ok, true)
  assert.equal(r.body.attempts, 2)
  assert.equal(r.body.reason, null)
  assert.equal(r.body.failure, null)

  installFetch([{ content: INVALID }, { content: INVALID }])
  r = await call("GET", "/ai/probe?prompt=package")
  assert.equal(r.body.ok, false)
  assert.equal(r.body.parse_ok, false)
  assert.equal(r.body.attempts, 2)
  assert.equal(r.body.reason, "invalid_json")
  assert.equal(r.body.failure, "parse_error")
  assert.ok(r.body.parse_error)
  pass("probe: reports attempts/reason/parse_error")

  /* 9. Untouched routes: /ai/health sends no JSON mode; a non-reasoning model
        must not receive `reasoning_effort`. */
  installFetch([{ content: "ok" }])
  r = await call("GET", "/ai/health")
  assert.equal(r.body.ok, true)
  assert.equal(groqCalls()[0].body.response_format, undefined)
  assert.equal(groqCalls()[0].body.temperature, 0)
  assert.equal(groqCalls()[0].body.reasoning_effort, "low")

  installFetch([{ content: VALID }])
  await call(
    "POST",
    "/analyze/session",
    { sessionNotes: NOTES },
    { ...env, GROQ_MODEL: "allam-2-7b" }
  )
  assert.equal(groqCalls()[0].body.reasoning_effort, undefined)
  pass("health + non-reasoning model: no JSON mode, no reasoning_effort")

  /* 10. GROQ_MAX_TOKENS still works, under the non-deprecated parameter name. */
  installFetch([{ content: VALID }])
  await call(
    "POST",
    "/analyze/session",
    { sessionNotes: NOTES },
    { ...env, GROQ_MAX_TOKENS: "2048" }
  )
  assert.equal(groqCalls()[0].body.max_completion_tokens, 2048)
  pass("GROQ_MAX_TOKENS => max_completion_tokens")

  /* 11. Persistence: an analyze run carrying a sessionId writes `sessions` and
         appends `session_versions` (snake_case, as Supabase expects). */
  installFetch([{ content: VALID }])
  r = await call("POST", "/analyze/session", {
    sessionNotes: NOTES,
    sessionId: "sess-1",
  })
  assert.equal(r.status, 200)

  const patches = supabaseCalls().filter((c) => c.method === "PATCH")
  assert.equal(patches.length, 1, "clinical fields go in a single PATCH")
  assert.equal(pathOf(patches[0]), "/rest/v1/sessions")
  assert.equal(queryOf(patches[0]), "?id=eq.sess-1")
  assert.deepEqual(Object.keys(patches[0].body).sort(), [
    "analysis",
    "session_notes",
  ])
  assert.equal(patches[0].body.session_notes, NOTES)
  assert.equal(patches[0].body.analysis.rationale, "Real formulation.")

  const versions = supabaseCalls().filter(
    (c) => c.method === "POST" && pathOf(c) === "/rest/v1/session_versions"
  )
  assert.equal(versions.length, 1)
  assert.deepEqual(Object.keys(versions[0].body).sort(), [
    "analysis",
    "created_at",
    "homework",
    "modality",
    "practice_package",
    "quiz",
    "session_id",
    "session_notes",
    "vignette",
  ])
  assert.equal(versions[0].body.session_id, "sess-1")
  assert.equal(versions[0].body.session_notes, NOTES)
  pass("persistence: analyze writes sessions + session_versions")

  /* 12. Persistence: the practice package is stored as `practice_package`. */
  installFetch([{ content: PACKAGE }])
  r = await call("POST", "/generate/practice-package", {
    sessionNotes: NOTES,
    modality: "cbt",
    sessionId: "sess-2",
  })
  assert.equal(r.status, 200)

  const packagePatch = supabaseCalls().find((c) => c.method === "PATCH")
  assert.equal(queryOf(packagePatch), "?id=eq.sess-2")
  assert.deepEqual(Object.keys(packagePatch.body), ["practice_package"])
  assert.equal(packagePatch.body.practice_package.scenario.title, "Test scenario")
  pass("persistence: package writes practice_package")

  /* 13. A failed generation writes nothing — no placeholder can reach the DB. */
  installFetch([{ content: INVALID }, { content: INVALID }])
  r = await call("POST", "/analyze/session", {
    sessionNotes: NOTES,
    sessionId: "sess-1",
  })
  assert.equal(r.status, 502)
  assert.equal(supabaseCalls().length, 0)

  installFetch([
    { content: TRUNCATED, finishReason: "length" },
    { content: TRUNCATED, finishReason: "length" },
  ])
  r = await call("POST", "/generate/practice-package?allowDegraded=1", {
    sessionNotes: NOTES,
    modality: "cbt",
    sessionId: "sess-1",
  })
  assert.equal(r.body.degraded, true)
  assert.equal(supabaseCalls().length, 0, "degraded output is never persisted")
  pass("persistence: failed and degraded runs write nothing")

  /* 14. Shape validation: the live defect was valid JSON carrying only
         `homework`, which used to 200 + persist the placeholder scenario. */
  const PARTIAL_PACKAGE = JSON.stringify({
    homework: ["Complete the decatastrophizing worksheet"],
  })

  installFetch([{ content: PARTIAL_PACKAGE }, { content: PACKAGE }])
  r = await call("POST", "/generate/practice-package", {
    sessionNotes: NOTES,
    modality: "cbt",
  })
  assert.equal(r.status, 200)
  assert.equal(groqCalls().length, 2, "a partial answer must be retried")
  assert.equal(r.body.scenario.title, "Test scenario", "no placeholder substituted")
  assert.equal(r.body.quiz.length, 1)
  pass("package: a partial answer is retried and replaced, never filled with fallbacks")

  /* 15. A partial answer that survives the retry fails loudly and writes nothing. */
  installFetch([{ content: PARTIAL_PACKAGE }, { content: PARTIAL_PACKAGE }])
  r = await call("POST", "/generate/practice-package", {
    sessionNotes: NOTES,
    modality: "cbt",
    sessionId: "sess-1",
  })
  assert.equal(r.status, 502)
  assert.equal(r.body.code, "BAD_AI_SHAPE")
  assert.equal(r.body.reason, "bad_shape")
  assert.equal(r.body.attempts, 2)
  assert.equal(
    r.body.detail,
    "The model's answer did not match the required JSON shape"
  )
  assert.match(r.body.parseError, /practice-package contract/)
  assert.equal(supabaseCalls().length, 0, "a placeholder must never be persisted")
  pass("package: unwrapped partial answer => 502 BAD_AI_SHAPE, no writes")

  /* 16. A missing `riskFlags` must not be read as "no risks" — that is a safety
         claim, so the answer is rejected rather than defaulted to []. */
  const PARTIAL_ANALYSIS = JSON.stringify({ inferredModality: "CBT" })

  installFetch([{ content: PARTIAL_ANALYSIS }, { content: PARTIAL_ANALYSIS }])
  r = await call("POST", "/analyze/session", { sessionNotes: NOTES })
  assert.equal(r.status, 502)
  assert.equal(r.body.code, "BAD_AI_SHAPE")
  assert.equal(r.body.riskFlags, undefined, "no fabricated empty risk list")
  pass("analyze: missing rationale/riskFlags => 502, never defaulted")

  /* 17. ...and the retry recovers the real formulation. */
  installFetch([{ content: PARTIAL_ANALYSIS }, { content: VALID }])
  r = await call("POST", "/analyze/session", { sessionNotes: NOTES })
  assert.equal(r.status, 200)
  assert.equal(r.body.rationale, "Real formulation.")
  assert.equal(groqCalls().length, 2)
  pass("analyze: partial answer recovered by the retry")

  /* 18. If Groq rejects the schema (400), degrade to JSON Object mode rather than
         failing every AI route outright. */
  installFetch([
    { error: "Invalid schema for response_format", status: 400 },
    { content: VALID },
  ])
  r = await call(
    "POST",
    "/analyze/session",
    { sessionNotes: NOTES },
    { ...env, GROQ_RESPONSE_FORMAT: "schema" }
  )
  assert.equal(r.status, 200)
  assert.equal(groqCalls().length, 2)
  assert.equal(groqCalls()[0].body.response_format.type, "json_schema")
  assert.equal(groqCalls()[1].body.response_format.type, "json_object")
  assert.equal(r.body.rationale, "Real formulation.")
  pass("schema rejection (400) degrades to json_object instead of failing")

  /* 19. Groq validates strict-schema output *after* generating it, so a "does not
         match the expected schema" 400 means the model stopped early. That is
         retriable — and it must be retried WITH the schema, not downgraded. */
  installFetch([
    {
      error:
        "Generated JSON does not match the expected schema. jsonschema: '' does not validate with /required: missing properties: 'scenario', 'quiz'",
      status: 400,
    },
    { content: PACKAGE },
  ])
  r = await call(
    "POST",
    "/generate/practice-package",
    { sessionNotes: NOTES, modality: "cbt" },
    { ...env, GROQ_RESPONSE_FORMAT: "schema" }
  )
  assert.equal(r.status, 200)
  assert.equal(groqCalls().length, 2)
  assert.equal(groqCalls()[1].body.response_format.type, "json_schema")
  assert.equal(r.body.scenario.title, "Test scenario")
  pass("schema mismatch 400 => retried with the schema, not downgraded")

  /* 20. "schema" mode sends strict JSON Schema (operator-selectable). */
  installFetch([{ content: VALID }])
  r = await call(
    "POST",
    "/analyze/session",
    { sessionNotes: NOTES },
    { ...env, GROQ_RESPONSE_FORMAT: "schema" }
  )
  assert.equal(r.status, 200)
  assert.equal(groqCalls()[0].body.response_format.type, "json_schema")
  assert.equal(groqCalls()[0].body.response_format.json_schema.strict, true)
  assert.equal(
    groqCalls()[0].body.response_format.json_schema.name,
    "clinical_analysis"
  )
  assert.deepEqual(
    groqCalls()[0].body.response_format.json_schema.schema.required.sort(),
    ["inferredModality", "rationale", "riskFlags"]
  )
  pass("GROQ_RESPONSE_FORMAT=schema sends strict json_schema")

  /* 21. "json_object" mode sends syntax-only JSON mode. */
  installFetch([{ content: VALID }])
  r = await call(
    "POST",
    "/analyze/session",
    { sessionNotes: NOTES },
    { ...env, GROQ_RESPONSE_FORMAT: "json_object" }
  )
  assert.equal(r.status, 200)
  assert.equal(groqCalls()[0].body.response_format.type, "json_object")
  pass("GROQ_RESPONSE_FORMAT=json_object sends json_object")

  /* 22. An unescaped inner quote is repaired rather than failing the run — the
         signature of the live residual failures (3 of 10 runs). */
  installFetch([{ content: REPAIRABLE }])
  r = await call("POST", "/analyze/session", { sessionNotes: NOTES })
  assert.equal(r.status, 200)
  assert.equal(groqCalls().length, 1, "no retry when the repair succeeds")
  assert.equal(r.body.rationale, 'Client said "I am a failure" out loud')

  installFetch([{ content: REPAIRABLE }])
  r = await call("GET", "/ai/probe?prompt=analyze")
  assert.equal(r.body.parse_ok, true)
  assert.equal(r.body.strategy, "repaired")
  pass("unescaped quote repaired without a retry (strategy=repaired)")

  /* 23. Same repair inside a nested package value — what broke the live runs. */
  installFetch([{ content: REPAIRABLE_PACKAGE }])
  r = await call("POST", "/generate/practice-package", {
    sessionNotes: NOTES,
    modality: "cbt",
  })
  assert.equal(r.status, 200)
  assert.equal(groqCalls().length, 1)
  assert.equal(r.body.scenario.title, "Repaired scenario")
  assert.equal(r.body.quiz.length, 1)
  pass("nested unescaped quote repaired, package accepted")

  /* ===== B1/B2: clinician authentication guard ===== */

  /* 24. A clinician route with no token is 401 and touches nothing. */
  installFetch([{ content: VALID }])
  r = await call("GET", "/clients", null, env, { token: null })
  assert.equal(r.status, 401)
  assert.equal(r.body.error, "Missing token")
  assert.equal(authCalls().length, 0, "no token means no Supabase call")
  assert.equal(supabaseCalls().length, 0, "the database is never reached")

  /* 25. A malformed/expired token is 401. */
  installFetch([{ content: VALID }])
  r = await call("GET", "/clients", null, env, { token: "Bearer garbage" })
  assert.equal(r.status, 401)
  assert.equal(authCalls().length, 1)
  assert.equal(supabaseCalls().length, 0)
  pass("guard: missing and malformed tokens are 401, nothing upstream")

  /* 26. A valid token passes; the write routes are guarded too. */
  installFetch([{ content: VALID }])
  r = await call("GET", "/clients")
  assert.equal(r.status, 200)
  assert.equal(authCalls().length, 1)

  installFetch([{ content: VALID }])
  r = await call(
    "PATCH",
    "/sessions/sess-1",
    { sessionNotes: NOTES },
    env,
    { token: null }
  )
  assert.equal(r.status, 401)
  assert.equal(supabaseCalls().length, 0, "an unauthenticated PATCH cannot write")
  pass("guard: valid token 200, unauthenticated PATCH 401 with no write")

  /* 27. OPTIONS stays exempt so CORS preflight never needs a token. */
  installFetch([{ content: VALID }])
  r = await call("OPTIONS", "/clients", null, env, { token: null })
  assert.equal(r.status, 200)
  assert.equal(authCalls().length, 0)
  pass("guard: OPTIONS preflight is exempt")

  /* 28. The client link stays zero-friction and loses every clinical field. */
  installFetch([{ content: VALID }])
  r = await call("GET", "/client-homework/session-0001", null, env, { token: null })
  assert.equal(r.status, 200)
  assert.equal(authCalls().length, 0, "the client link needs no token")
  assert.deepEqual(Object.keys(r.body).sort(), [
    "homework",
    "practiceHomework",
    "quiz",
    "sessionId",
    "title",
    "vignette",
  ])
  assert.deepEqual(r.body.practiceHomework, ["Practice task A"])
  pass("public /client-homework: no token, no notes/analysis/riskFlags")

  /* 29. The auth routes stay public, or nobody could ever log in. */
  installFetch([{ content: VALID }])
  r = await call(
    "POST",
    "/auth/login",
    { email: "a@b.c", password: "x" },
    env,
    { token: null }
  )
  assert.notEqual(r.status, 401)
  assert.equal(authCalls().length, 0, "login must not require a token")
  pass("guard: auth routes remain public")
}

const TOTAL_CHECKS = 28

main()
  .then(() => console.log(`\n${passed}/${TOTAL_CHECKS} checks passed`))
  .catch((err) => {
    console.error(`\nFAILED after ${passed} passing checks:\n`, err)
    process.exitCode = 1
  })
  .finally(() => rm(tempDir, { recursive: true, force: true }))

