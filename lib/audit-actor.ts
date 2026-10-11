/**
 * lib/audit-actor.ts
 *
 * Safe display formatting for status_audit_log actor IDs.
 *
 * Clinical Governance / Attribution:
 * A null or missing actor in status_audit_log must NEVER be attributed to
 * "the client, via their practice link" or any specific role, because trigger-
 * authored rows or service-role Worker actions may leave changed_by_user_id
 * null for clinician actions as well.
 *
 * A null, undefined, or empty actor ID renders a strictly neutral fallback label:
 * "unknown actor".
 */

export const UNKNOWN_ACTOR_LABEL = "unknown actor";

/**
 * Returns a short truncated ID (first 8 characters followed by an ellipsis),
 * or the neutral "unknown actor" label if the id is null, undefined, empty, or whitespace.
 */
export function fmtAuditActor(id: string | null | undefined): string {
  if (!id || !id.trim()) {
    return UNKNOWN_ACTOR_LABEL;
  }
  return id.slice(0, 8) + "…";
}
