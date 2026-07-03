/**
 * ✅ ALL frontend requests go through Cloudflare Worker
 * ✅ NO environment variables
 * ✅ Single source of truth for API routing
 */
export const CLINICAL_AI_API_BASE =
  "https://clinical-ai-backend.neuvoteam.workers.dev";

if (!CLINICAL_AI_API_BASE.startsWith("https://")) {
  throw new Error(
    "CLINICAL_AI_API_BASE must be an absolute https URL"
  );
}
