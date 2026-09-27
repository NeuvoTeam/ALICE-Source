const fs = require('fs');
let code = fs.readFileSync('d:/Work/Neuvo/ALICE/Source/lib/tasks.ts', 'utf8');

const toInsert = `
/** Input to generateStructuredTask */
export interface GenerateStructuredTaskInput {
  sessionContext: string;
  activityFormat: "activity_log" | "thought_record" | "reflection_prompt";
}

export async function generateStructuredTask(
  input: GenerateStructuredTaskInput
): Promise<FormData | { task_type: "reflection_prompt"; prompt: string; suggested_background: string; notes?: string }> {
  const res = await apiFetch(
    \`\${CLINICAL_AI_API_BASE}/generate/structured-task\`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionContext: input.sessionContext,
        activityFormat: input.activityFormat
      }),
    }
  );

  await assertOk(res, "generateStructuredTask");

  return (await res.json()) as any;
}
`;

code = code + '\n' + toInsert;
fs.writeFileSync('d:/Work/Neuvo/ALICE/Source/lib/tasks.ts', code, 'utf8');
console.log('Appended to tasks.ts');
