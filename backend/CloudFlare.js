// @ts-nocheck
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models"
/** Last-resort default. `env.GROQ_MODEL` (wrangler.jsonc var) always wins. */
const MODEL = "openai/gpt-oss-20b"

/* ===============================
   ✅ CALLER AUTHENTICATION
   =============================== */
/**
 * Validates the caller's Supabase access token — the same check `GET /auth/me`
 * has always performed, extracted so every clinician route can reuse it.
 *
 * Returns a `401` Response when the caller may not proceed, a `503` when Supabase
 * itself cannot be reached, or `null` when the request is authenticated.
 */
async function requireUser(request, env, cors, baseUrl) {
  const token = request.headers.get("Authorization")

  if (!token) {
    return respond({ error: "Missing token" }, cors, 401)
  }

  try {
    const res = await fetch(`${baseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        "apikey": env.SUPABASE_ANON_KEY,
        "Authorization": token,
      },
    })

    if (res.ok) return null

    const data = await res.json().catch(() => null)

    return respond(data || { error: "Invalid token" }, cors, 401)
  } catch (err) {
    console.error("Auth check failed:", err)

    return respond({ error: "Authentication unavailable" }, cors, 503)
  }
}

/* ===============================
   ✅ CLIENT LINK SIGNING (HMAC-SHA256)
   =============================== */
/**
 * The client-facing pages (`/homework/:id`, `/practice/:id`) are deliberately
 * token-free so a client can open a shared link — which used to mean a raw UUID
 * was the only secret. Links are now signed and expiring:
 *
 *   /homework/<sessionId>?exp=<unixSeconds>&sig=<base64url>
 *
 * The signature covers `v1|sessionId|exp`, so a UUID alone opens nothing, the
 * expiry cannot be extended without the secret, and a link cannot be replayed
 * against a different session.
 *
 * `CLIENT_LINK_SECRET` is a Worker secret (never committed). It is *trimmed* on
 * read, so a trailing newline captured by `wrangler secret put` from a piped
 * value cannot desynchronise signing from verification.
 */
const CLIENT_LINK_DEFAULT_TTL_DAYS = 14
const CLIENT_LINK_MAX_TTL_DAYS = 30

function clientLinkSecret(env) {
  const raw = String(env?.CLIENT_LINK_SECRET || "").trim()

  return raw.length >= 16 ? raw : null
}

/** Where the client pages are served; falls back to the allowlisted app origin. */
function publicAppBase(env) {
  const configured = String(env?.PUBLIC_APP_URL || "").trim()

  if (configured) return configured.replace(/\/+$/, "")

  const first = String(env?.ALLOWED_ORIGINS || "").split(",")[0].trim()

  return first ? first.replace(/\/+$/, "") : ""
}

function base64UrlFromBytes(bytes) {
  const view = new Uint8Array(bytes)
  let binary = ""

  for (let i = 0; i < view.length; i++) {
    binary += String.fromCharCode(view[i])
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlToBytes(value) {
  const padded =
    value.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes
}

function clientLinkMessage(sessionId, exp) {
  return `v1|${sessionId}|${exp}`
}

async function hmacClientLinkKey(secret, usage) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  )
}

async function signClientLink(sessionId, exp, secret) {
  const key = await hmacClientLinkKey(secret, "sign")

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(clientLinkMessage(sessionId, exp))
  )

  return base64UrlFromBytes(signature)
}

/**
 * `{ ok, reason }`. Uses `crypto.subtle.verify`, which is constant-time — a
 * hand-rolled string comparison here would leak the signature byte by byte.
 */
async function verifyClientLink(sessionId, searchParams, env) {
  const secret = clientLinkSecret(env)

  if (!secret) {
    console.error(
      "CLIENT_LINK_SECRET missing or too short — client links are disabled"
    )

    return { ok: false, reason: "not_configured" }
  }

  const expRaw = searchParams.get("exp")
  const sig = searchParams.get("sig")

  if (!expRaw || !sig) return { ok: false, reason: "missing" }

  const exp = Number(expRaw)

  if (!Number.isInteger(exp)) return { ok: false, reason: "missing" }

  if (exp * 1000 <= Date.now()) return { ok: false, reason: "expired" }

  try {
    const key = await hmacClientLinkKey(secret, "verify")

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(sig),
      new TextEncoder().encode(clientLinkMessage(sessionId, exp))
    )

    return valid ? { ok: true, exp } : { ok: false, reason: "bad_signature" }
  } catch {
    return { ok: false, reason: "bad_signature" }
  }
}

function clientLinkTtlDays(value) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return CLIENT_LINK_DEFAULT_TTL_DAYS
  }

  return Math.min(Math.floor(parsed), CLIENT_LINK_MAX_TTL_DAYS)
}

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
    /* =========================
       ✅ CALLER AUTHENTICATION GUARD
       ========================= */
    // Everything below is clinician-only except two things: the auth routes
    // themselves and the narrow, token-free client projection that
    // `/homework` and `/practice` read. `OPTIONS` already returned above, so CORS
    // preflight never needs a token.
    const isPublicRoute =
      cleanPath.startsWith("/auth/") ||
      cleanPath === "/client-homework" ||
      cleanPath.startsWith("/client-homework/")

    if (!isPublicRoute) {
      const unauthorized = await requireUser(request, env, cors, baseUrl)

      if (unauthorized) return unauthorized
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
         ✅ MINT CLIENT LINK (clinician only)
         ========================= */
      // Issues the signed, expiring link for the token-free client pages. This
      // path is NOT in the public list above, so it is behind `requireUser`:
      // only a signed-in clinician can produce a link.
      if (method === "GET" && cleanPath.startsWith("/client-link/")) {
        const sessionId = cleanPath.split("/")[2]

        if (!sessionId || sessionId.length < 10) {
          return respond({ error: "Invalid session ID" }, cors, 400)
        }

        const secret = clientLinkSecret(env)

        if (!secret) {
          return respond({ error: "Client links are not configured" }, cors, 503)
        }

        const base = publicAppBase(env)

        if (!base) {
          return respond({ error: "PUBLIC_APP_URL is not configured" }, cors, 500)
        }

        const row = await fetchSessionRow(sessionId, SUPABASE_URL, HEADERS)

        if (!row) {
          return respond({ error: "Session not found" }, cors, 404)
        }

        const ttlDays = clientLinkTtlDays(url.searchParams.get("ttlDays"))
        const exp = Math.floor(Date.now() / 1000) + ttlDays * 86400
        const sig = await signClientLink(sessionId, exp, secret)
        const query = `exp=${exp}&sig=${encodeURIComponent(sig)}`

        return respond(
          {
            sessionId,
            ttlDays,
            exp,
            expiresAt: new Date(exp * 1000).toISOString(),
            homeworkUrl: `${base}/homework/${sessionId}?${query}`,
            practiceUrl: `${base}/practice/${sessionId}?${query}`,
          },
          cors
        )
      }

      /* =========================
      ✅ CLIENT HOMEWORK ROUTE (MERGED)
      ========================= */
    if (method === "GET" && cleanPath.startsWith("/client-homework/")) {
      const sessionId = cleanPath.split("/")[2]

      if (!sessionId || sessionId.length < 10) {
        return respond({ error: "Invalid session ID" }, cors, 400)
      }

      const link = await verifyClientLink(sessionId, url.searchParams, env)

      if (!link.ok) {
        console.warn(
          `Client link rejected (${link.reason}) for ${String(sessionId).slice(0, 8)}…`
        )

        return respond(
          {
            error:
              "This link is invalid or has expired. Please ask your clinician for a new one.",
          },
          cors,
          403
        )
      }

      const row = await fetchSessionRow(sessionId, SUPABASE_URL, HEADERS)

      if (!row) {
        return respond({ error: "Session not found" }, cors, 404)
      }

      const practiceHomework =
        row.practice_package && Array.isArray(row.practice_package.homework)
          ? row.practice_package.homework
          : []

      return respond({
        sessionId: row.id,
        title: row.name,
        homework: Array.isArray(row.homework) ? row.homework : [],
        quiz: Array.isArray(row.quiz) ? row.quiz : [],
        vignette: row.vignette || "",
        // Deliberately narrow: this route is public, so it must never carry
        // session_notes, analysis or riskFlags.
        practiceHomework,
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
        // "parse_ok" now means *accepted*: the answer parsed AND matched the
        // contract. A valid-JSON-but-partial answer is a failure, not a pass.
        const parseOk = Boolean(debug.usable)

        return respond(
          {
            ok: !groqError && parseOk,
            prompt: which,
            model: debug.model || model,
            parse_ok: parseOk,
            finish_reason: debug.finishReason || null,
            attempts: debug.attempts || 1,
            reason: debug.reason || null,
            parse_error: debug.parseError || null,
            strategy: debug.strategy || null,
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

  const attempt = await generateJson(messages, env, 0.3, {
    debug,
    contract: "analyze",
    isValid: isUsableAnalysis,
    schema: ANALYSIS_SCHEMA,
    schemaName: "clinical_analysis",
  })

  const result = attempt.result

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

  const parsed = attempt.parsed

  if (!parsed) {
    return unparseableAiResponse(
      attempt,
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

  const attempt = await generateJson(messages, env, 0.6, {
    debug,
    contract: "generate",
    isValid: isUsableVignette,
    schema: VIGNETTE_SCHEMA,
    schemaName: "clinical_vignette",
  })

  const result = attempt.result

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

  const parsed = attempt.parsed

  if (!parsed) {
    return unparseableAiResponse(
      attempt,
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

  const attempt = await generateJson(messages, env, 0.5, {
    debug,
    contract: "practice-package",
    isValid: isUsablePracticePackage,
    schema: PRACTICE_PACKAGE_SCHEMA,
    schemaName: "clinical_practice_package",
  })

  const result = attempt.result

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

  const parsed = attempt.parsed

  if (!parsed) {
    return unparseableAiResponse(
      attempt,
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

/**
 * `GROQ_RESPONSE_FORMAT` selects how the JSON contract is requested:
 *   "schema"      - `json_schema` with `strict: true` (constrained decoding);
 *   "json_object" - syntax-only JSON mode;
 *   "off"         - prompt-only: the system prompt asks for JSON and nothing is
 *                   forced at the API level.
 *
 * Measured live against openai/gpt-oss-20b (5 runs each, same 1.8k-char note):
 *   "json_object" - every answer parsed, but 4 of 8 stopped after `homework`,
 *                   so the placeholder scenario was persisted (valid JSON, wrong
 *                   shape - the defect this file now rejects);
 *   "schema"      - ~40% hard 400s ("Generated JSON does not match the expected
 *                   schema ... expected object, but got array"): Groq validates
 *                   the generation *after* the fact rather than constraining it,
 *                   so the model can still fail the schema;
 *   "off"         - the model is free to write the whole object it was shown.
 * The default is therefore "off", with the schema still used for the *validator*.
 */
function resolveResponseFormat(env) {
  const mode = String(env?.GROQ_RESPONSE_FORMAT || "off").toLowerCase()

  return mode === "schema" || mode === "json_object" ? mode : "off"
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

/**
 * `options` is either a legacy numeric temperature or
 * `{ temperature, responseFormat, schema, schemaName, maxCompletionTokens, reasoningEffort }`.
 */
async function callGroq(messages, env, options = 0.4) {
  const opts =
    typeof options === "number" ? { temperature: options } : options || {}

  const model = resolveModel(env)

  const temperature =
    typeof opts.temperature === "number" ? opts.temperature : 0.4

  /**
   * Prompt-only JSON is what produced unparseable answers, so the three AI
   * routes opt into Groq's JSON mode: the endpoint then rejects a completion
   * that is not valid JSON syntax instead of handing us prose. Callers that do
   * not want JSON (e.g. GET /ai/health) simply leave this off.
   */
  /** "schema" | "json_object" | "off" — resolved by the caller (generateJson). */
  const responseFormat = opts.responseFormat || "off"

  /** When supplied, "schema" mode uses *strict* JSON Schema mode. */
  const schema = opts.schema || null

  const schemaName = opts.schemaName || "clinical_payload"

  const maxCompletionTokens =
    Number(opts.maxCompletionTokens || env?.GROQ_MAX_TOKENS) || null

  /**
   * gpt-oss/Qwen models spend output tokens on hidden reasoning. An explicit
   * `GROQ_REASONING_EFFORT` wins; otherwise ask for "low" on reasoning models
   * only, because a non-reasoning model would reject the parameter outright.
   */
  const reasoningEffort =
    opts.reasoningEffort ||
    env?.GROQ_REASONING_EFFORT ||
    (isReasoningModel(model) ? "low" : null)

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
        ...(responseFormat === "off"
          ? {}
          : {
              response_format:
                responseFormat === "schema" && schema
                  ? {
                      type: "json_schema",
                      json_schema: { name: schemaName, strict: true, schema },
                    }
                  : { type: "json_object" },
            }),
        ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
        // `max_tokens` is deprecated on Groq; the JSON-bearing equivalent is
        // `max_completion_tokens`. Sent only when configured, so nothing can
        // truncate the JSON by accident.
        ...(maxCompletionTokens
          ? { max_completion_tokens: maxCompletionTokens }
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
function unparseableAiResponse(attempt, fallback, result, cors, degrade) {
  const content = result.ok ? result.content : ""
  const sample = String(content || "").slice(0, 300)
  const attempts = (attempt && attempt.attempts) || 1

  /**
   * Three distinct failures used to share one message:
   *  - `truncated`  the model ran out of output before the object closed;
   *  - `bad_shape`  the JSON parsed but did not match the contract, so the
   *                 fallback would have been persisted as if it were real work;
   *  - anything else: the content was not JSON at all.
   */
  const diagnosis =
    (attempt && attempt.diagnosis) || describeJsonFailure(result, content)

  const message =
    diagnosis.reason === "truncated"
      ? "The model's answer was cut off before the JSON was complete"
      : diagnosis.reason === "bad_shape"
        ? "The model's answer did not match the required JSON shape"
        : "The model returned content that could not be parsed as JSON"

  const code =
    diagnosis.reason === "truncated"
      ? "AI_TRUNCATED"
      : diagnosis.reason === "bad_shape"
        ? "BAD_AI_SHAPE"
        : "BAD_AI_RESPONSE"

  /**
   * `parseError` is `JSON.parse`'s own message (it names the offset and the
   * cause) plus structural counters — never clinical text, so these fields are
   * safe to return to the browser and to keep in the Worker log.
   */
  const diagnostics = {
    reason: diagnosis.reason,
    parseError: diagnosis.parseError,
    finishReason: result.finishReason || null,
    length: content.length,
    attempts,
  }

  console.error(
    `Groq parse error: ${message} (model=${result.model}, reason=${
      diagnosis.reason
    }, attempts=${attempts}, finish_reason=${
      result.finishReason || "n/a"
    }) ${diagnosis.parseError} sample=${JSON.stringify(sample)}`
  )

  if (degrade) {
    return respond(
      {
        ...degradedGroqPayload(fallback, {
          model: result.model,
          error: { status: 502, message },
        }),
        code,
        sample,
        ...diagnostics,
      },
      cors
    )
  }

  return respond(
    {
      error: "AI unavailable",
      code,
      detail: message,
      sample,
      model: result.model,
      ...diagnostics,
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
/**
 * Escapes the JSON the model *should* have escaped: an inner `"` inside a string
 * value, and raw control characters. Measured live this was the dominant residual
 * failure — `Expected ',' or ']' after array element in JSON at position 1395`,
 * i.e. `["task", "he said "hi"", "task"]` (3 of 10 runs).
 *
 * Rule for an in-string `"`: it only *closes* the string when the next significant
 * character is structural (`: , } ]` or end of input); otherwise the model forgot
 * the backslash. A repair that mangles valid JSON cannot slip through, because the
 * caller still validates the parsed shape against the contract.
 */
function repairJson(text) {
  let out = ""
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (escaped) {
      out += char
      escaped = false

      continue
    }

    if (char === "\\") {
      out += char
      escaped = true

      continue
    }

    if (char === '"') {
      if (!inString) {
        inString = true
        out += char

        continue
      }

      let j = i + 1

      while (j < text.length && /\s/.test(text[j])) j += 1

      const next = j >= text.length ? "" : text[j]

      if (
        next === "" ||
        next === ":" ||
        next === "," ||
        next === "}" ||
        next === "]"
      ) {
        inString = false
        out += char
      } else {
        out += '\\"'
      }

      continue
    }

    if (inString && (char === "\n" || char === "\r" || char === "\t")) {
      out += char === "\n" ? "\\n" : char === "\r" ? "\\r" : "\\t"

      continue
    }

    out += char
  }

  return out
}

/** Strategy used by the last `extractJsonObject` call — surfaced by /ai/probe. */
let lastJsonStrategy = "strict"

function extractJsonObject(text) {
  if (!text) return null

  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")

  if (start === -1 || end === -1 || end <= start) return null

  const slice = text.slice(start, end + 1)

  try {
    lastJsonStrategy = "strict"

    return JSON.parse(slice)
  } catch {
    /* fall through to the repair pass */
  }

  try {
    const repaired = JSON.parse(repairJson(slice))

    lastJsonStrategy = "repaired"

    return repaired
  } catch {
    lastJsonStrategy = "failed"

    return null
  }
}

/* ===============================
   ✅ JSON MODE + ONE CORRECTIVE RETRY
   =============================== */
/**
 * Models that accept `reasoning_effort`. A non-reasoning model (allam-2-7b,
 * whisper, …) answers 400 when the parameter is sent, so it is never sent to
 * one of those.
 */
function isReasoningModel(model) {
  return /gpt-oss|qwen|deepseek|minimax|reason/i.test(String(model || ""))
}

/** Appended as a final user turn when the first answer was not usable JSON. */
const JSON_RETRY_INSTRUCTION =
  "Your previous reply was not valid JSON. Reply again with ONLY the JSON object: no prose, no markdown fences, no trailing commas, and every string properly escaped."

/** Room for reasoning tokens *plus* a complete JSON document on the retry. */
const TRUNCATION_RETRY_MAX_TOKENS = 4096

/**
 * Names *why* an answer was unusable without copying clinical text around:
 * `JSON.parse` itself reports the offset and the cause (bad control character,
 * unexpected token, …), and that is what makes the failure fixable.
 */
function describeJsonFailure(result, text) {
  const raw = String(text || "")

  if (result && result.ok && result.finishReason === "length") {
    return {
      reason: "truncated",
      parseError: "the completion hit the token limit before the JSON closed",
    }
  }

  const start = raw.indexOf("{")

  if (start === -1) {
    return {
      reason: "no_json_found",
      parseError: `no "{" in the ${raw.length}-character reply`,
    }
  }

  const end = raw.lastIndexOf("}")

  if (end <= start) {
    return {
      reason: "no_json_found",
      parseError: `the JSON object never closed (length=${raw.length})`,
    }
  }

  try {
    JSON.parse(raw.slice(start, end + 1))
  } catch (err) {
    return {
      reason: raw[start] === "{" && end - start + 1 === raw.trim().length
        ? "invalid_json"
        : "prose_wrapped_invalid_json",
      parseError: err?.message || String(err),
    }
  }

  return {
    reason: "invalid_json",
    parseError: "the reply only parsed after discarding surrounding text",
  }
}

/* ===============================
   ✅ OUTPUT SHAPE CONTRACTS
   =============================== */
/**
 * The prompts in `documentation.md` §7.1 demand specific fields, but a 20B model
 * can return *valid JSON that is missing them*. Substituting the hard-coded
 * fallback then persists a placeholder as if it were real work — verified live:
 * a real run stored `scenario.title: "Practice Scenario"` with an empty quiz,
 * because the answer carried `homework` but no `scenario`/`quiz`.
 *
 * Each contract therefore states its minimum usable shape, and anything less is
 * treated exactly like unparseable output: one retry at temperature 0, then a
 * 502. Nothing is persisted on that path (`unparseableAiResponse` returns a
 * Response, so the router bails before `persistSessionFields`).
 */
/**
 * Strict JSON Schema definitions.
 *
 * JSON Object mode only guarantees *syntactically* valid JSON, so the model is
 * free to stop after the first key — measured live: 4 of 8 completions returned
 * `{"homework": [...]}` alone, and the retry did not fix it. Constrained decoding
 * (`json_schema` + `strict: true`) *forces* every key, which is the only way the
 * contract below is guaranteed rather than hoped for.
 *
 * Strict mode requires that every object sets `additionalProperties: false` and
 * lists every property in `required`.
 */
const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["rationale", "inferredModality", "riskFlags"],
  properties: {
    rationale: { type: "string" },
    inferredModality: { type: "string", enum: ["CBT", "DBT", "ACT"] },
    riskFlags: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "severity", "confidence", "evidence"],
        properties: {
          label: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          confidence: { type: "number" },
          evidence: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
}

const VIGNETTE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scenario", "quiz", "homework"],
  properties: {
    scenario: { type: "string" },
    quiz: { type: "array", items: { type: "string" } },
    homework: { type: "array", items: { type: "string" } },
  },
}

const PRACTICE_PACKAGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["homework", "scenario", "quiz"],
  properties: {
    homework: { type: "array", items: { type: "string" } },
    scenario: {
      type: "object",
      additionalProperties: false,
      required: ["title", "difficulty", "situation", "objectives", "coachTips"],
      properties: {
        title: { type: "string" },
        difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        situation: { type: "string" },
        objectives: { type: "array", items: { type: "string" } },
        coachTips: { type: "array", items: { type: "string" } },
      },
    },
    quiz: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "answer", "rationale"],
        properties: {
          question: { type: "string" },
          answer: { type: "string" },
          rationale: { type: "string" },
        },
      },
    },
  },
}

function isUsableAnalysis(parsed) {
  return Boolean(
    parsed &&
      typeof parsed.rationale === "string" &&
      parsed.rationale.trim() &&
      // A missing `riskFlags` must not be read as "no risks": that is a safety
      // claim, not a formatting detail.
      Array.isArray(parsed.riskFlags)
  )
}

function isUsableVignette(parsed) {
  return Boolean(
    parsed &&
      typeof parsed.scenario === "string" &&
      parsed.scenario.trim() &&
      Array.isArray(parsed.quiz) &&
      Array.isArray(parsed.homework)
  )
}

function isUsablePracticePackage(parsed) {
  const scenario = parsed && parsed.scenario

  return Boolean(
    scenario &&
      typeof scenario === "object" &&
      typeof scenario.title === "string" &&
      scenario.title.trim() &&
      typeof scenario.situation === "string" &&
      scenario.situation.trim() &&
      Array.isArray(scenario.objectives) &&
      Array.isArray(scenario.coachTips) &&
      // A package with no homework or no quiz is not a deliverable — and is
      // exactly what the live run above produced.
      Array.isArray(parsed.homework) &&
      parsed.homework.length > 0 &&
      Array.isArray(parsed.quiz) &&
      parsed.quiz.length > 0
  )
}

/** Explains a valid-JSON-but-wrong-shape answer. Key *names* only — never text. */
function describeShapeFailure(parsed, contract) {
  const keys = parsed && typeof parsed === "object" ? Object.keys(parsed) : []

  return {
    reason: "bad_shape",
    parseError: `the JSON parsed but did not match the ${contract} contract (keys: ${
      keys.join(", ") || "none"
    })`,
  }
}

/** Mirrors the last attempt into the optional `debug` object used by /ai/probe. */
function finishAttempt(debug, attempts, parsed, diagnosis = null, usable = false) {
  if (!debug) return

  const result = attempts[attempts.length - 1]

  captureDebug(debug, result)
  debug.attempts = attempts.length
  debug.parsed = parsed
  debug.usable = Boolean(usable)
  debug.reason = diagnosis ? diagnosis.reason : null
  debug.parseError = diagnosis ? diagnosis.parseError : null
}

/**
 * One Groq call in JSON mode, then — only when the answer is unusable — one
 * temperature-0 corrective retry.
 *
 * Prompt-only JSON measured a ~25% failure rate on /generate/practice-package:
 * complete answers (`finish_reason: "stop"`) that were not valid JSON. JSON mode
 * removes the prose cases at the source and the single retry absorbs the rest.
 *
 * Returns `{ result, parsed, attempts, diagnosis }` where `result` is the *last*
 * attempt (so a Groq-level failure on the retry is still GROQ_ERROR) and
 * `parsed` is `null` unless the answer both parsed *and* satisfied `isValid`.
 */
async function generateJson(messages, env, temperature, options = {}) {
  const {
    debug = null,
    isValid = null,
    contract = "json",
    schema = null,
    schemaName = contract,
  } = options

  const accept = (value) => Boolean(value) && (isValid ? isValid(value) : true)

  /** Operator-selectable: "schema" | "json_object" | "off" — see GROQ_RESPONSE_FORMAT. */
  let responseFormat = resolveResponseFormat(env)

  let first = await callGroq(messages, env, {
    temperature,
    responseFormat,
    schema,
    schemaName,
  })
  const attempts = [first]

  /**
   * Strict schema mode is what forces every key — a live measurement showed JSON
   * Object mode letting the model stop after `homework` in 4 of 8 completions.
   *
   * Groq validates the generation *after* producing it, so a 400 here carries two
   * very different meanings and they must not be conflated:
   *  - "does not match the expected schema" — the model stopped early. That is
   *    retriable, and retrying *with* the schema is the point of strict mode
   *    (`failed_generation` names the missing properties);
   *  - anything else (invalid/unsupported schema) — the request itself is
   *    refused, so degrade to JSON Object mode rather than fail the route.
   */
  const SCHEMA_MISMATCH_400 =
    /does not match the expected schema|failed_generation/i

  let schemaMismatch = false

  if (
    !first.ok &&
    responseFormat === "schema" &&
    first.error &&
    first.error.status === 400
  ) {
    if (SCHEMA_MISMATCH_400.test(first.error.message || "")) {
      schemaMismatch = true

      console.warn(
        `Groq rejected the ${contract} generation against the schema (400: ${first.error.message}) — retrying with the schema`
      )
    } else {
      responseFormat = "json_object"

      console.warn(
        `Groq rejected the ${contract} JSON schema (400: ${first.error.message}) — falling back to json_object`
      )

      first = await callGroq(messages, env, { temperature, responseFormat })
      attempts.push(first)
    }
  }

  let parsed = first.ok ? extractJsonObject(stripMarkdown(first.content)) : null

  if (debug) debug.strategy = lastJsonStrategy

  if (!schemaMismatch && (accept(parsed) || !first.ok)) {
    finishAttempt(debug, attempts, parsed, null, accept(parsed))

    return {
      result: first,
      parsed: accept(parsed) ? parsed : null,
      attempts: attempts.length,
    }
  }

  const truncated = first.finishReason === "length"
  const diagnosis = schemaMismatch
    ? { reason: "schema_mismatch", parseError: first.error.message }
    : parsed
      ? describeShapeFailure(parsed, contract)
      : describeJsonFailure(first, first.content)

  console.warn(
    `Groq retry: ${diagnosis.reason} (contract=${contract}, model=${
      first.model
    }, finish_reason=${first.finishReason || "n/a"}, length=${String(
      first.content || ""
    ).length}) — retrying once at temperature 0`
  )

  const retry = await callGroq(
    [...messages, { role: "user", content: JSON_RETRY_INSTRUCTION }],
    env,
    {
      temperature: 0,
      responseFormat,
      ...(responseFormat === "schema" ? { schema, schemaName } : {}),
      maxCompletionTokens: truncated ? TRUNCATION_RETRY_MAX_TOKENS : null,
    }
  )

  attempts.push(retry)

  parsed = retry.ok ? extractJsonObject(stripMarkdown(retry.content)) : null

  if (debug) debug.strategy = lastJsonStrategy

  const usable = accept(parsed)

  let finalDiagnosis = null

  if (!usable) {
    if (parsed) {
      finalDiagnosis = describeShapeFailure(parsed, contract)
    } else if (retry.ok) {
      finalDiagnosis = describeJsonFailure(retry, retry.content)
    } else if (
      SCHEMA_MISMATCH_400.test((retry.error && retry.error.message) || "")
    ) {
      finalDiagnosis = {
        reason: "schema_mismatch",
        parseError: retry.error.message,
      }
    }
  }

  finishAttempt(debug, attempts, parsed, finalDiagnosis, usable)

  return {
    result: retry,
    parsed: usable ? parsed : null,
    attempts: attempts.length,
    truncated,
    diagnosis: finalDiagnosis,
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
      practice_package: fields.practice_package || null,
      modality: fields.modality || null,
      analysis: fields.analysis || null,
      created_at: new Date().toISOString(),
    }

    const res = await fetch(
      `${supabaseUrl}/session_versions`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      }
    )

    if (!res.ok) {
      throw new Error(await res.text())
    }
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