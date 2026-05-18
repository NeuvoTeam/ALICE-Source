// @ts-nocheck
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const MODEL = "llama-3.1-8b-instant"

export default {
  async fetch(request, env) {

    
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
      `${SUPABASE_URL}/clients?select=id,name`,
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
        name: c.name || `Client ${c.id.slice(0, 6)}`
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
            name,
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
              body: JSON.stringify({ name: body.name }),
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
              body: JSON.stringify({ name: body.name }),
            }
          )

          if (!res.ok) throw new Error(await res.text())

          return respond({ success: true }, cors)
        }

        /* =========================
          ✅ RENAME SESSION
          ========================= */
        if (method === "PATCH" && cleanPath.startsWith("/sessions/")) {
          const id = path.split("/")[2]
          const body = await safeJson(request)

          if (!body?.name) {
            return respond({ error: "Missing name" }, cors, 400)
          }

          const res = await fetch(
            `${SUPABASE_URL}/sessions?id=eq.${id}`,
            {
              method: "PATCH",
              headers: HEADERS,
              body: JSON.stringify({ name: body.name }),
            }
          )

          if (!res.ok) throw new Error(await res.text())

          return respond({ success: true }, cors)
        }

      /* =========================
         ✅ RESTORED ROUTE (IMPORTANT)
         ========================= */
      if (method === "GET" && cleanPath === "/latest-session") {
        return respond({
          sessionNotes: "",
          lastUpdated: null,
        }, cors)
      }
      /*=========================
          ✅ /client/:id (single client tree)
      =========================*/
      if (method === "GET" && cleanPath.startsWith("/client/")) {
        const id = cleanPath.split("/")[2]

        const res = await fetch(
          `${SUPABASE_URL}/clients?id=eq.${id}&select=id,name,case_formulations(id,name,sessions(id,name))`,
          { headers: HEADERS }
        )

        if (!res.ok) throw new Error(await res.text())

        const data = await res.json()

        if (!data?.length) {
          return respond({ error: "Client not found" }, cors, 404)
        }

        return respond({
          id: data[0].id,
          name: data[0].name,
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

        if (path === "/analyze/session") {
          return await handleAnalyze(body.sessionNotes, env, cors)
        }

        if (path === "/generate/vignette") {
          const modality = body.verifiedModality || body.modality || "cbt"
          return await handleGenerate(body.sessionNotes, modality, env, cors)
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
async function handleAnalyze(input, env, cors) {

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

  return respond({
    rationale: parsed?.rationale || "Clinical synthesis unavailable.",
    inferredModality: (parsed?.inferredModality || "CBT").toLowerCase(),
    riskFlags: parsed?.riskFlags || [],
  }, cors)
}

/* ===============================
   ✅ GENERATE (UNCHANGED SAFE)
   =============================== */
async function handleGenerate(input, modality, env, cors) {

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

  return respond({
    scenario: parsed?.scenario || "Scenario unavailable.",
    quiz: parsed?.quiz || [],
    homework: parsed?.homework || [],
  }, cors)
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