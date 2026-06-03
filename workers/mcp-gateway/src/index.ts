export default {
  async fetch(req: Request, env: any): Promise<Response> {
    const url = new URL(req.url);

    /* =========================
       ✅ DEBUG ROUTE (SAFE)
       ========================= */
    if (url.pathname === "/debug") {
      try {
        const res = await env.BACKEND.fetch(
          new Request("https://backend/clients")
        );

        const text = await res.text();

        return new Response(text, {
          headers: { "Content-Type": "application/json" }
        });

      } catch (err: any) {
        return json({
          error: "Debug failed",
          message: err?.message
        }, 500);
      }
    }

    /* =========================
       ✅ MCP CONTEXT
       ========================= */
    if (url.pathname === "/context") {
      return json({
        system: "ALICE mental health platform",
        modules: [
          "client management",
          "cases",
          "sessions",
          "analysis",
          "vignettes"
        ],
        tools: [
          "get_client_tree",
          "get_client",
          "create_case",
          "create_session",
          "delete_case",
          "delete_session",
          "analyze_session",
          "generate_vignette"
        ]
      });
    }

    /* =========================
       ✅ TOOLS
       ========================= */
    if (url.pathname === "/tools") {
      return json([
        { name: "get_client_tree" },
        { name: "get_client" },
        { name: "create_case" },
        { name: "create_session" },
        { name: "delete_case" },
        { name: "delete_session" },
        { name: "analyze_session" },
        { name: "generate_vignette" }
      ]);
    }

    /* =========================
       ✅ TOOL EXECUTION (FINAL)
       ========================= */
    if (url.pathname === "/tools/run" && req.method === "POST") {
      try {
        const body = await req.json();
        const { tool, input } = body;

        // ✅ helper for calling backend
        const callBackend = async (path: string, options: any = {}) => {
          const res = await env.BACKEND.fetch(
            new Request(`https://backend${path}`, {
              method: options.method || "GET",
              headers: {
                "Content-Type": "application/json"
              },
              body: options.body ? JSON.stringify(options.body) : undefined
            })
          );

          const text = await res.text();

          return new Response(text, {
            headers: { "Content-Type": "application/json" }
          });
        };

        // ✅ GET CLIENT TREE
        if (tool === "get_client_tree") {
          return await callBackend("/clients");
        }

        // ✅ GET CLIENT
        if (tool === "get_client") {
          return await callBackend(`/client/${input.client_id}`);
        }

        // ✅ CREATE CASE
        if (tool === "create_case") {
          return await callBackend("/cases", {
            method: "POST",
            body: { clientId: input.client_id }
          });
        }

        // ✅ CREATE SESSION
        if (tool === "create_session") {
          return await callBackend("/sessions", {
            method: "POST",
            body: { caseId: input.case_id }
          });
        }

        // ✅ DELETE CASE
        if (tool === "delete_case") {
          return await callBackend(`/cases/${input.case_id}`, {
            method: "DELETE"
          });
        }

        // ✅ DELETE SESSION
        if (tool === "delete_session") {
          return await callBackend(`/sessions/${input.session_id}`, {
            method: "DELETE"
          });
        }

        // ✅ ANALYZE SESSION
        if (tool === "analyze_session") {
          return await callBackend("/analyze/session", {
            method: "POST",
            body: { sessionNotes: input.text }
          });
        }

        // ✅ GENERATE VIGNETTE
        if (tool === "generate_vignette") {
          return await callBackend("/generate/vignette", {
            method: "POST",
            body: {
              sessionNotes: input.text,
              modality: input.modality || "cbt"
            }
          });
        }

        return json({ error: "Unknown tool" }, 400);

      } catch (err: any) {
        return json({
          error: "Execution failed",
          message: err?.message,
          stack: err?.stack
        }, 500);
      }
    }

    /* =========================
       ✅ HEALTH
       ========================= */
    if (url.pathname === "/") {
      return new Response("ALICE MCP Gateway running");
    }

    return new Response("Not Found", { status: 404 });
  }
};

/* =========================
   ✅ JSON HELPER
   ========================= */
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}