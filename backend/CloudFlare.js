// @ts-nocheck
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models"
/** Last-resort default. `env.GROQ_MODEL` (wrangler.jsonc var) always wins. */
const MODEL = "openai/gpt-oss-20b"

export default {
  async fetch(request, env) {

    
    /* =========================
       ✅ CORS (ALLOWLIST)
       ========================= */
    // Echo back the request Origin only when it is explicitly allowlisted in
    // env.ALLOWED_ORIGINS (comma-separated). Anything else gets no CORS header
    // at all, so the browser blocks the response.
    //
    // TODO(clinician): ALLOWED_ORIGINS is not set on the `clinical-ai-backend`
    // Worker yet. Until it is, browsers get no CORS header and the dashboard
    // cannot call this Worker. Set it in wrangler.jsonc, e.g.
    //   "vars": { "GROQ_MODEL": "...", "ALLOWED_ORIGINS": "https://<dashboard-origin>,http://localhost:3000" }
    const requestOrigin = request.headers.get("Origin")

    const allowedOrigins = String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)

    const allowedOrigin =
      requestOrigin && allowedOrigins.includes(requestOrigin)
        ? requestOrigin
        : null

    const cors = {
      // Vary: Origin — this response varies by request Origin, so it must never be
      // served to a different Origin from a shared cache.
      ...(allowedOrigin
        ? {
            "Access-Control-Allow-Origin": allowedOrigin,
            "Vary": "Origin",
          }
        : {}),
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
    const AUTH_HEADERS = {
      "Content-Type": "application/json",
      "apikey": env.SUPABASE_ANON_KEY,
    }
    try {
/* =========================
   ✅ AUTH SIGNUP
========================= */
if (method === "POST" && cleanPath === "/auth/signup") {
  const body = await safeJson(request)

  if (
    !body?.email ||
    !body?.password ||
    !body?.first_name ||
    !body?.last_name
  ) {
    return respond(
      {
        error:
          "Missing first name, last name, email or password",
      },
      cors,
      400
    )
  }

  const signupRes = await fetch(
    `${baseUrl}/auth/v1/signup`,
    {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        email: body.email,
        password: body.password,

        data: {
          first_name: body.first_name,
          last_name: body.last_name,
          role: "clinician",
        },
      }),
    }
  )

  const signupData =
    await signupRes.json()

  if (!signupRes.ok) {
    return respond(
      signupData,
      cors,
      400
    )
  }

  return respond(
    {
      success: true,
      message:
        "Verification email sent",
    },
    cors
  )
}
/* =========================
   ✅ AUTH LOGIN
========================= */
if (method === "POST" && cleanPath === "/auth/login") {
  const body = await safeJson(request)

  if (!body?.email || !body?.password) {
    return respond(
      { error: "Missing email or password" },
      cors,
      400
    )
  }

  const loginRes = await fetch(
    `${baseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        email: body.email,
        password: body.password,
      }),
    }
  )

  const loginData = await loginRes.json()

  if (!loginRes.ok) {
    return respond(loginData, cors, 401)
  }

  return respond(
    {
      access_token:
        loginData.access_token,

      refresh_token:
        loginData.refresh_token,

      user: loginData.user,
    },
    cors
  )
}
/* =========================
   ✅ AUTH ME
========================= */
if (method === "GET" && cleanPath === "/auth/me") {
  const token =
    request.headers.get("Authorization");

  if (!token) {
    return respond(
      { error: "Missing token" },
      cors,
      401
    );
  }

  const meRes = await fetch(
    `${baseUrl}/auth/v1/user`,
    {
      method: "GET",
      headers: {
        "apikey": env.SUPABASE_ANON_KEY,
        "Authorization": token,
      },
    }
  );

  const meData = await meRes.json();

  if (!meRes.ok) {
    return respond(
      meData,
      cors,
      401
    );
  }

  const profileRes = await fetch(
    `${SUPABASE_URL}/profiles?id=eq.${meData.id}&select=*`,
    {
      headers: HEADERS,
    }
  );

  const profiles =
    await profileRes.json();

  return respond(
    {
      user: meData,
      profile: profiles?.[0] || null,
    },
    cors
  );
}
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

        const payload = buildClientPayload(body, true)

        if (!Object.keys(payload).length) {
          return respond(
            { error: "Missing client details (name or contact fields)" },
            cors,
            400
          )
        }

        const row = await writeClientRow(SUPABASE_URL, HEADERS, "POST", null, payload)

        return respond(row, cors)
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

          // ✅ Resolve the owning client from the case: callers often send only caseId.
          const caseRes = await fetch(
            `${SUPABASE_URL}/case_formulations?id=eq.${encodeURIComponent(body.caseId)}&select=id,client_id`,
            { headers: HEADERS }
          )

          if (!caseRes.ok) throw new Error(await caseRes.text())

          const caseRows = await caseRes.json()

          if (!Array.isArray(caseRows) || caseRows.length === 0) {
            return respond({ error: "Case not found" }, cors, 404)
          }

          // ✅ The case row is the source of truth for client_id; body.clientId only
          // covers legacy case rows whose own client_id is null.
          const clientId = caseRows[0].client_id || body.clientId || null
        
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
              client_id: clientId,
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

          if (!id) {
            return respond({ error: "Missing clientId" }, cors, 400)
          }

          const payload = buildClientPayload(body, true)

          if (!Object.keys(payload).length) {
            return respond(
              { error: "No client fields to update" },
              cors,
              400
            )
          }

          await writeClientRow(SUPABASE_URL, HEADERS, "PATCH", id, payload)

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
  name: body.name
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
          ✅ /client/history (materials assigned to one client)
      =========================*/
      if (method === "GET" && cleanPath === "/client/history") {
        const clientId = url.searchParams.get("clientId")

        if (!clientId) {
          return respond({ error: "Missing clientId" }, cors, 400)
        }

        // Sessions hang off cases and `sessions.client_id` is often NULL, so join via cases.
        const res = await fetch(
          `${SUPABASE_URL}/case_formulations?client_id=eq.${clientId}&select=id,name,sessions(${SESSION_FULL_SELECT})`,
          { headers: HEADERS }
        )

        if (!res.ok) throw new Error(await res.text())

        const cases = await res.json()

        const materials = (Array.isArray(cases) ? cases : [])
          .flatMap((c) =>
            (c.sessions || []).map((s) => ({ ...s, name: s.name || c.name }))
          )
          .filter((s) => s.vignette || s.practice_package)
          .map(formatClientMaterial)
          .sort((a, b) =>
            String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
          )

        return respond(materials, cors)
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
         ✅ CLIENT WORKSHEET SUBMISSION
         ========================= */
      if (method === "POST" && cleanPath === "/client/worksheet") {
        const body = await safeJson(request)

        const clientId = body?.clientId || null
        const sessionId = body?.sessionId || body?.vignetteId || null
        const answers = body?.answers || null

        if (!clientId || !answers) {
          return respond(
            { error: "Missing clientId or answers" },
            cors,
            400
          )
        }

        const res = await fetch(`${SUPABASE_URL}/worksheet_submissions`, {
          method: "POST",
          headers: HEADERS,
          body: JSON.stringify({
            client_id: clientId,
            session_id: sessionId,
            answers,
          }),
        })

        if (!res.ok) throw new Error(await res.text())

        const data = await res.json()

        return respond({ success: true, submission: data?.[0] || null }, cors)
      }

      /* =========================
         ✅ AI DIAGNOSTICS
         ========================= */
      if (method === "GET" && cleanPath === "/ai/models") {
        const configured = resolveModel(env)

        const res = await fetch(GROQ_MODELS_URL, {
          headers: {
            Authorization: `Bearer ${env.GROQ_API_KEY}`,
          },
        })

        const text = await res.text()

        if (!res.ok) {
          return respond(
            {
              ok: false,
              model: configured,
              groqStatus: res.status,
              detail: extractGroqErrorMessage(text),
            },
            cors
          )
        }

        let data = null

        try {
          data = JSON.parse(text)
        } catch {
          data = null
        }

        const available = Array.isArray(data?.data)
          ? data.data.map((m) => m?.id).filter(Boolean)
          : []

        return respond(
          {
            ok: true,
            model: configured,
            configuredAvailable: available.includes(configured),
            count: available.length,
            available,
          },
          cors
        )
      }

      if (method === "GET" && cleanPath === "/ai/health") {
        const model = resolveModel(env)

        const result = await callGroq(
          [{ role: "user", content: "Reply with the single word: ok" }],
          env,
          0
        )

        if (!result.ok) {
          return respond(
            {
              ok: false,
              model,
              groqStatus: result.error.status,
              detail: result.error.message,
            },
            cors
          )
        }

        return respond(
          {
            ok: true,
            model,
            sample: String(result.content).trim().slice(0, 80),
          },
          cors
        )
      }

      if (method === "GET" && cleanPath === "/ai/probe") {
        const model = resolveModel(env)
        const which = url.searchParams.get("prompt") || "analyze"
        const notes =
          url.searchParams.get("notes") ||
          "Client reports low mood and avoids social contact."
        const modality = url.searchParams.get("modality") || "cbt"

        const debug = {}

        let outcome

        if (which === "generate" || which === "vignette") {
          outcome = await handleGenerate(
            notes,
            modality,
            env,
            cors,
            false,
            true,
            debug
          )
        } else if (which === "package" || which === "practice-package") {
          outcome = await handleGeneratePracticePackage(
            notes,
            modality,
            env,
            cors,
            false,
            true,
            debug
          )
        } else {
          outcome = await handleAnalyze(notes, env, cors, false, true, debug)
        }

        const groqError = debug.groqError || null
        const parseOk = Boolean(debug.parsed)

        return respond(
          {
            ok: !groqError && parseOk,
            prompt: which,
            model: debug.model || model,
            parse_ok: parseOk,
            finish_reason: debug.finishReason || null,
            raw_sample: debug.raw ? String(debug.raw).slice(0, 600) : null,
            parsed: outcome instanceof Response ? null : outcome,
            groq_error: groqError,
            failure: groqError
              ? "groq_error"
              : parseOk
                ? null
                : "parse_error",
          },
          cors
        )
      }

      /* =========================
   ✅ AI ROUTES
   ========================= */
if (method === "POST") {
  const body = await safeJson(request)

  if (!body || !body.sessionNotes) {
    return respond(
      { error: "Missing sessionNotes" },
      cors,
      400
    )
  }

  // Default: fail loudly (502 + readable `detail`) when Groq is unavailable.
  // `?allowDegraded=1` restores the legacy 200 + placeholder payload + `degraded: true`.
  const allowDegraded = url.searchParams.get("allowDegraded") === "1"

  /* =========================
     ANALYZE SESSION
     ========================= */
  if (cleanPath === "/analyze/session") {
    const analysis = await handleAnalyze(
      body.sessionNotes,
      env,
      cors,
      false,
      allowDegraded
    )

    // A Response means the handler failed: 502, or a degraded 200 when flagged.
    if (analysis instanceof Response) return analysis

    if (body.sessionId) {
      await persistSessionFields(
        body.sessionId,
        {
          session_notes: body.sessionNotes,
          analysis,
        },
        env
      )

      await saveSessionVersion(
        body.sessionId,
        {
          session_notes: body.sessionNotes,
          analysis,
        },
        SUPABASE_URL,
        HEADERS
      )
    }

    return respond(analysis, cors)
  }

  /* =========================
     GENERATE VIGNETTE
     ========================= */
  if (cleanPath === "/generate/vignette") {
    const modality =
      body.verifiedModality ||
      body.modality ||
      "cbt"

    const generated = await handleGenerate(
      body.sessionNotes,
      modality,
      env,
      cors,
      false,
      allowDegraded
    )

    // A Response means the handler failed: 502, or a degraded 200 when flagged.
    if (generated instanceof Response) return generated

    if (body.sessionId) {
      await persistSessionFields(
        body.sessionId,
        {
          session_notes: body.sessionNotes,
          vignette: generated.scenario,
          homework: generated.homework,
          quiz: generated.quiz,
          modality,
        },
        env
      )

      await saveSessionVersion(
        body.sessionId,
        {
          session_notes: body.sessionNotes,
          vignette: generated.scenario,
          homework: generated.homework,
          quiz: generated.quiz,
          modality,
        },
        SUPABASE_URL,
        HEADERS
      )
    }

    return respond(generated, cors)
  }

  /* =========================
     GENERATE PRACTICE PACKAGE
     ========================= */
  if (cleanPath === "/generate/practice-package") {
    const modality =
      body.verifiedModality ||
      body.modality ||
      "cbt"

    const generated =
      await handleGeneratePracticePackage(
        body.sessionNotes,
        modality,
        env,
        cors,
        false,
        allowDegraded
      )

    // A Response means the handler failed: 502, or a degraded 200 when flagged.
    if (generated instanceof Response) return generated

    if (body.sessionId) {
      await persistSessionFields(
        body.sessionId,
        {
          practice_package: generated,
        },
        env
      )

      await saveSessionVersion(
        body.sessionId,
        {
          practice_package: generated,
        },
        SUPABASE_URL,
        HEADERS
      )
    }

    return respond(generated, cors)
  }
}

return respond(
  { error: "Route not found" },
  cors,
  404
)

} catch (err) {
  console.error(
    "Worker error:",
    err
  )

  return respond(
    {
      error:
        err.message ||
        "Server error"
    },
    cors,
    500
  )
}
}
}
/* ===============================
   ✅ ANALYZE (UNCHANGED SAFE)
   =============================== */
const SESSION_BASIC_SELECT = "id,name,case_id"
const SESSION_FULL_SELECT =
  "id,name,case_id,session_notes,vignette,homework,quiz,practice_package,analysis,modality,created_at,updated_at"

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
    "practice_package",
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

/* =========================
   ✅ CLIENT FIELD HELPERS
========================= */
const CLIENT_WRITE_KEYS = [
  "first_name",
  "middle_name",
  "last_name",
  "email",
  "country_code",
  "phone_number",
]

/** "Anna Maria Lopez" -> { first_name: "Anna", middle_name: "Maria", last_name: "Lopez" } */
function splitClientName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!parts.length) {
    return { first_name: null, middle_name: null, last_name: null }
  }

  if (parts.length === 1) {
    return { first_name: parts[0], middle_name: null, last_name: null }
  }

  return {
    first_name: parts[0],
    middle_name: parts.length > 2 ? parts.slice(1, -1).join(" ") : null,
    last_name: parts[parts.length - 1],
  }
}

function isGeneratedColumnError(text) {
  return (
    typeof text === "string" &&
    (text.includes("428C9") || /generated|non-DEFAULT/i.test(text))
  )
}

/**
 * Accepts either the discrete contact fields or a single `name`
 * (split into first/middle/last). `full_name` is included when a name is
 * supplied because the Worker only ever reads it — if it turns out to be a
 * generated column (or missing), writeClientRow retries without it.
 */
function buildClientPayload(body, includeFullName = false) {
  const payload = {}

  for (const key of CLIENT_WRITE_KEYS) {
    if (body?.[key] !== undefined) {
      payload[key] = body[key] || null
    }
  }

  const name = typeof body?.name === "string" ? body.name.trim() : ""

  if (name) {
    const nameFields = splitClientName(name)

    for (const key of Object.keys(nameFields)) {
      if (!payload[key]) payload[key] = nameFields[key]
    }

    if (includeFullName) payload.full_name = name
  }

  return payload
}

async function writeClientRow(SUPABASE_URL, HEADERS, method, id, payload) {
  const url = id
    ? `${SUPABASE_URL}/clients?id=eq.${id}`
    : `${SUPABASE_URL}/clients`

  let res = await fetch(url, {
    method,
    headers: HEADERS,
    body: JSON.stringify(payload),
  })

  let text = await res.text()

  if (
    !res.ok &&
    payload.full_name !== undefined &&
    (isGeneratedColumnError(text) || isMissingColumnError(text))
  ) {
    const retryPayload = { ...payload }
    delete retryPayload.full_name

    res = await fetch(url, {
      method,
      headers: HEADERS,
      body: JSON.stringify(retryPayload),
    })
    text = await res.text()
  }

  if (!res.ok) throw new Error(text)

  const data = JSON.parse(text)

  return Array.isArray(data) ? data[0] || null : data
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
  if (body.practicePackage !== undefined) {
  patch.practice_package =
    body.practicePackage
  }
  if (body.analysis !== undefined) {
    patch.analysis = body.analysis
  }
  if (body.modality !== undefined) {
    patch.modality = body.modality
  }

  return patch
}

/**
 * Shapes a session row into the material list `components/client-view.tsx` renders.
 */
function formatClientMaterial(row) {
  const pkg = row.practice_package || null
  const scenario = pkg?.scenario || null
  const quiz = Array.isArray(pkg?.quiz) ? pkg.quiz : []
  const coachTips = Array.isArray(scenario?.coachTips) ? scenario.coachTips : []

  const questions = quiz
    .map((q) => (typeof q === "string" ? q : q?.question))
    .filter(Boolean)

  return {
    id: row.id,
    title: row.name || scenario?.title || "Practice Materials",
    content: row.vignette || scenario?.situation || "",
    scenario: scenario?.situation || row.vignette || "",
    skill: coachTips.join("\n"),
    reflection: questions.join("\n"),
    worksheetQuestions: questions,
    createdAt: row.created_at || null,
    modality: row.modality || null,
  }
}

function formatSessionRow(row) {
  if (!row) return null

  return {
  id: row.id,
  name: row.name,
  caseId: row.case_id,
  sessionNotes: row.session_notes || "",
  vignette: row.vignette || "",

  homework: Array.isArray(row.homework)
    ? row.homework
    : [],

  quiz: Array.isArray(row.quiz)
    ? row.quiz
    : [],

  practicePackage:
    row.practice_package || null,

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

async function handleAnalyze(
  input,
  env,
  cors,
  wrapResponse = true,
  allowDegraded = false,
  debug = null
) {

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

  const result = await callGroq(messages, env, 0.3)

  if (debug) captureDebug(debug, result)

  const fallback = {
    rationale: "Clinical synthesis unavailable.",
    inferredModality: "cbt",
    riskFlags: [],
  }

  if (!result.ok) {
    if (wrapResponse || allowDegraded) {
      return respond(degradedGroqPayload(fallback, result), cors)
    }

    return groqFailureResponse(result, cors)
  }

  const parsed = extractJsonObject(stripMarkdown(result.content))

  if (debug) debug.parsed = parsed

  if (!parsed) {
    return unparseableAiResponse(
      result.content,
      fallback,
      result,
      cors,
      wrapResponse || allowDegraded
    )
  }

  const payload = {
    rationale: parsed?.rationale || fallback.rationale,
    inferredModality: (parsed?.inferredModality || "CBT").toLowerCase(),
    riskFlags: parsed?.riskFlags || [],
  }

  if (!wrapResponse) return payload

  return respond(payload, cors)
}

/* ===============================
   ✅ GENERATE (UNCHANGED SAFE)
   =============================== */
async function handleGenerate(
  input,
  modality,
  env,
  cors,
  wrapResponse = true,
  allowDegraded = false,
  debug = null
) {

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

  const result = await callGroq(messages, env, 0.6)

  if (debug) captureDebug(debug, result)

  const fallback = {
    scenario: "Scenario unavailable.",
    quiz: [],
    homework: [],
  }

  if (!result.ok) {
    if (wrapResponse || allowDegraded) {
      return respond(degradedGroqPayload(fallback, result), cors)
    }

    return groqFailureResponse(result, cors)
  }

  const parsed = extractJsonObject(stripMarkdown(result.content))

  if (debug) debug.parsed = parsed

  if (!parsed) {
    return unparseableAiResponse(
      result.content,
      fallback,
      result,
      cors,
      wrapResponse || allowDegraded
    )
  }

  const payload = {
    scenario: parsed?.scenario || fallback.scenario,
    quiz: parsed?.quiz || [],
    homework: parsed?.homework || [],
  }

  if (!wrapResponse) return payload

  return respond(payload, cors)
}
async function handleGeneratePracticePackage(
  input,
  modality,
  env,
  cors,
  wrapResponse = true,
  allowDegraded = false,
  debug = null
) {
  const messages = [
    {
      role: "system",
      content: `
You are a senior clinical psychologist.

Return ONLY JSON.

{
  "homework": [
    "task",
    "task",
    "task"
  ],

  "scenario": {
    "title": "title",
    "difficulty": "easy",
    "situation": "role-play situation",

    "objectives": [
      "objective",
      "objective"
    ],

    "coachTips": [
      "tip",
      "tip"
    ]
  },

  "quiz": [
    {
      "question": "question",
      "answer": "answer",
      "rationale": "rationale"
    }
  ]
}

Rules:
- Homework must be actionable and measurable.
- Scenario should support therapeutic role-play.
- Quiz should reinforce key therapeutic insights.
- Match the specified modality.
- Return JSON only.
`
    },
    {
      role: "user",
      content: `
Modality: ${modality}

Session Notes:

${input}
`
    }
  ]

  const result = await callGroq(
    messages,
    env,
    0.5
  )

  if (debug) captureDebug(debug, result)

  const fallback = {
    homework: [],

    scenario: {
      title: "Practice Scenario",
      difficulty: "medium",
      situation: "Practice applying therapy skills.",
      objectives: [],
      coachTips: [],
    },

    quiz: [],
  }

  if (!result.ok) {
    if (wrapResponse || allowDegraded) {
      return respond(degradedGroqPayload(fallback, result), cors)
    }

    return groqFailureResponse(result, cors)
  }

  const parsed = extractJsonObject(stripMarkdown(result.content))

  if (debug) debug.parsed = parsed

  if (!parsed) {
    return unparseableAiResponse(
      result.content,
      fallback,
      result,
      cors,
      wrapResponse || allowDegraded
    )
  }

  const payload = {
    homework:
      parsed?.homework || [],

    scenario:
      parsed?.scenario || fallback.scenario,

    quiz:
      parsed?.quiz || [],
  }

  if (!wrapResponse) {
    return payload
  }

  return respond(payload, cors)
}
/* ===============================
   ✅ GROQ CALL (RESULT OBJECT)
   =============================== */
/** `env.GROQ_MODEL` (wrangler var) wins; `MODEL` is the fallback. */
function resolveModel(env) {
  return env?.GROQ_MODEL || MODEL
}

/** Pull the human-readable reason out of a Groq error body. */
function extractGroqErrorMessage(text) {
  try {
    const parsed = JSON.parse(text)
    const message = parsed?.error?.message || parsed?.message

    if (typeof message === "string" && message.trim()) {
      return message.trim()
    }
  } catch {
    /* not JSON — fall through */
  }

  const fallback = String(text || "").trim()

  if (!fallback) return "Groq request failed"

  return fallback.length > 300 ? `${fallback.slice(0, 300)}…` : fallback
}

async function callGroq(messages, env, temperature = 0.4) {
  const model = resolveModel(env)

  try {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        ...(env?.GROQ_MAX_TOKENS
          ? { max_tokens: Number(env.GROQ_MAX_TOKENS) }
          : {}),
      }),
    })

    const text = await res.text()

    if (!res.ok) {
      const message = extractGroqErrorMessage(text)

      console.error(
        `Groq error: GROQ ERROR ${res.status} ${message} (model=${model})`
      )

      return {
        ok: false,
        model,
        error: { status: res.status, message, raw: text },
      }
    }

    let parsed

    try {
      parsed = JSON.parse(text)
    } catch {
      console.error(`Groq error: non-JSON response (model=${model})`)

      return {
        ok: false,
        model,
        error: {
          status: 502,
          message: "Groq returned a non-JSON response",
          raw: text,
        },
      }
    }

    const choice = parsed?.choices?.[0]
    const content = choice?.message?.content || null
    const finishReason = choice?.finish_reason || null

    if (finishReason === "length") {
      console.warn(
        `Groq warning: completion hit the token limit (model=${model})`
      )
    }

    if (!content) {
      console.error(
        `Groq error: empty completion (model=${model}, finish_reason=${finishReason})`
      )

      return {
        ok: false,
        model,
        error: {
          status: 502,
          message: `Groq returned an empty completion (finish_reason=${finishReason})`,
          raw: text,
        },
      }
    }

    return { ok: true, model, content, finishReason }
  } catch (err) {
    console.error("Groq error:", err)

    return {
      ok: false,
      model,
      error: {
        status: 502,
        message: err?.message || "Groq request failed",
        raw: null,
      },
    }
  }
}

/* ===============================
   ✅ AI FAILURE ENVELOPES
   =============================== */
function groqFailureResponse(result, cors) {
  return respond(
    {
      error: "AI unavailable",
      code: "GROQ_ERROR",
      detail: result.error.message,
      groqStatus: result.error.status,
      model: result.model,
    },
    cors,
    502
  )
}

function degradedGroqPayload(fallback, result) {
  return {
    ...fallback,
    degraded: true,
    warning: result.error.message,
    model: result.model,
  }
}

/** Fills the optional `debug` object used by GET /ai/probe. */
function captureDebug(debug, result) {
  debug.model = result.model
  debug.raw = result.ok ? result.content : null
  debug.finishReason = result.ok ? result.finishReason || null : null
  debug.groqError = result.ok ? null : result.error
}

/**
 * Groq answered, but the content was not usable JSON. Treated like a Groq
 * failure so a placeholder can never be presented as a real formulation.
 */
function unparseableAiResponse(content, fallback, result, cors, degrade) {
  const sample = String(content || "").slice(0, 300)
  const message = "The model returned content that could not be parsed as JSON"

  console.error(
    `Groq parse error: ${message} (model=${result.model}) sample=${JSON.stringify(sample)}`
  )

  if (degrade) {
    return respond(
      {
        ...degradedGroqPayload(fallback, {
          model: result.model,
          error: { status: 502, message },
        }),
        sample,
      },
      cors
    )
  }

  return respond(
    {
      error: "AI unavailable",
      code: "BAD_AI_RESPONSE",
      detail: message,
      sample,
      model: result.model,
    },
    cors,
    502
  )
}

/* ===============================
   ✅ CLEAN MARKDOWN
   =============================== */
/**
 * Returns the JSON-bearing text. A fenced block is *unwrapped* — the previous
 * implementation deleted it, which threw the answer away whenever a model
 * wrapped its JSON in ```json … ``` and silently produced the placeholder.
 */
function stripMarkdown(text) {
  if (!text) return ""

  const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/i)

  if (fenced && fenced[1] && fenced[1].trim()) {
    return fenced[1].trim()
  }

  return String(text).replace(/```/g, "").trim()
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
async function saveSessionVersion(
  sessionId,
  fields,
  supabaseUrl,
  headers
) {
  if (!fields || Object.keys(fields).length === 0) {
    return
  }

  try {
    const payload = {
      session_id: sessionId,
      session_notes: fields.session_notes || null,
      vignette: fields.vignette || null,
      homework: fields.homework || [],
      quiz: fields.quiz || [],

      practice_package:
        fields.practice_package || null,

      modality: fields.modality || null,
      analysis: fields.analysis || null,
      created_at: new Date().toISOString(),
    }

    await fetch(
      `${supabaseUrl}/session_versions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    )
  } catch (err) {
    console.error(
      "Session version save failed:",
      err
    )
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