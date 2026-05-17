export default {
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);
  
      // ✅ CONTEXT ENDPOINT (core AI system definition)
      if (url.pathname === "/context") {
        const context = {
          system: "ALICE mental health platform",
  
          purpose: "Clinical decision support and therapist assistance",
  
          modules: [
            "client management",
            "session notes",
            "assessments",
            "triage"
          ],
  
          supabase: {
            tables: [
              "clients",
              "sessions",
              "notes",
              "assessments"
            ]
          },
  
          constraints: [
            "trauma-informed language",
            "non-diagnostic unless explicitly requested",
            "escalate high-risk situations",
            "support clinician-led decisions"
          ]
        };
  
        return new Response(JSON.stringify(context), {
          headers: { "Content-Type": "application/json" }
        });
      }
  
      // ✅ TOOLS ENDPOINT (shared AI tool definitions)
      if (url.pathname === "/tools") {
        const tools = [
          {
            name: "get_client",
            description: "Fetch a client profile",
            input_schema: {
              type: "object",
              properties: {
                client_id: { type: "string" }
              }
            }
          },
          {
            name: "create_session_note",
            description: "Save a therapist session note",
            input_schema: {
              type: "object",
              properties: {
                client_id: { type: "string" },
                text: { type: "string" }
              }
            }
          }
        ];
  
        return new Response(JSON.stringify(tools), {
          headers: { "Content-Type": "application/json" }
        });
      }
  
      // ✅ HEALTH CHECK (base route)
      if (url.pathname === "/") {
        return new Response("ALICE MCP Gateway running");
      }
  
      // ✅ FALLBACK
      return new Response("Not Found", { status: 404 });
    }
  };