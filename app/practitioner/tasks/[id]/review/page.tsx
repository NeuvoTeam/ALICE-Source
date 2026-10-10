"use client";

/**
 * app/practitioner/tasks/[id]/review/page.tsx
 *
 * Practitioner Review Gateway for practice-task submissions.
 *
 * Architecture notes:
 * - Client component only - auth is token-in-localStorage (see lib/auth.ts).
 * - All data access goes through apiFetch -> Cloudflare Worker -> Supabase.
 *   lib/supabase.ts is a deliberate throwing proxy - never imported here.
 *
 * Clinical Governance:
 * - Approved records are strictly read-only (immutability lock).
 * - Practitioner notes write exclusively to submission_practitioner_notes.
 * - The Approve action calls POST /tasks/submissions/:id/approve which sets
 *   reviewed_at and triggers the Postgres immutability trigger on the DB.
 * - Human-approval confirmation dialog shown before final approve action.
 * - Audit log from status_audit_log surfaces the true reviewer identity,
 *   not a heuristic based on the last note.
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/auth";
import { CLINICAL_AI_API_BASE as API } from "@/lib/clinical-ai-api";
import AuthGuard from "@/components/auth-guard";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit3,
  FileText,
  History,
  ImageIcon,
  Loader2,
  Lock,
  MessageSquarePlus,
  RefreshCcw,
  Save,
  Send,
  ShieldCheck,
  User,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

import type {
  NormalisedSubmission,
  NormalisedReflection,
  NormalisedPractitionerNote,
  NormalisedAuditLogEntry,
  SubmissionBundle,
  TaskStatus,
  ActivityLogFormData,
  ThoughtRecordFormData,
  BehaviouralExperimentFormData,
  PracticeTaskSubmissionRow,
  ClientReflectionRow,
  SubmissionPractitionerNoteRow,
  StatusAuditLogRow,
  UUID,
} from "@/types/tasks";

// ---------------------------------------------------------------------------
// Weekly-schedule types (mirror of ActivityScheduleForm.tsx - read-only)
// ---------------------------------------------------------------------------

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Day = (typeof DAYS)[number];

interface TimeBlock {
  activity: string;
  moodRating: number;
}

type WeeklySchedule = Record<Day, Record<string, TimeBlock>>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TASK_LABELS: Record<string, string> = {
  activity_log: "Weekly Activity Schedule",
  thought_record: "The 3 C's Worksheet",
  behavioural_experiment: "Behavioural Experiment",
};

// ---------------------------------------------------------------------------
// Normalisation helpers (same contract as lib/tasks.ts but runs client-side)
// ---------------------------------------------------------------------------

function normalizeSubmission(row: PracticeTaskSubmissionRow): NormalisedSubmission {
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

function normalizeNote(row: SubmissionPractitionerNoteRow): NormalisedPractitionerNote {
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
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function fmtShortId(id: string): string {
  return id.slice(0, 8) + "…";
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<TaskStatus, { label: string; cls: string }> = {
  draft: {
    label: "Draft",
    cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  pending_practitioner_review: {
    label: "Pending Review",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  },
  reviewed: {
    label: "Reviewed",
    cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300",
  },
  approved: {
    label: "Approved & Locked",
    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  revision_requested: {
    label: "Revision Requested",
    cls: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300",
  },
  archived: {
    label: "Archived",
    cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500",
  },
};

function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        cfg.cls
      )}
    >
      {status === "approved" && <Lock className="h-3 w-3" />}
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// AuditStrip — metadata bar sourced from status_audit_log
// ---------------------------------------------------------------------------

interface AuditStripProps {
  submission: NormalisedSubmission;
  auditLog: NormalisedAuditLogEntry[];
}

function AuditStrip({ submission, auditLog }: AuditStripProps) {
  // Source reviewer identity from the real audit table, not heuristic
  const approveEntry = auditLog.find((e) => e.newStatus === "approved");

  const items: Array<{ icon: React.ReactNode; label: string; value: string }> = [
    {
      icon: <Clock className="h-3.5 w-3.5" />,
      label: "Submitted",
      value: fmtDate(submission.createdAt),
    },
    {
      icon: <User className="h-3.5 w-3.5" />,
      label: "Client ID",
      value: fmtShortId(submission.clientId),
    },
    {
      icon: <FileText className="h-3.5 w-3.5" />,
      label: "Submission ID",
      value: fmtShortId(submission.id),
    },
  ];

  if (submission.reviewedAt || approveEntry) {
    items.push({
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />,
      label: "Approved at",
      value: fmtDate(approveEntry?.changedAt ?? submission.reviewedAt),
    });
  }

  if (approveEntry) {
    items.push({
      icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />,
      label: "Reviewer ID",
      value: fmtShortId(approveEntry.changedByUserId),
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-muted/40 px-4 py-3">
      {items.map(({ icon, label, value }) => (
        <div key={label} className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-muted-foreground">{label}:</span>
          <span className="font-medium text-foreground font-mono">{value}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImmutabilityBanner
// ---------------------------------------------------------------------------

function ImmutabilityBanner() {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/40"
    >
      <Lock className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
      <div>
        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
          Locked Clinical Record — Approved &amp; Integrated
        </p>
        <p className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-300/70">
          This record has been approved and written to the clinical file. The Postgres
          immutability trigger prevents any further edits at the database level.
          This view is strictly read-only.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuditLogPanel — chronological status history from status_audit_log
// ---------------------------------------------------------------------------

function AuditLogPanel({ auditLog }: { auditLog: NormalisedAuditLogEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!auditLog.length) return null;

  const visible = expanded ? auditLog : auditLog.slice(-3);

  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Status History
          </CardTitle>
          {auditLog.length > 3 && (
            <button
              type="button"
              onClick={() => setExpanded((p) => !p)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <><ChevronUp className="h-3.5 w-3.5" />Show less</>
              ) : (
                <><ChevronDown className="h-3.5 w-3.5" />{auditLog.length - 3} more</>
              )}
            </button>
          )}
        </div>
        <CardDescription className="text-xs">
          Sourced from{" "}
          <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded-sm">
            status_audit_log
          </code>
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ol className="relative ml-3 border-l border-border space-y-4">
          {visible.map((entry) => {
            const prevCfg = STATUS_CONFIG[entry.previousStatus] ?? STATUS_CONFIG.draft;
            const newCfg  = STATUS_CONFIG[entry.newStatus]      ?? STATUS_CONFIG.draft;
            return (
              <li key={entry.id} className="pl-5 relative">
                <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn("rounded-full px-2 py-0.5 font-medium", prevCfg.cls)}>
                    {prevCfg.label}
                  </span>
                  <span className="text-muted-foreground">to</span>
                  <span className={cn("rounded-full px-2 py-0.5 font-medium", newCfg.cls)}>
                    {newCfg.label}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground font-mono">
                  {fmtDate(entry.changedAt)} · by {fmtShortId(entry.changedByUserId)}
                </p>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// LabelEditor — inline practitioner relabelling
// ---------------------------------------------------------------------------

interface LabelEditorProps {
  submissionId: UUID;
  currentLabel: string;
  defaultLabel: string;
  readOnly: boolean;
  onSaved: (newLabel: string) => void;
}

function LabelEditor({
  submissionId,
  currentLabel,
  defaultLabel,
  readOnly,
  onSaved,
}: LabelEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(currentLabel || defaultLabel);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    if (readOnly) return;
    setDraft(currentLabel || defaultLabel);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 10);
  }

  async function save() {
    if (!draft.trim() || draft.trim() === (currentLabel || defaultLabel)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(
        `${API}/tasks/submissions/${encodeURIComponent(submissionId)}/label`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: draft.trim() }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      onSaved(draft.trim());
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          maxLength={200}
          className={cn(
            "flex-1 rounded-md border border-primary/50 bg-background px-3 py-1.5 text-sm font-semibold",
            "focus:outline-none focus:ring-2 focus:ring-ring/40"
          )}
        />
        <Button size="icon-sm" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => setEditing(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <h1 className="text-2xl font-bold tracking-tight">
        {currentLabel || defaultLabel}
      </h1>
      {!readOnly && (
        <button
          type="button"
          onClick={startEdit}
          title="Edit exercise label"
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Edit3 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Read-only CBT data renderers
// ---------------------------------------------------------------------------

function DataGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className="space-y-2">
      {items.map(({ label, value }) => (
        <div key={label} className="grid grid-cols-[160px_1fr] gap-x-3 text-sm">
          <dt className="text-muted-foreground font-medium text-right pt-0.5 truncate">{label}</dt>
          <dd className="text-foreground whitespace-pre-wrap">{value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function StepSection({
  step,
  label,
  colour,
  children,
}: {
  step: number;
  label: string;
  colour: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border p-4 space-y-3", colour)}>
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground/10 text-xs font-bold">
          {step}
        </span>
        <p className="text-sm font-semibold">{label}</p>
      </div>
      {children}
    </div>
  );
}

function moodColour(rating: number): string {
  if (rating >= 8) return "text-emerald-600 dark:text-emerald-400";
  if (rating >= 4) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

/**
 * Renders the WeeklySchedule stored by DynamicTaskForm as
 * JSON.stringify(schedule) in activity_description.
 */
function WeeklyScheduleGrid({ scheduleJson }: { scheduleJson: string }) {
  let schedule: WeeklySchedule | null = null;
  try {
    schedule = JSON.parse(scheduleJson) as WeeklySchedule;
  } catch {
    // not valid JSON
  }

  if (!schedule) {
    return <p className="text-sm text-foreground whitespace-pre-wrap">{scheduleJson}</p>;
  }

  const hasAnyActivity = DAYS.some((day) =>
    Object.values(schedule![day] ?? {}).some((b) => b.activity.trim())
  );

  if (!hasAnyActivity) {
    return <p className="text-sm text-muted-foreground italic">No activity entries recorded.</p>;
  }

  return (
    <div className="space-y-5">
      {DAYS.map((day) => {
        const slots = schedule![day] ?? {};
        const filled = Object.entries(slots).filter(([, v]) => v.activity.trim());
        if (!filled.length) return null;
        return (
          <div key={day}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {day}
            </p>
            <div className="space-y-1.5">
              {filled.map(([slot, val]) => (
                <div
                  key={slot}
                  className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm"
                >
                  <span className="w-24 shrink-0 text-xs text-muted-foreground pt-0.5 font-mono">
                    {slot}
                  </span>
                  <span className="flex-1 text-foreground">{val.activity}</span>
                  <span className={cn("shrink-0 text-xs font-bold tabular-nums", moodColour(val.moodRating))}>
                    {val.moodRating}/10
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityLogPanel({ data }: { data: ActivityLogFormData }) {
  // DynamicTaskForm stores JSON.stringify(WeeklySchedule) in activity_description
  const isWeeklyGrid =
    typeof data.activity_description === "string" &&
    data.activity_description.trimStart().startsWith("{");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" />
          Week of {data.activity_date}
        </span>
        {data.pleasure_rating != null && (
          <span>Avg pleasure: <strong className="text-foreground">{data.pleasure_rating}/10</strong></span>
        )}
        {data.mastery_rating != null && (
          <span>Avg mastery: <strong className="text-foreground">{data.mastery_rating}/10</strong></span>
        )}
      </div>
      {isWeeklyGrid ? (
        <WeeklyScheduleGrid scheduleJson={data.activity_description} />
      ) : (
        <DataGrid
          items={[
            { label: "Activity", value: data.activity_description ?? "—" },
            { label: "Pleasure rating", value: `${data.pleasure_rating ?? "—"} / 10` },
            { label: "Mastery rating", value: `${data.mastery_rating ?? "—"} / 10` },
            ...(data.notes ? [{ label: "Notes", value: data.notes }] : []),
          ]}
        />
      )}
    </div>
  );
}

function ThoughtRecordPanel({ data }: { data: ThoughtRecordFormData }) {
  return (
    <div className="space-y-6">
      <StepSection
        step={1}
        label="Catch It"
        colour="bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800"
      >
        <DataGrid
          items={[
            { label: "Situation", value: data.situation },
            { label: "Automatic thought", value: data.automatic_thought },
          ]}
        />
        {data.emotions.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Emotions</p>
            <div className="flex flex-wrap gap-2">
              {data.emotions.map((e, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-full bg-violet-100 dark:bg-violet-900/40 px-3 py-1"
                >
                  <span className="text-xs font-medium">{e.label || "—"}</span>
                  <span className="text-[10px] text-muted-foreground">{e.intensity}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </StepSection>

      <StepSection
        step={2}
        label="Check It"
        colour="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
      >
        <DataGrid
          items={[
            { label: "Evidence for", value: data.evidence_for },
            { label: "Evidence against", value: data.evidence_against },
          ]}
        />
      </StepSection>

      <StepSection
        step={3}
        label="Correct It"
        colour="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
      >
        <DataGrid
          items={[
            { label: "Balanced thought", value: data.balanced_thought },
            {
              label: "Outcome emotion intensity",
              value: `${data.outcome_emotion_intensity}%`,
            },
            ...(data.notes ? [{ label: "Notes", value: data.notes }] : []),
          ]}
        />
      </StepSection>
    </div>
  );
}

function BehaviouralExperimentPanel({ data }: { data: BehaviouralExperimentFormData }) {
  return (
    <DataGrid
      items={[
        { label: "Hypothesis", value: data.hypothesis },
        { label: "Experiment", value: data.experiment_description },
        { label: "Predicted outcome", value: data.predicted_outcome },
        { label: "Actual outcome", value: data.actual_outcome },
        { label: "What I learned", value: data.what_i_learned },
        ...(data.notes ? [{ label: "Notes", value: data.notes }] : []),
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// StructuredDataPanel — full type narrowing via discriminated union
// ---------------------------------------------------------------------------

function StructuredDataPanel({ submission }: { submission: NormalisedSubmission }) {
  const fd = submission.formData;
  return (
    <Card className="h-full">
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Structured CBT Data
        </CardTitle>
        <CardDescription className="text-xs">
          {TASK_LABELS[submission.taskType] ?? submission.taskType}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5 overflow-auto">
        {fd.task_type === "activity_log" && <ActivityLogPanel data={fd} />}
        {fd.task_type === "thought_record" && <ThoughtRecordPanel data={fd} />}
        {fd.task_type === "behavioural_experiment" && <BehaviouralExperimentPanel data={fd} />}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ReflectionPanel — canvas images from client_reflections
// ---------------------------------------------------------------------------

function ReflectionPanel({ reflections }: { reflections: NormalisedReflection[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!reflections.length) {
    return (
      <Card className="h-full">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            Canvas Reflections
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">No canvas reflections submitted</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-primary" />
          Canvas Reflections
        </CardTitle>
        <CardDescription className="text-xs">
          {reflections.length} image{reflections.length !== 1 ? "s" : ""} submitted
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5 space-y-4 overflow-auto">
        {reflections.map((r) => (
          <div key={r.id} className="space-y-2">
            {r.imageUrl ? (
              <div className="relative overflow-hidden rounded-xl border border-border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.imageUrl}
                  alt="Client canvas reflection"
                  className={cn(
                    "w-full object-contain transition-all duration-300",
                    expanded === r.id ? "max-h-none" : "max-h-64"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => (prev === r.id ? null : r.id))}
                  className="absolute bottom-2 right-2 flex items-center gap-1 rounded-sm bg-black/60 px-2.5 py-1 text-[11px] text-white backdrop-blur-sm"
                >
                  {expanded === r.id ? (
                    <><ChevronUp className="h-3 w-3" /> Collapse</>
                  ) : (
                    <><ChevronDown className="h-3 w-3" /> Expand</>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border">
                <p className="text-xs text-muted-foreground">No image available</p>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{fmtDate(r.createdAt)}</span>
              {r.notes && <span className="italic max-w-xs truncate">{r.notes}</span>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// PractitionerNotesPanel — append-only, isolated to submission_practitioner_notes
// ---------------------------------------------------------------------------

interface PractitionerNotesPanelProps {
  submissionId: UUID;
  notes: NormalisedPractitionerNote[];
  readOnly: boolean;
  onNoteAdded: (note: NormalisedPractitionerNote) => void;
}

function PractitionerNotesPanel({
  submissionId,
  notes,
  readOnly,
  onNoteAdded,
}: PractitionerNotesPanelProps) {
  const [draft, setDraft]   = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function handleSave() {
    if (!draft.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(
        `${API}/tasks/submissions/${encodeURIComponent(submissionId)}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: draft.trim() }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const row = await res.json() as SubmissionPractitionerNoteRow;
      onNoteAdded({
        id: row.id,
        submissionId: row.submission_id,
        practitionerId: row.practitioner_id,
        notes: row.notes,
        createdAt: row.created_at,
      });
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquarePlus className="h-4 w-4 text-primary" />
          Clinical Notes
          {readOnly && <Lock className="h-3.5 w-3.5 text-muted-foreground ml-1" />}
        </CardTitle>
        <CardDescription className="text-xs">
          Notes are append-only and stored exclusively in{" "}
          <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded-sm">
            submission_practitioner_notes
          </code>
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5 space-y-4">
        {notes.length > 0 ? (
          <div className="space-y-3">
            {notes.map((n) => (
              <div
                key={n.id}
                className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm"
              >
                <p className="whitespace-pre-wrap text-foreground">{n.notes}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground font-mono">
                  {fmtDate(n.createdAt)} · {fmtShortId(n.practitionerId)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No clinical notes yet.</p>
        )}

        {!readOnly && (
          <>
            <Separator />
            <div className="space-y-2">
              <Textarea
                id="practitioner-note-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add a clinical note…"
                rows={4}
                className="resize-none text-sm"
                disabled={saving}
              />
              {error && (
                <p className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {error}
                </p>
              )}
              <div className="flex justify-end">
                <Button
                  id="save-note-btn"
                  size="sm"
                  onClick={handleSave}
                  disabled={!draft.trim() || saving}
                  className="gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Save note
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ApproveDialog — mandatory checkbox human-approval gate (TGA / SaMD)
// ---------------------------------------------------------------------------

interface ApproveDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function ApproveDialog({ onConfirm, onCancel, isLoading }: ApproveDialogProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-dialog-title"
        className={cn(
          "relative w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl",
          "border-emerald-200 dark:border-emerald-900"
        )}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950">
            <ShieldCheck className="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <h2 id="approve-dialog-title" className="text-lg font-bold text-foreground">
              Approve &amp; Integrate to Record
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              This action is <strong className="text-foreground">irreversible</strong>.
              Once approved, the submission is locked at the database level by a
              Postgres immutability trigger. No further edits can be made.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 px-4 py-3">
          <label className="flex items-start gap-3 cursor-pointer text-sm">
            <input
              id="approve-agreement-checkbox"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded-xs accent-emerald-600"
            />
            <span className="text-emerald-900 dark:text-emerald-100">
              I have reviewed the client submission and reflections, and I confirm
              this record is accurate and ready for integration into the clinical file.
            </span>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            id="confirm-approve-btn"
            onClick={onConfirm}
            disabled={!agreed || isLoading}
            className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Approve &amp; Integrate
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RevisionDialog
// ---------------------------------------------------------------------------

interface RevisionDialogProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function RevisionDialog({ onConfirm, onCancel, isLoading }: RevisionDialogProps) {
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="revision-dialog-title"
        className="relative w-full max-w-lg rounded-xl border border-amber-200 bg-card p-6 shadow-xl dark:border-amber-900"
      >
        <h2 id="revision-dialog-title" className="mb-1.5 text-lg font-bold">
          Request Client Revision
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Optionally provide a brief reason for the revision. This will be saved as a
          clinical note visible to the reviewing practitioner.
        </p>
        <Textarea
          id="revision-reason-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Optional: describe what needs to be revised…"
          rows={4}
          className="resize-none text-sm"
          disabled={isLoading}
        />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            id="confirm-revision-btn"
            onClick={() => onConfirm(reason)}
            disabled={isLoading}
            variant="outline"
            className="gap-2 border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Send for revision
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DecisionBar — three actions; hidden when status is 'approved'
// ---------------------------------------------------------------------------

interface DecisionBarProps {
  status: TaskStatus;
  submissionId: UUID;
  onActionComplete: (updated: NormalisedSubmission) => void;
}

function DecisionBar({ status, submissionId, onActionComplete }: DecisionBarProps) {
  const [showApprove,  setShowApprove]  = useState(false);
  const [showRevision, setShowRevision] = useState(false);
  const [actionError,  setActionError]  = useState<string | null>(null);
  const [, startTransition]            = useTransition();
  const [isLoading,    setIsLoading]    = useState(false);

  const isPending = status === "pending_practitioner_review";

  async function handleApprove() {
    setActionError(null);
    setIsLoading(true);
    try {
      const res = await apiFetch(
        `${API}/tasks/submissions/${encodeURIComponent(submissionId)}/approve`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const row = await res.json() as PracticeTaskSubmissionRow;
      startTransition(() => { onActionComplete(normalizeSubmission(row)); });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setIsLoading(false);
      setShowApprove(false);
    }
  }

  async function handleRevision(reason: string) {
    setActionError(null);
    setIsLoading(true);
    try {
      const res = await apiFetch(
        `${API}/tasks/submissions/${encodeURIComponent(submissionId)}/request-revision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const row = await res.json() as PracticeTaskSubmissionRow;
      startTransition(() => { onActionComplete(normalizeSubmission(row)); });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Revision request failed");
    } finally {
      setIsLoading(false);
      setShowRevision(false);
    }
  }

  // Immutability lock active — hide all decision buttons
  if (status === "approved") return null;

  return (
    <>
      {showApprove && (
        <ApproveDialog
          onConfirm={handleApprove}
          onCancel={() => setShowApprove(false)}
          isLoading={isLoading}
        />
      )}
      {showRevision && (
        <RevisionDialog
          onConfirm={handleRevision}
          onCancel={() => setShowRevision(false)}
          isLoading={isLoading}
        />
      )}

      <div
        id="decision-bar"
        className="sticky bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur-sm py-4"
      >
        {actionError && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {actionError}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
          {/* Save Draft Notes — focuses note textarea, no status change */}
          <Button
            id="save-draft-btn"
            variant="outline"
            size="sm"
            disabled={isLoading || !isPending}
            onClick={() => {
              document
                .getElementById("practitioner-note-input")
                ?.focus({ preventScroll: false });
            }}
            className="gap-2 text-muted-foreground"
            title={
              !isPending
                ? "Only available for pending submissions"
                : "Focus the clinical notes field to add notes without changing submission status"
            }
          >
            <Save className="h-4 w-4" />
            Save Draft Notes
          </Button>

          {/* Request Client Revision */}
          <Button
            id="request-revision-btn"
            variant="outline"
            size="sm"
            disabled={isLoading || !isPending}
            onClick={() => setShowRevision(true)}
            className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
            title={!isPending ? "Only available for pending submissions" : undefined}
          >
            <RefreshCcw className="h-4 w-4" />
            Request Client Revision
          </Button>

          {/* Approve & Integrate to Record */}
          <Button
            id="approve-integrate-btn"
            size="sm"
            disabled={isLoading || !isPending}
            onClick={() => setShowApprove(true)}
            className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white dark:bg-emerald-800 dark:hover:bg-emerald-700"
            title={
              !isPending
                ? "Only available for pending submissions"
                : "Approve and lock this record into the clinical file"
            }
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Approve &amp; Integrate to Record
          </Button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ReviewPageInner — main page component
// ---------------------------------------------------------------------------

function ReviewPageInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const submissionId = params.id;

  const [bundle, setBundle]         = useState<SubmissionBundle | null>(null);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [localLabel, setLocalLabel] = useState<string>("");

  const fetchBundle = useCallback(async () => {
    setFetchError(null);
    setLoading(true);
    try {
      const res = await apiFetch(
        `${API}/tasks/submissions/${encodeURIComponent(submissionId)}/bundle`,
        { method: "GET" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const raw = await res.json() as {
        submission: PracticeTaskSubmissionRow;
        reflections: ClientReflectionRow[];
        practitioner_notes: SubmissionPractitionerNoteRow[];
        audit_log: StatusAuditLogRow[];
      };
      setBundle({
        submission: normalizeSubmission(raw.submission),
        reflections: raw.reflections.map(normalizeReflection),
        practitionerNotes: raw.practitioner_notes.map(normalizeNote),
        auditLog: (raw.audit_log ?? []).map(normalizeAuditEntry),
      });
      // Seed local label from form_data.label if previously set
      const fd = raw.submission.form_data as unknown as Record<string, unknown>;
      setLocalLabel(typeof fd.label === "string" ? fd.label : "");
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Failed to load submission");
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => { fetchBundle(); }, [fetchBundle]);

  const isLocked = bundle?.submission.status === "approved";
  const readOnly  = isLocked;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-muted-foreground">Loading submission…</span>
      </div>
    );
  }

  if (fetchError || !bundle) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-lg font-semibold">Could not load submission</p>
        <p className="text-sm text-muted-foreground max-w-sm text-center">
          {fetchError ?? "Unknown error"}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
          <Button onClick={fetchBundle}>Retry</Button>
        </div>
      </div>
    );
  }

  const { submission, reflections, practitionerNotes, auditLog } = bundle;
  const defaultLabel = TASK_LABELS[submission.taskType] ?? submission.taskType;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">

        {/* Navigation + title row */}
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.back()}
            className="mt-0.5 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <LabelEditor
                submissionId={submission.id}
                currentLabel={localLabel}
                defaultLabel={defaultLabel}
                readOnly={readOnly}
                onSaved={(l) => setLocalLabel(l)}
              />
              <StatusBadge status={submission.status} />
            </div>
            <p className="text-sm text-muted-foreground pl-0.5">
              Practitioner Review Gateway
            </p>
          </div>
        </div>

        {/* Audit strip — reviewer ID sourced from status_audit_log */}
        <AuditStrip submission={submission} auditLog={auditLog} />

        {/* Immutability banner — shown when status is approved */}
        {isLocked && <ImmutabilityBanner />}

        {/* Side-by-side: CBT data + canvas reflections */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <StructuredDataPanel submission={submission} />
          <ReflectionPanel reflections={reflections} />
        </div>

        {/* Practitioner notes — append-only, isolated table */}
        <PractitionerNotesPanel
          submissionId={submission.id}
          notes={practitionerNotes}
          readOnly={readOnly}
          onNoteAdded={(note) =>
            setBundle((prev) =>
              prev
                ? { ...prev, practitionerNotes: [...prev.practitionerNotes, note] }
                : prev
            )
          }
        />

        {/* Status history from status_audit_log */}
        <AuditLogPanel auditLog={auditLog} />

        {/* Decision bar — hidden when approved (immutability lock) */}
        <DecisionBar
          status={submission.status}
          submissionId={submission.id}
          onActionComplete={(updated) =>
            setBundle((prev) =>
              prev ? { ...prev, submission: updated } : prev
            )
          }
        />

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default export — wrapped in AuthGuard (same pattern as dashboard)
// ---------------------------------------------------------------------------

export default function PractitionerReviewPage() {
  return (
    <AuthGuard>
      <ReviewPageInner />
    </AuthGuard>
  );
}
