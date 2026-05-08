// @ts-nocheck

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.1-8b-instant";

export default {
  async fetch(request, env) {

    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // ✅ CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ✅ GET: latest session
    if (request.method === "GET" && path === "/latest-session") {
      return json({
        sessionNotes: "",
        lastUpdated: null,
      }, 200, cors);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, cors);
    }

    try {
      const body = await request.json().catch(() => null);

      if (!body || !body.sessionNotes) {
        return json({ error: "Missing sessionNotes" }, 400, cors);
      }

      if (path === "/analyze/session") {
        return await handleAnalyze(body.sessionNotes, env, cors);
      }

      if (path === "/generate/vignette") {
        const modality = body.verifiedModality || body.modality || "cbt";
        return await handleGenerate(body.sessionNotes, modality, env, cors);
      }

      return json({ error: "Route not found" }, 404, cors);

    } catch (err) {
      return json({ error: err.message }, 500, cors);
    }
  }
};



// ===============================
// ✅ ANALYZE (STRONG + SAFE)
// ===============================
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
  ];

  const raw = await callGroq(messages, env, 0.3);

  const cleaned = stripMarkdown(raw);
  const parsed = extractJsonObject(cleaned);

  return json({
    rationale: parsed?.rationale || "Clinical synthesis unavailable.",
    inferredModality: (parsed?.inferredModality || "CBT").toLowerCase(),
    riskFlags: parsed?.riskFlags || [],
  }, 200, cors);
}



// ===============================
// ✅ GENERATE (HIGH QUALITY)
// ===============================
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
  ];

  const raw = await callGroq(messages, env, 0.6);

  const cleaned = stripMarkdown(raw);
  const parsed = extractJsonObject(cleaned);

  return json({
    scenario: parsed?.scenario || "Scenario unavailable.",
    quiz: parsed?.quiz || [],
    homework: parsed?.homework || [],
  }, 200, cors);
}



// ===============================
// ✅ GROQ CALL (SAFE)
// ===============================
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
    });

    const text = await res.text();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }

    return parsed?.choices?.[0]?.message?.content || null;

  } catch (err) {
    console.error("Groq error:", err);
    return null;
  }
}



// ===============================
// ✅ CLEAN MARKDOWN
// ===============================
function stripMarkdown(text) {
  if (!text) return "";
  return text
    .replace(/```json[\s\S]*?```/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();
}



// ===============================
// ✅ SAFE JSON EXTRACTOR (KEY)
// ===============================
function extractJsonObject(text) {
  if (!text) return null;

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}



// ===============================
// ✅ RESPONSE HELPER
// ===============================
function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: {
      "Content-Type": "application/json",
      ...cors,
    },
  });
}
