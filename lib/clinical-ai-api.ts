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

/**
 * Groq's on-demand tier for `openai/gpt-oss-20b` is capped at **8,000 tokens per
 * minute**, and the limiter reserves the *prompt* tokens — not
 * `max_completion_tokens`. Measured against the live Worker:
 *
 *   7,248-char note  -> 429 "Used 7285, Requested 2408"
 *  20,000-char note  -> 429 "Used 4658, Requested 4776"
 *  38,656-char note  -> 429 "Request too large ... Requested 9271" (never runs)
 *
 * `/analyze/session` and `/generate/practice-package` both send the same notes,
 * so a clinician's single click costs the prompt twice (plus one more call when
 * the JSON retry fires). The ceiling therefore belongs on the *input*: capping
 * the completion would not prevent a 429, it would only truncate the JSON.
 */
export const SESSION_NOTES_MAX_CHARS = 18000;
export const SESSION_NOTES_WARN_CHARS = 8000;

/** Explains the ceiling to the clinician without leaking internals. */
export const GROQ_TPM_LIMIT_NOTE =
  "Groq's 8,000 tokens/minute limit is already close: the notes are sent twice (analysis, then practice package).";

/**
 * 3.5 characters per token is deliberately pessimistic — the measured ratio on
 * repeated prose was 4.2 — so real clinical text is over-estimated, never under.
 */
export function estimateTokens(chars: number): number {
  return Math.ceil(Math.max(0, chars) / 3.5);
}
