export default {
  async fetch(req: Request, env: any): Promise<Response> {
    const url = new URL(req.url);

    // ✅ CONTEXT (AI system definition)
    if (url.pathname === "/context") {
      return new Response(JSON.stringify({
        system: "ALICE mental health platform",
        purpose: "Clinical decision support and therapist assistance",

        modules: [
          "client management",
          "session notes",
          "assessments",
          "triage"
        ],

        supabase: {
          tables: ["clients", "sessions", "notes", "assessments"]
        },

        constraints: [
          "trauma-informed language",
          "non-diagnostic unless explicitly requested",
          "escalate high-risk situations",
          "support clinician-led decisions"
        ]
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ✅ TOOLS (shared AI capabilities)
    if (url.pathname === "/tools") {
      return new Response(JSON.stringify([
        {
          name: "get_client",
          description: "Fetch client profile",
          endpoint: "/api/clients?id={client_id}"
        },
        {
          name: "create_session_note",
          description: "Save session note",
          endpoint: "/api/notes (POST)"
        }
      ]), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ✅ API: GET CLIENTS (with normalization)
    if (url.pathname.startsWith("/api/clients")) {
      const clientId = url.searchParams.get("id");

      let query = `${env.SUPABASE_URL}/rest/v1/clients`;

      // ✅ Only filter if valid UUID
      if (clientId && isValidUUID(clientId)) {
        query += `?id=eq.${clientId}`;
      }

      const res = await fetch(query, {
        headers: {
          "apikey": env.SUPABASE_KEY,
          "Authorization": `Bearer ${env.SUPABASE_KEY}`
        }
      });

      const data = await res.json();

      // ✅ ✅ NORMALIZATION (CORRECT LOCATION)
      const normalized = data.map((client: any) => ({
        id: client.id,
        name: client.full_name ?? client.name ?? "Unnamed Client",
        created_at: client.created_at,
        clinician_id: client.clinician_id
      }));

      return new Response(JSON.stringify(normalized), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // ✅ API: CREATE NOTE (no normalization — single object)
    if (url.pathname === "/api/notes" && req.method === "POST") {
      try {
        const body = await req.json();

        const res = await fetch(
          `${env.SUPABASE_URL}/rest/v1/notes`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": env.SUPABASE_KEY,
              "Authorization": `Bearer ${env.SUPABASE_KEY}`
            },
            body: JSON.stringify({
              client_id: body.client_id,
              text: body.text
            })
          }
        );

        const data = await res.json();

        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" }
        });

      } catch (err) {
        return new Response(JSON.stringify({
          error: "Invalid request body"
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // ✅ HEALTH CHECK
    if (url.pathname === "/") {
      return new Response("ALICE MCP Gateway running");
    }

    // ✅ FALLBACK
    return new Response("Not Found", { status: 404 });
  }
};

// ✅ HELPER: UUID validation
function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}