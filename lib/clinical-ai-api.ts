/** Clinical AI Worker URL; override with NEXT_PUBLIC_CLINICAL_AI_API_BASE for staging/local. */
export const CLINICAL_AI_API_BASE =
  process.env.NEXT_PUBLIC_CLINICAL_AI_API_BASE ??
  "https://clinical-ai-backend.neuvoteam.workers.dev"
