/**
 * types/tasks.ts
 *
 * Strict TypeScript interfaces for the practice-task submission domain.
 *
 * Naming conventions (per AGENTS.md):
 *   - snake_case  → DB column names / wire format from the Worker
 *   - camelCase   → normalised app state (see normalizers below)
 *
 * All timestamps arrive as ISO-8601 strings from the JSON wire format.
 *
 * TGA / SaMD boundary: these types describe data structures only.
 * No diagnostic inference or autonomous outcome scoring is represented here.
 */

// ---------------------------------------------------------------------------
// 1. Shared primitives
// ---------------------------------------------------------------------------

/** UUID v4 string — the PK type for every table in this domain. */
export type UUID = string;

/** ISO-8601 datetime string, always UTC. */
export type ISODateTime = string;

// ---------------------------------------------------------------------------
// 2. Submission status — discriminated union keeps transitions auditable
// ---------------------------------------------------------------------------

export type TaskStatus =
  | "draft"
  | "pending_practitioner_review"
  | "reviewed"
  | "approved"
  | "revision_requested"
  | "archived";

// ---------------------------------------------------------------------------
// 3. JSONB column shapes
// ---------------------------------------------------------------------------

/**
 * `form_data` column on `practice_task_submissions`.
 *
 * The structure varies by `task_type`. Use a discriminated union so callers
 * get exhaustive type-checking when branching on `task_type`.
 *
 * Extend this union when new task types are added; never use `unknown` here.
 */
export type FormData =
  | ActivityLogFormData
  | ThoughtRecordFormData
  | BehaviouralExperimentFormData;

export interface ActivityLogFormData {
  task_type: "activity_log";
  /** ISO date of the recorded activity (YYYY-MM-DD). */
  activity_date: string;
  activity_description: string;
  pleasure_rating: number;       // 0–10
  mastery_rating: number;        // 0–10
  notes?: string;
}

export interface ThoughtRecordFormData {
  task_type: "thought_record";
  situation: string;
  automatic_thought: string;
  emotions: Array<{ label: string; intensity: number }>; // intensity 0–100
  evidence_for: string;
  evidence_against: string;
  balanced_thought: string;
  outcome_emotion_intensity: number; // 0–100
  notes?: string;
}

export interface BehaviouralExperimentFormData {
  task_type: "behavioural_experiment";
  hypothesis: string;
  experiment_description: string;
  predicted_outcome: string;
  actual_outcome: string;
  what_i_learned: string;
  notes?: string;
}

/**
 * `canvas_data` column on `client_reflections`.
 *
 * Freeform drawing canvas state (e.g. Fabric.js JSON export).
 * Typed as an opaque record to avoid over-constraining third-party formats.
 */
export interface CanvasData {
  version: string;
  objects: unknown[];
  background?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// 4. DB row interfaces — snake_case, matching wire format from the Worker
// ---------------------------------------------------------------------------

/**
 * Row from `practice_task_submissions`.
 *
 * `form_data` is typed as `FormData` — callers must branch on
 * `row.form_data.task_type` to access task-specific fields.
 */
export interface PracticeTaskSubmissionRow {
  id: UUID;
  client_id: UUID;
  practitioner_id: UUID;
  /** Discriminant for `form_data`. Must match `FormData["task_type"]`. */
  task_type: FormData["task_type"];
  form_data: FormData;
  status: TaskStatus;
  reviewed_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

/** Row from `submission_practitioner_notes`. */
export interface SubmissionPractitionerNoteRow {
  id: UUID;
  submission_id: UUID;
  practitioner_id: UUID;
  notes: string;
  created_at: ISODateTime;
}

/** Row from `client_reflections`. */
export interface ClientReflectionRow {
  id: UUID;
  submission_id: UUID;
  client_id: UUID;
  canvas_data: CanvasData | null;
  image_url: string | null;
  notes: string | null;
  created_at: ISODateTime;
}

/** Row from `status_audit_log`. */
export interface StatusAuditLogRow {
  id: UUID;
  submission_id: UUID;
  previous_status: TaskStatus;
  new_status: TaskStatus;
  changed_by_user_id: UUID;
  changed_at: ISODateTime;
}

// ---------------------------------------------------------------------------
// 5. Composite / normalised types (camelCase) used in app state
// ---------------------------------------------------------------------------

/**
 * Full submission bundle returned by `fetchSubmissionBundle`.
 *
 * Assembles one submission with all its related reflections and practitioner
 * notes into a single read-model for the practitioner review screen.
 */
export interface SubmissionBundle {
  submission: NormalisedSubmission;
  reflections: NormalisedReflection[];
  practitionerNotes: NormalisedPractitionerNote[];
  /** Full chronological status-change history from status_audit_log. */
  auditLog: NormalisedAuditLogEntry[];
}

/** Normalised (camelCase) practiceTaskSubmission for app state. */
export interface NormalisedSubmission {
  id: UUID;
  clientId: UUID;
  practitionerId: UUID;
  taskType: FormData["task_type"];
  formData: FormData;
  status: TaskStatus;
  reviewedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Normalised (camelCase) clientReflection for app state. */
export interface NormalisedReflection {
  id: UUID;
  submissionId: UUID;
  clientId: UUID;
  canvasData: CanvasData | null;
  imageUrl: string | null;
  notes: string | null;
  createdAt: ISODateTime;
}

/** Normalised (camelCase) practitionerNote for app state. */
export interface NormalisedPractitionerNote {
  id: UUID;
  submissionId: UUID;
  practitionerId: UUID;
  notes: string;
  createdAt: ISODateTime;
}

/** Normalised (camelCase) status_audit_log entry for app state. */
export interface NormalisedAuditLogEntry {
  id: UUID;
  submissionId: UUID;
  previousStatus: TaskStatus;
  newStatus: TaskStatus;
  changedByUserId: UUID;
  changedAt: ISODateTime;
}

// ---------------------------------------------------------------------------
// 6. Request / response shapes for lib/tasks.ts actions
// ---------------------------------------------------------------------------

/** Input to `upsertTaskDraft`. `id` is omitted for new drafts. */
export interface UpsertTaskDraftInput {
  id?: UUID;
  clientId: UUID;
  practitionerId: UUID;
  taskType: FormData["task_type"];
  formData: FormData;
}

/** Input to `commitTaskForReview`. */
export interface CommitTaskInput {
  submissionId: UUID;
}

/** Input to `insertPractitionerNote`. */
export interface InsertPractitionerNoteInput {
  submissionId: UUID;
  practitionerId: UUID;
  notes: string;
}

/** Generic API error envelope from the Worker. */
export interface WorkerError {
  error: string;
  detail?: string;
}
