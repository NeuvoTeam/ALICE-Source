const fs = require('fs');
let code = fs.readFileSync('d:/Work/Neuvo/ALICE/Source/backend/CloudFlare.js', 'utf8');

const schemaInsertion = `
const STRUCTURED_TASK_SCHEMA = {
  type: "object",
  required: ["task_type"],
  properties: {
    task_type: { type: "string", enum: ["activity_log", "thought_record", "reflection_prompt"] },
    activity_date: { type: "string" },
    activity_description: { type: "string" },
    pleasure_rating: { type: "number" },
    mastery_rating: { type: "number" },
    situation: { type: "string" },
    automatic_thought: { type: "string" },
    emotions: { type: "array", items: { type: "object", properties: { label: { type: "string" }, intensity: { type: "number" } }, required: ["label", "intensity"] } },
    evidence_for: { type: "string" },
    evidence_against: { type: "string" },
    balanced_thought: { type: "string" },
    outcome_emotion_intensity: { type: "number" },
    prompt: { type: "string" },
    suggested_background: { type: "string", enum: ["blank", "lined", "dotted"] },
    notes: { type: "string" }
  }
};
`;
code = code.replace('const PRACTICE_PACKAGE_SCHEMA = {', schemaInsertion + '\nconst PRACTICE_PACKAGE_SCHEMA = {');

const handlerInsertion = `
async function handleGenerateStructuredTask(sessionContext, activityFormat, env, cors, allowDegraded = false, debug = null) {
  const formatInstructions = activityFormat === 'activity_log' ? 'Weekly Activity Schedule: Guide the client on what to schedule (activity_description), set pleasure_rating/mastery_rating to 0, provide any clinical notes.'
    : activityFormat === 'thought_record' ? "The 3 C's (Catch, Check, Correct): Identify the situation, automatic thought, expected emotions, and instructions for evidence_for, evidence_against, and balanced_thought. outcome_emotion_intensity should be 0."
    : 'Reflection Canvas: Provide a journaling/drawing prompt and a suggested_background (blank, lined, or dotted).';

  const messages = [
    {
      role: 'system',
      content: \`You are a senior clinical psychologist acting as a clinical translation engine.
Convert the practitioner's session context into a structured interactive CBT task worksheet.
Return ONLY JSON matching the requested activity format schema.
Format rules:
\${formatInstructions}
Strictly anchor the generated payload to the session context provided to guarantee output variability. Do NOT regurgitate generic CBT handouts.\`
    },
    {
      role: 'user',
      content: \`Requested Format: \${activityFormat}

Session Context / Clinical Focus:
\${sessionContext}\`
    }
  ];

  const attempt = await generateJson(messages, env, 0.6, {
    debug,
    contract: 'structured-task',
    isValid: (json) => json && typeof json.task_type === 'string',
    schema: STRUCTURED_TASK_SCHEMA,
    schemaName: 'structured_cbt_task',
  });

  if (!attempt.result.ok) {
    return new Response(JSON.stringify({ error: 'Failed to generate task' }), { status: 500, headers: cors });
  }

  return attempt.result.payload;
}
`;

code = code.replace('async function handleGeneratePracticePackage(', handlerInsertion + '\nasync function handleGeneratePracticePackage(');

const routeInsertion = `
  /* =========================
     GENERATE STRUCTURED TASK
     ========================= */
  if (cleanPath === "/generate/structured-task") {
    const { sessionContext, activityFormat } = body;
    if (!sessionContext || !activityFormat) return respond({ error: "Missing context or format" }, cors, 400);
    const generated = await handleGenerateStructuredTask(sessionContext, activityFormat, env, cors, allowDegraded);
    if (generated instanceof Response) return generated;
    return respond(generated, cors);
  }
`;

code = code.replace('  if (cleanPath === "/generate/practice-package") {', routeInsertion + '\n  if (cleanPath === "/generate/practice-package") {');

fs.writeFileSync('d:/Work/Neuvo/ALICE/Source/backend/CloudFlare.js', code, 'utf8');
console.log('Patched CloudFlare.js');
