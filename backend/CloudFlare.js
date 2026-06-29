// @ts-nocheck
export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "");
    const method = request.method;

    console.log("REQUEST:", method, path);

    try {
      // ✅ Validate env
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
        return new Response(
          JSON.stringify({ error: "Missing Supabase env variables" }),
          { status: 500, headers: cors }
        );
      }

      const baseUrl = env.SUPABASE_URL.endsWith("/")
        ? env.SUPABASE_URL.slice(0, -1)
        : env.SUPABASE_URL;

      const SUPABASE_URL = `${baseUrl}/rest/v1`;

      const SUPABASE_KEY =
      env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    const HEADERS = {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    };

      /* =========================
         ✅ GET SESSION BY ID
         ========================= */
      if (method === "GET" && path.startsWith("/sessions/")) {
        const rawId = path.split("/")[2];

        // ✅ FIX: decode encoded IDs
        const id = decodeURIComponent(rawId);

        // ✅ Prevent invalid placeholders
        if (!id || id.includes("<") || id.includes("%")) {
          return respond({ error: "Invalid sessionId" }, cors, 400);
        }

        const res = await fetch(
          `${SUPABASE_URL}/sessions?id=eq.${id}&select=id,name,case_id`,
          { headers: HEADERS }
        );

        const text = await res.text();

        if (!res.ok) {
          console.error("SUPABASE ERROR:", text);
          throw new Error(text);
        }

        const data = JSON.parse(text);
        const row = data?.[0];

        if (!row) {
          return respond({ error: "Session not found" }, cors, 404);
        }

        // ✅ Clean safe output
        return respond(
          {
            id: row.id,
            name: row.name,
            caseId: row.case_id,
          },
          cors
        );
      }

      /* =========================
         ✅ GET CLIENTS
         ========================= */
      if (method === "GET" && path === "/clients") {
        const res = await fetch(
          `${SUPABASE_URL}/clients?select=id,name`,
          { headers: HEADERS }
        );

        const text = await res.text();

        if (!res.ok) {
          console.error("SUPABASE ERROR:", text);
          throw new Error(text);
        }

        const data = JSON.parse(text);

        return respond(
          (Array.isArray(data) ? data : []).map((c) => ({
            id: c.id,
            name: c.name || `Client ${c.id.slice(0, 6)}`,
          })),
          cors
        );
      }

      /* =========================
         ✅ CREATE SESSION
         ========================= */
      if (method === "POST" && path === "/sessions") {
        const body = await safeJson(request);

        if (!body?.caseId) {
          return respond({ error: "Missing caseId" }, cors, 400);
        }

        const res = await fetch(`${SUPABASE_URL}/sessions`, {
          method: "POST",
          headers: HEADERS,
          body: JSON.stringify({
            case_id: body.caseId,
            name: body.name || "Session",
          }),
        });

        const text = await res.text();

        if (!res.ok) {
          console.error("SUPABASE ERROR:", text);
          throw new Error(text);
        }

        const data = JSON.parse(text);

        return respond(data?.[0] || data, cors);
      }

      /* =========================
         ✅ DELETE SESSION
         ========================= */
      if (method === "DELETE" && path.startsWith("/sessions/")) {
        const rawId = path.split("/")[2];
        const id = decodeURIComponent(rawId);

        const res = await fetch(
          `${SUPABASE_URL}/sessions?id=eq.${id}`,
          {
            method: "DELETE",
            headers: HEADERS,
          }
        );

        if (!res.ok && res.status !== 204) {
          const text = await res.text();
          console.error("DELETE ERROR:", text);
          throw new Error(text);
        }

        return respond({ success: true }, cors);
      }

      return respond({ error: "Route not found" }, cors, 404);

    } catch (err) {
      console.error("FULL ERROR:", err);

      return new Response(
        JSON.stringify({
          error: err.message,
        }),
        {
          status: 500,
          headers: {
            ...cors,
            "Content-Type": "application/json",
          },
        }
      );
    }
  },
};

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
  });
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}