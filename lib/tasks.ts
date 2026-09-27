/**
 * lib/tasks.ts
 *
 * Next.js server-action wrappers for the practice-task submission domain.
 *
 * ─── Architecture ───────────────────────────────────────────────────────────
 *   Browser → (apiFetch / authHeaders) → Cloudflare Worker → Supabase
 *
 * This file NEVER touches Supabase directly. All requests go through the
 * Cloudflare Worker at CLINICAL_AI_API_BASE (lib/clinical-ai-api.ts).
 * lib/supabase.ts is a deliberate throwing proxy — do not import it here.
 *
 * ─── Server-action convention ───────────────────────────────────────────────
 * Every exported function is marked `"use server"` so Next.js bundles it only
 * on the server edge. Bearer tokens are forwarded by apiFetch (lib/auth.ts)
 * using the token stored in localStorage on the client; on the server edge
 * the caller must pass the token explicitly via the `Authorization` header
 * forwarded in the fetch init.
 *
 * ─── Normalisation ──────────────────────────────────────────────────────────
 * snake_case DB rows → camelCase app state happens only here.
 * ────────────────────────────────────────────────────────────────────────────
 */

"use server";

import { apiFetch } from "@/lib/auth";
import { CLINICAL_AI_API_BASE } from "@/lib/clinical-ai-api";
import type {
  UpsertTaskDraftInput,
  CommitTaskInput,
  InsertPractitionerNoteInput,
  NormalisedSubmission,
  NormalisedReflection,
  NormalisedPractitionerNote,
  NormalisedAuditLogEntry,
  SubmissionBundle,
  PracticeTaskSubmissionRow,
  ClientReflectionRow,
  SubmissionPractitionerNoteRow,
  StatusAuditLogRow,
  WorkerError,
  UUID,
} from "@/types/tasks";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Throw a descriptive error when the Worker returns a non-2xx response. */
async function assertOk(res: Response, context: string): Promise<void> {
  if (res.ok) return;

  let body: WorkerError | null = null;

  try {
    body = (await res.json()) as WorkerError;
  } catch {
    // body unreadable — use status text
  }

  const detail = body?.detail ?? body?.error ?? res.statusText;
  throw new Error(`[tasks/${context}] ${res.status}: ${detail}`);
}

// ---------------------------------------------------------------------------
// Normalisers — snake_case DB rows → camelCase app state
// ---------------------------------------------------------------------------

function normalizeSubmission(
  row: PracticeTaskSubmissionRow
): NormalisedSubmission {
  return {
    id: row.id,
    clientId: row.client_id,
    practitionerId: row.practitioner_id,
    taskType: row.task_type,
    formData: row.form_data,
    status: row.status,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeReflection(row: ClientReflectionRow): NormalisedReflection {
  return {
    id: row.id,
    submissionId: row.submission_id,
    clientId: row.client_id,
    canvasData: row.canvas_data,
    imageUrl: row.image_url,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function normalizeNote(
  row: SubmissionPractitionerNoteRow
): NormalisedPractitionerNote {
  return {
    id: row.id,
    submissionId: row.submission_id,
    practitionerId: row.practitioner_id,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function normalizeAuditEntry(row: StatusAuditLogRow): NormalisedAuditLogEntry {
  return {
    id: row.id,
    submissionId: row.submission_id,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    changedByUserId: row.changed_by_user_id,
    changedAt: row.changed_at,
  };
}

// ---------------------------------------------------------------------------
// 1. Upsert a task draft
// ---------------------------------------------------------------------------

/**
 * Create or update a `draft` practice-task submission.
 *
 * - Omit `input.id` to create a new draft.
 * - Supply `input.id` to overwrite an existing draft (idempotent).
 *
 * The Worker route (`POST /tasks/submissions`) performs an INSERT … ON CONFLICT
 * DO UPDATE so this is safe to call on every auto-save keystroke.
 *
 * Returns the normalised submission after the upsert.
 *
 * @throws If the Worker returns a non-2xx status.
 */
export async function upsertTaskDraft(
  input: UpsertTaskDraftInput
): Promise<NormalisedSubmission> {
  const res = await apiFetch(`${CLINICAL_AI_API_BASE}/tasks/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: input.id ?? null,
      client_id: input.clientId,
      practitioner_id: input.practitionerId,
      task_type: input.taskType,
      form_data: input.formData,
      // status is always `draft` for upserts — the Worker enforces this
    }),
  });

  await assertOk(res, "upsertTaskDraft");

  const row = (await res.json()) as PracticeTaskSubmissionRow;
  return normalizeSubmission(row);
}

// ---------------------------------------------------------------------------
// 2. Commit a task to 'pending_practitioner_review'
// ---------------------------------------------------------------------------

/**
 * Transition a submission from `draft` → `pending_practitioner_review`.
 *
 * The Worker validates that the caller owns the submission and that the
 * current status is `draft` before writing. A status-audit-log row is
 * created atomically by the Worker.
 *
 * Returns the normalised submission with updated `status` and `updatedAt`.
 *
 * @throws If the submission is not in `draft` state, if the caller lacks
 *         access, or if the Worker returns a non-2xx status.
 */
export async function commitTaskForReview(
  input: CommitTaskInput
): Promise<NormalisedSubmission> {
  const res = await apiFetch(
    `${CLINICAL_AI_API_BASE}/tasks/submissions/${encodeURIComponent(input.submissionId)}/commit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );

  await assertOk(res, "commitTaskForReview");

  const row = (await res.json()) as PracticeTaskSubmissionRow;
  return normalizeSubmission(row);
}

// ---------------------------------------------------------------------------
// 3. Fetch the full submission bundle for practitioner review
// ---------------------------------------------------------------------------

/**
 * Load a full review bundle: submission + client reflections + practitioner
 * notes, in one round-trip to the Worker.
 *
 * The Worker validates that the authenticated practitioner has access to
 * the owning client before returning any data (no PII leak).
 *
 * @param submissionId UUID of the submission to load.
 * @returns `SubmissionBundle` with all related records normalised.
 *
 * @throws If the submission is not found, the caller lacks access, or the
 *         Worker returns a non-2xx status.
 */
export async function fetchSubmissionBundle(
  submissionId: UUID
): Promise<SubmissionBundle> {
  const res = await apiFetch(
    `${CLINICAL_AI_API_BASE}/tasks/submissions/${encodeURIComponent(submissionId)}/bundle`,
    { method: "GET" }
  );

  await assertOk(res, "fetchSubmissionBundle");

  const data = (await res.json()) as {
    submission: PracticeTaskSubmissionRow;
    reflections: ClientReflectionRow[];
    practitioner_notes: SubmissionPractitionerNoteRow[];
    audit_log: StatusAuditLogRow[];
  };

  return {
    submission: normalizeSubmission(data.submission),
    reflections: data.reflections.map(normalizeReflection),
    practitionerNotes: data.practitioner_notes.map(normalizeNote),
    auditLog: (data.audit_log ?? []).map(normalizeAuditEntry),
  };
}

// ---------------------------------------------------------------------------
// 4. Insert a practitioner note
// ---------------------------------------------------------------------------

/**
 * Append a practitioner note to a submission.
 *
 * Notes are append-only (no update/delete) so every version is preserved for
 * the clinical record. The Worker validates that the practitioner has access
 * to the submission's owning client before inserting.
 *
 * Returns the newly created note, normalised.
 *
 * @throws If the caller lacks access or the Worker returns a non-2xx status.
 */
export async function insertPractitionerNote(
  input: InsertPractitionerNoteInput
): Promise<NormalisedPractitionerNote> {
  const res = await apiFetch(
    `${CLINICAL_AI_API_BASE}/tasks/submissions/${encodeURIComponent(input.submissionId)}/notes`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        practitioner_id: input.practitionerId,
        notes: input.notes,
      }),
    }
  );

  await assertOk(res, "insertPractitionerNote");

  const row = (await res.json()) as SubmissionPractitionerNoteRow;
  return normalizeNote(row);
}


/** Input to generateStructuredTask */
export interface GenerateStructuredTaskInput {
  sessionContext: string;
  activityFormat: "activity_log" | "thought_record" | "reflection_prompt";
}

export async function generateStructuredTask(
  input: GenerateStructuredTaskInput
): Promise<FormData | { task_type: "reflection_prompt"; prompt: string; suggested_background: string; notes?: string }> {
  const res = await apiFetch(
    `${CLINICAL_AI_API_BASE}/generate/structured-task`,
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
