// @ts-nocheck
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const MODEL = "llama-3.1-8b-instant"

export default {
  async fetch(request, env) {

    
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, Prefer",
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors })
    }

    const url = new URL(request.url)
    const path = url.pathname
    const cleanPath = path.replace(/\/+$/, "")
    const method = request.method
    console.log("REQUEST", method, cleanPath)

    // ✅ Normalize base URL (prevents // issues)
    const baseUrl = env.SUPABASE_URL.endsWith("/")
      ? env.SUPABASE_URL.slice(0, -1)
      : env.SUPABASE_URL

    const SUPABASE_URL = `${baseUrl}/rest/v1`

    const HEADERS = {
      "Content-Type": "application/json",
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Prefer": "return=representation"
    }

    try {

/* =========================
   ✅ GET ALL CLIENTS (FIXED)
   ========================= */
   if (method === "GET" && cleanPath === "/clients") {
    const res = await fetch(
      `${SUPABASE_URL}/clients?select=id,full_name`,
      { headers: HEADERS }
    )
  
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text)
    }
  
    let data
    try {
      data = await res.json()
    } catch {
      return respond([], cors)
    }
  
    return respond(
      (Array.isArray(data) ? data : []).map(c => ({
        id: c.id,
        name: c.full_name || `Client ${c.id.slice(0, 6)}`
      })),
      cors
    )
    
  }
  
        /* =========================
        ✅ CREATE CLIENT
        ========================= */
      if (method === "POST" && cleanPath === "/clients") {
        const body = await safeJson(request)

        // ✅ Use provided name OR fallback
        const name =
          body?.name && body.name.trim()
            ? body.name.trim()
            : `Client ${Date.now()}`

        const res = await fetch(`${SUPABASE_URL}/clients`, {
          method: "POST",
          headers: HEADERS,
          body: JSON.stringify({
            first_name,
            middle_name, 
            last_name,
          }),
        })

        if (!res.ok) {
          const text = await res.text()
          throw new Error(text)
        }

        const data = await res.json()

        return respond(data?.[0] || data, cors)
      }


      /* =========================
         ✅ CREATE CASE
         ========================= */
         if (method === "POST" && cleanPath === "/cases") {
          const body = await safeJson(request)
        
          if (!body?.clientId) {
            return respond({ error: "Missing clientId" }, cors, 400)
          }
        
          // ✅ Count existing cases for this client
          const countRes = await fetch(
            `${SUPABASE_URL}/case_formulations?client_id=eq.${body.clientId}&select=id`,
            { headers: HEADERS }
          )
        
          const existing = await countRes.json()
          const nextNumber = (Array.isArray(existing) ? existing.length : 0) + 1
        
          const name = body?.name || `Case ${nextNumber}`
        
          const res = await fetch(`${SUPABASE_URL}/case_formulations`, {
            method: "POST",
            headers: HEADERS,
            body: JSON.stringify({
              client_id: body.clientId,
              name,
            }),
          })
        
          if (!res.ok) throw new Error(await res.text())
        
          const data = await res.json()
          return respond(data?.[0] || data, cors)
        }

      /* =========================
         ✅ CREATE SESSION
         ========================= */
         if (method === "POST" && cleanPath === "/sessions") {
          const body = await safeJson(request)
        
          if (!body?.caseId) {
            return respond({ error: "Missing caseId" }, cors, 400)
          }
        
          // ✅ Count existing sessions for this case
          const countRes = await fetch(
            `${SUPABASE_URL}/sessions?case_id=eq.${body.caseId}&select=id`,
            { headers: HEADERS }
          )
        
          const existing = await countRes.json()
          const nextNumber = (Array.isArray(existing) ? existing.length : 0) + 1
        
          const name = body?.name || `Session ${nextNumber}`
        
          const res = await fetch(`${SUPABASE_URL}/sessions`, {
            method: "POST",
            headers: HEADERS,
            body: JSON.stringify({
              case_id: body.caseId,
              client_id: body.clientId,
              name,
            }),
          })
        
          if (!res.ok) throw new Error(await res.text())
        
          const data = await res.json()
          return respond(data?.[0] || data, cors)
        }

      /* =========================
         ✅ DELETE CASE
         ========================= */
      if (method === "DELETE" && cleanPath.startsWith("/cases/")) {
        const id = path.split("/")[2]

        if (!id) {
          return respond({ error: "Missing caseId" }, cors, 400)
        }

        const res = await fetch(
          `${SUPABASE_URL}/case_formulations?id=eq.${id}`,
          { method: "DELETE", headers: HEADERS }
        )

        if (!res.ok && res.status !== 204) {
          throw new Error(await res.text())
        }

        return respond({ success: true }, cors)
      }

      /* =========================
         ✅ DELETE SESSION
         ========================= */
      if (method === "DELETE" && cleanPath.startsWith("/sessions/")) {
        const id = path.split("/")[2]

        if (!id) {
          return respond({ error: "Missing sessionId" }, cors, 400)
        }

        const res = await fetch(
          `${SUPABASE_URL}/sessions?id=eq.${id}`,
          { method: "DELETE", headers: HEADERS }
        )

        if (!res.ok && res.status !== 204) {
          throw new Error(await res.text())
        }

        return respond({ success: true }, cors)
      }

      /* =========================
          ✅ RENAME CLIENT
          ========================= */
        if (method === "PATCH" && cleanPath.startsWith("/clients/")) {
          const id = path.split("/")[2]
          const body = await safeJson(request)

          if (!body?.name) {
            return respond({ error: "Missing name" }, cors, 400)
          }

          const res = await fetch(
            `${SUPABASE_URL}/clients?id=eq.${id}`,
            {
              method: "PATCH",
              headers: HEADERS,
              body: JSON.stringify({ first_name, middle_name, last_name }),
            }
          )

          if (!res.ok) throw new Error(await res.text())

          return respond({ success: true }, cors)
        }

        /* =========================
          ✅ RENAME CASE
          ========================= */
        if (method === "PATCH" && cleanPath.startsWith("/cases/")) {
          const id = path.split("/")[2]
          const body = await safeJson(request)

          if (!body?.name) {
            return respond({ error: "Missing name" }, cors, 400)
          }

          const res = await fetch(
            `${SUPABASE_URL}/case_formulations?id=eq.${id}`,
            {
              method: "PATCH",
              headers: HEADERS,
              body: JSON.stringify({ 
                first_name,
                middle_name,
                last_name
               }),
            }
          )

          if (!res.ok) throw new Error(await res.text())

          return respond({ success: true }, cors)
        }

        /* =========================
          ✅ UPDATE SESSION (name + clinical content)
          ========================= */
        if (method === "PATCH" && cleanPath.startsWith("/sessions/")) {
          const id = cleanPath.split("/")[2]
          const body = await safeJson(request)

          if (!id) {
            return respond({ error: "Missing sessionId" }, cors, 400)
          }

          const patch = buildSessionPatch(body)
          if (!Object.keys(patch).length) {
            return respond({ error: "No fields to update" }, cors, 400)
          }

          const row = await patchSessionRow(id, patch, SUPABASE_URL, HEADERS)
          
          if (!row) {
            return respond({ error: "Session not found" }, cors, 404)
          }

          await saveSessionVersion(id, patch, SUPABASE_URL, HEADERS)

          return respond(formatSessionRow(row), cors)
        }

      /* =========================
      ✅ CLIENT HOMEWORK ROUTE (MERGED)
      ========================= */
    if (method === "GET" && cleanPath.startsWith("/client-homework/")) {
      const sessionId = cleanPath.split("/")[2]

      if (!sessionId || sessionId.length < 10) {
        return respond({ error: "Invalid session ID" }, cors, 400)
      }

      const row = await fetchSessionRow(sessionId, SUPABASE_URL, HEADERS)

      if (!row) {
        return respond({ error: "Session not found" }, cors, 404)
      }

      return respond({
        sessionId: row.id,
        title: row.name,
        homework: Array.isArray(row.homework) ? row.homework : [],
        quiz: Array.isArray(row.quiz) ? row.quiz : [],
        vignette: row.vignette || "",
      }, cors)
    }

/* =========================
         ✅ GET SESSION
         ========================= */
      if (method === "GET" && cleanPath.startsWith("/sessions/")) {
        const id = cleanPath.split("/")[2]

        if (!id) {
          return respond({ error: "Missing sessionId" }, cors, 400)
        }

        const row = await fetchSessionRow(id, SUPABASE_URL, HEADERS)
        if (!row) {
          return respond({ error: "Session not found" }, cors, 404)
        }

        return respond(formatSessionRow(row), cors)
      }

      /* =========================
        ✅ GET ALL SESSIONS (HISTORY)
        ========================= */
        if (method === "GET" && cleanPath === "/sessions") {
          const clientId = url.searchParams.get("clientId")
          const sessionId = url.searchParams.get("sessionId")

          let query = `${SUPABASE_URL}/sessions?select=${SESSION_FULL_SELECT}&order=created_at.desc`

          if (clientId) {
            query += `&client_id=eq.${clientId}`
          }

          if (sessionId) {
            query += `&id=eq.${sessionId}`
          }

          const res = await fetch(query, { headers: HEADERS })

          if (!res.ok) {
            throw new Error(await res.text())
          }

          const data = await res.json()

          // ✅ format all rows
          const formatted = Array.isArray(data)
            ? data.map(formatSessionRow)
            : []

          return respond(formatted, cors)
        }

      /* =========================
         ✅ RESTORED ROUTE (IMPORTANT)
         ========================= */
      if (method === "GET" && cleanPath === "/latest-session") {
        const sessionId = url.searchParams.get("sessionId")

        if (!sessionId) {
          return respond({
            sessionNotes: "",
            lastUpdated: null,
          }, cors)
        }

        const row = await fetchSessionRow(sessionId, SUPABASE_URL, HEADERS)
        if (!row) {
          return respond({ error: "Session not found" }, cors, 404)
        }

        return respond(formatSessionRow(row), cors)
      }
      /*=========================
          ✅ /client/:id (single client tree)
      =========================*/
      if (method === "GET" && cleanPath.startsWith("/client/")) {
        const id = cleanPath.split("/")[2]

        const res = await fetch(
          `${SUPABASE_URL}/clients?id=eq.${id}&select=id,full_name,case_formulations(id,name,sessions(id,name))`,
          { headers: HEADERS }
        )

        if (!res.ok) throw new Error(await res.text())

        const data = await res.json()

        if (!data?.length) {
          return respond({ error: "Client not found" }, cors, 404)
        }

        return respond({
          id: data[0].id,
          name: data[0].full_name,
          cases: data[0].case_formulations || [],
        }, cors)
      }



      /* =========================
         ✅ AI ROUTES
         ========================= */
      if (method === "POST") {
        const body = await safeJson(request)

        if (!body || !body.sessionNotes) {
          return respond({ error: "Missing sessionNotes" }, cors, 400)
        }

        if (cleanPath === "/analyze/session") {
          const analysis = await handleAnalyze(body.sessionNotes, env, cors, false)
          if (body.sessionId) {
            await persistSessionFields(body.sessionId, {
              session_notes: body.sessionNotes,
              analysis: analysis,
            }, env)
            await saveSessionVersion(body.sessionId, {
              session_notes: body.sessionNotes,
              analysis: analysis,
            }, SUPABASE_URL, HEADERS)
          }
          return respond(analysis, cors)
        }

        if (cleanPath === "/generate/vignette") {
          const modality = body.verifiedModality || body.modality || "cbt"
          const generated = await handleGenerate(body.sessionNotes, modality, env, cors, false)
          if (body.sessionId) {
            await persistSessionFields(body.sessionId, {
              session_notes: body.sessionNotes,
              vignette: generated.scenario,
              homework: generated.homework,
              quiz: generated.quiz,
              modality,
            }, env)
            await saveSessionVersion(body.sessionId, {
              session_notes: body.sessionNotes,
              vignette: generated.scenario,
              homework: generated.homework,
              quiz: generated.quiz,
              modality,
            }, SUPABASE_URL, HEADERS)
          }
          return respond(generated, cors)
        }
      }

      return respond({ error: "Route not found" }, cors, 404)

    } catch (err) {
      console.error("Worker error:", err)
      return respond({ error: err.message || "Server error" }, cors, 500)
    }
  }
}

/* ===============================
   ✅ ANALYZE (UNCHANGED SAFE)
   =============================== */
const SESSION_BASIC_SELECT = "id,name,case_id"
const SESSION_FULL_SELECT =
  "id,name,case_id,session_notes,vignette,homework,quiz,analysis,modality,created_at,updated_at"

function isMissingColumnError(text) {
  return (
    typeof text === "string" &&
    (text.includes("42703") || text.includes("does not exist"))
  )
}

async function supabaseJson(url, options) {
  const res = await fetch(url, options)
  const text = await res.text()
  return { res, text }
}

async function fetchSessionRow(sessionId, supabaseUrl, headers) {
  let { res, text } = await supabaseJson(
    `${supabaseUrl}/sessions?id=eq.${sessionId}&select=${SESSION_FULL_SELECT}`,
    { headers }
  )

  if (!res.ok && isMissingColumnError(text)) {
    ;({ res, text } = await supabaseJson(
      `${supabaseUrl}/sessions?id=eq.${sessionId}&select=${SESSION_BASIC_SELECT}`,
      { headers }
    ))
  }

  if (!res.ok) throw new Error(text)

  const data = JSON.parse(text)
  return data?.[0] || null
}

async function patchSessionRow(sessionId, patch, supabaseUrl, headers) {
  const clinicalKeys = [
    "session_notes",
    "vignette",
    "homework",
    "quiz",
    "analysis",
    "modality",
  ]
  const clinicalPatch = {}
  const safePatch = {}

  for (const [key, value] of Object.entries(patch)) {
    if (clinicalKeys.includes(key)) clinicalPatch[key] = value
    else safePatch[key] = value
  }

  let latest = null

  if (Object.keys(safePatch).length) {
    const { res, text } = await supabaseJson(
      `${supabaseUrl}/sessions?id=eq.${sessionId}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(safePatch),
      }
    )
    if (!res.ok) throw new Error(text)
    const data = JSON.parse(text)
    latest = data?.[0] || null
  }

  if (!Object.keys(clinicalPatch).length) {
    return latest || (await fetchSessionRow(sessionId, supabaseUrl, headers))
  }

  const { res, text } = await supabaseJson(
    `${supabaseUrl}/sessions?id=eq.${sessionId}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(clinicalPatch),
    }
  )

  if (!res.ok) {
    if (isMissingColumnError(text)) {
      console.warn("Clinical session columns missing; run Supabase migration.")
      return latest || (await fetchSessionRow(sessionId, supabaseUrl, headers))
    }
    throw new Error(text)
  }

  const data = JSON.parse(text)
  return data?.[0] || latest
}

function buildSessionPatch(body) {
  if (!body || typeof body !== "object") return {}

  const patch = {}

  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim()
  }
  if (body.sessionNotes !== undefined) {
    patch.session_notes = body.sessionNotes
  }
  if (body.vignette !== undefined) {
    patch.vignette = body.vignette
  }
  if (body.homework !== undefined) {
    patch.homework = body.homework
  }
  if (body.quiz !== undefined) {
    patch.quiz = body.quiz
  }
  if (body.analysis !== undefined) {
    patch.analysis = body.analysis
  }
  if (body.modality !== undefined) {
    patch.modality = body.modality
  }

  return patch
}

function formatSessionRow(row) {
  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    caseId: row.case_id,
    sessionNotes: row.session_notes || "",
    vignette: row.vignette || "",
    homework: Array.isArray(row.homework) ? row.homework : [],
    quiz: Array.isArray(row.quiz) ? row.quiz : [],
    analysis: row.analysis || null,
    modality: row.modality || null,
    created_at: row.created_at || null,
    lastUpdated: row.updated_at || null,
  }
}

async function persistSessionFields(sessionId, fields, env) {
  const baseUrl = env.SUPABASE_URL.endsWith("/")
    ? env.SUPABASE_URL.slice(0, -1)
    : env.SUPABASE_URL

  const SUPABASE_URL = `${baseUrl}/rest/v1`

  const HEADERS = {
    "Content-Type": "application/json",
    "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Prefer": "return=representation",
  }

  try {
    await patchSessionRow(sessionId, fields, SUPABASE_URL, HEADERS)
  } catch (err) {
    console.error("Failed to persist session:", err)
  }
}

async function handleAnalyze(input, env, cors, wrapResponse = true) {

  const messages = [
    {
      role: "system",
      content: `
You are an expert clinical psychologist.

Return ONLY JSON.

{
  "rationale": "mechanism-level clinical formulation",
  "inferredModality": "CBT | DBT | ACT",
  "riskFlags": [
    {
      "label": "specific risk",
      "severity": "low | medium | high",
      "confidence": 0.0-1.0,
      "evidence": ["exact phrase from notes"]
    }
  ]
}

Rules:
- Focus on underlying mechanisms (not summary)
- Extract verbatim evidence phrases
- Include only real risks (no filler)
- Do not output anything except JSON
`
    },
    { role: "user", content: input }
  ]

  const raw = await callGroq(messages, env, 0.3)
  const cleaned = stripMarkdown(raw)
  const parsed = extractJsonObject(cleaned)

  const payload = {
    rationale: parsed?.rationale || "Clinical synthesis unavailable.",
    inferredModality: (parsed?.inferredModality || "CBT").toLowerCase(),
    riskFlags: parsed?.riskFlags || [],
  }

  if (!wrapResponse) return payload

  return respond(payload, cors)
}

/* ===============================
   ✅ GENERATE (UNCHANGED SAFE)
   =============================== */
async function handleGenerate(input, modality, env, cors, wrapResponse = true) {

  const messages = [
    {
      role: "system",
      content: `
You are a senior clinical educator.

Return ONLY JSON.

{
  "scenario": "4-6 sentence realistic vignette",
  "quiz": [
    "insight question",
    "insight question",
    "insight question"
  ],
  "homework": [
    "specific actionable task",
    "specific actionable task",
    "specific actionable task"
  ]
}

Rules:
- Scenario must reflect real psychological mechanisms
- Questions must test insight, not recall
- Homework must be precise and measurable
- Match modality strictly
`
    },
    {
      role: "user",
      content: `
Modality: ${modality}

Case:
${input}
`
    }
  ]

  const raw = await callGroq(messages, env, 0.6)
  const cleaned = stripMarkdown(raw)
  const parsed = extractJsonObject(cleaned)

  const payload = {
    scenario: parsed?.scenario || "Scenario unavailable.",
    quiz: parsed?.quiz || [],
    homework: parsed?.homework || [],
  }

  if (!wrapResponse) return payload

  return respond(payload, cors)
}

/* ===============================
   ✅ GROQ CALL (SAFE + DEBUG)
   =============================== */
async function callGroq(messages, env, temperature = 0.4) {
  try {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature,
      }),
    })

    const text = await res.text()

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`GROQ ERROR: ${text}`)
    }

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch {
      return null
    }

    return parsed?.choices?.[0]?.message?.content || null

  } catch (err) {
    console.error("Groq error:", err)
    return null
  }
}

/* ===============================
   ✅ CLEAN MARKDOWN
   =============================== */
function stripMarkdown(text) {
  if (!text) return ""
  return text
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim()
}

/* ===============================
   ✅ SAFE JSON EXTRACTOR
   =============================== */
function extractJsonObject(text) {
  if (!text) return null

  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")

  if (start === -1 || end === -1 || end <= start) return null

  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

/* ===============================
   ✅ VERSION SAVE FUNCTION
   =============================== */
   async function saveSessionVersion(sessionId, fields, supabaseUrl, headers) {
    if (!fields || Object.keys(fields).length === 0) return
    try {
      const payload = {
        session_id: sessionId,
        session_notes: fields.session_notes || null,
        vignette: fields.vignette || null,
        homework: fields.homework || [],
        quiz: fields.quiz || [],
        modality: fields.modality || null,
        analysis: fields.analysis || null,
        created_at: new Date().toISOString(),
      }
  
      await fetch(`${supabaseUrl}/session_versions`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      })
    } catch (err) {
      console.error("Session version save failed:", err)
    }
  }
  

/* ===============================
   ✅ HELPERS
   =============================== */
function respond(data, cors, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
    },
  })
}

async function safeJson(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
} 