"use client";

/**
 * components/tasks/DynamicTaskForm.tsx
 *
 * Typeform-inspired progressive-disclosure form orchestrating the two
 * practice-task handouts:
 *
 *   task_type "activity_log"  → Handout 1  (Weekly Activity Schedule)
 *   task_type "thought_record"→ Handout 10 (The 3 C's Practice Worksheet)
 *
 * ─── Auto-save strategy ──────────────────────────────────────────────────
 * Every data change is debounced (1 200 ms). The debounced handler calls
 * the Worker via apiFetch (lib/auth.ts) — NEVER localStorage / sessionStorage.
 * On failure the save-error banner is shown and form progression is blocked
 * until a subsequent auto-save succeeds (connection restored).
 *
 * `persist={false}` opts out entirely: no auto-save, no save badge, no
 * "Submit for review" and no network calls at all. Used by the signed-link
 * client page (app/practice/[sessionId]), whose caller has no bearer token.
 *
 * ─── Clinical safeguards ─────────────────────────────────────────────────
 * "Submit for review" is disabled until:
 *   (a) at least one auto-save has succeeded (submissionId is established)
 *   (b) there are no pending / in-flight saves
 *   (c) there is no outstanding save error
 * A mandatory Human Approval banner is shown before the final commit so
 * the client cannot accidentally submit (APP 8 / TGA).
 *
 * ─── Architecture ────────────────────────────────────────────────────────
 * This is a client component. It calls the Cloudflare Worker directly via
 * apiFetch — same pattern as vignette-generator.tsx and client-view.tsx.
 * lib/tasks.ts uses "use server" and cannot be imported here.
 * ─────────────────────────────────────────────────────────────────────────
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/auth";
import { CLINICAL_AI_API_BASE } from "@/lib/clinical-ai-api";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  Loader2,
  Send,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import {
  ActivityScheduleForm,
  createEmptySchedule,
  type WeeklySchedule,
} from "./ActivityScheduleForm";

import {
  ThreeCsForm,
  createEmptyThreeCsData,
  type ThreeCsData,
} from "./ThreeCsForm";

import {
  TwoChoiceWorksheetForm,
  createEmptyTwoChoiceData,
  type TwoChoiceData,
} from "./TwoChoiceWorksheetForm";

import type {
  FormData,
  ActivityLogFormData,
  ThoughtRecordFormData,
  TwoChoiceWorksheetFormData,
  NormalisedSubmission,
  UUID,
} from "@/types/tasks";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

export type TaskVariant = "activity_log" | "thought_record" | "two_choice_worksheet";

interface DynamicTaskFormProps {
  /** Identifies the owning client for the submission. */
  clientId?: UUID;
  /** Practitioner to attribute the submission to. */
  practitionerId?: UUID;
  /** Which handout to render. */
  taskType: TaskVariant;
  /** Optional existing submissionId — pass when resuming a saved draft. */
  initialSubmissionId?: UUID;
  /** Optional submissionId alias matching initialSubmissionId. */
  submissionId?: string | null;
  /** Pre-populated task payload from the AI generator. */
  initialData?: any;
  /** Called after a successful final commit. */
  onSubmitted?: (submission: NormalisedSubmission) => void;
  /** Called when the user cancels. */
  onCancel?: () => void;
  /**
   * Defaults to `true`. When `false` the form is fill-in only: no auto-save,
   * no save badge, no submission id required to navigate, and no
   * "Submit for review" — nothing is sent anywhere.
   */
  persist?: boolean;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

// ---------------------------------------------------------------------------
// Save-status indicator
// ---------------------------------------------------------------------------
function SaveStatusBadge({ status }: { status: SaveStatus }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
        status === "idle" && "text-muted-foreground",
        status === "saving" && "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
        status === "saved" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
        status === "error" && "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
      )}
    >
      {status === "idle" && <Cloud className="h-3.5 w-3.5" />}
      {status === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {status === "saved" && <CheckCircle2 className="h-3.5 w-3.5" />}
      {status === "error" && <CloudOff className="h-3.5 w-3.5" />}

      {status === "idle" && <span>Draft</span>}
      {status === "saving" && <span>Saving…</span>}
      {status === "saved" && <span>Saved</span>}
      {status === "error" && <span>Save failed</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error banner (blocks progression)
// ---------------------------------------------------------------------------
interface ErrorBannerProps {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}

function ErrorBanner({ message, onRetry, isRetrying }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900 dark:bg-rose-950/40 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
        <div>
          <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">
            Auto-save failed — your progress is not saved
          </p>
          <p className="mt-0.5 text-xs text-rose-700/80 dark:text-rose-300/80">
            {message}
          </p>
          <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-300/80">
            Form progression is paused until the connection is restored. Do not
            close this tab.
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        disabled={isRetrying}
        className="shrink-0 border-rose-300 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900"
      >
        {isRetrying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          "Retry now"
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Human-approval gate (shown before final submit)
// ---------------------------------------------------------------------------
interface ApprovalGateProps {
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function ApprovalGate({ onConfirm, onCancel, isSubmitting }: ApprovalGateProps) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
        <div>
          <h3 className="text-base font-semibold">Ready to submit for review?</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your completed task will be sent to your practitioner for review.
            You won&apos;t be able to edit it after submission.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded-xs border-input accent-primary"
        />
        <span className="text-sm text-foreground">
          I confirm this is my completed work and I&apos;m ready for my
          practitioner to review it.
        </span>
      </label>

      <div className="flex gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 sm:flex-none"
        >
          Go back
        </Button>
        <Button
          size="sm"
          onClick={onConfirm}
          disabled={!agreed || isSubmitting}
          className="flex-1 sm:flex-none gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Submit for review
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step-wizard shell for activity_log
// (The schedule is one big form; we split it into 3 "days" pages to avoid
// cognitive overload — Mon–Tue, Wed–Thu, Fri–Sun.)
// ---------------------------------------------------------------------------
const ACTIVITY_STEPS = [
  { label: "Mon – Tue", days: ["Mon", "Tue"] as const },
  { label: "Wed – Thu", days: ["Wed", "Thu"] as const },
  { label: "Fri – Sun", days: ["Fri", "Sat", "Sun"] as const },
];

// ---------------------------------------------------------------------------
// DynamicTaskForm (main export)
// ---------------------------------------------------------------------------
export function DynamicTaskForm({
  clientId = "",
  practitionerId = "00000000-0000-0000-0000-000000000000",
  taskType,
  initialSubmissionId,
  submissionId: externalSubmissionId,
  initialData,
  onSubmitted,
  onCancel,
  persist = true,
}: DynamicTaskFormProps) {

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [wizardStep, setWizardStep] = useState(0);
  const totalSteps = taskType === "activity_log" ? ACTIVITY_STEPS.length : 1;

  // ── Form data ─────────────────────────────────────────────────────────────
  const [schedule, setSchedule] = useState<WeeklySchedule>(() => {
    const empty = createEmptySchedule();
    if (initialData?.activity_description) {
      try {
        const parsed = JSON.parse(initialData.activity_description);
        return { ...empty, ...parsed };
      } catch {
        return empty;
      }
    }
    return empty;
  });

  const [threeCsData, setThreeCsData] = useState<ThreeCsData>(() => {
    const empty = createEmptyThreeCsData();
    if (!initialData) return empty;
    return {
      situation: initialData.situation ?? empty.situation,
      automaticThought: initialData.automatic_thought ?? initialData.automaticThought ?? empty.automaticThought,
      emotions: initialData.emotions?.length ? initialData.emotions : empty.emotions,
      evidenceFor: initialData.evidence_for ?? initialData.evidenceFor ?? empty.evidenceFor,
      evidenceAgainst: initialData.evidence_against ?? initialData.evidenceAgainst ?? empty.evidenceAgainst,
      balancedThought: initialData.balanced_thought ?? initialData.balancedThought ?? empty.balancedThought,
      outcomeEmotionIntensity: initialData.outcome_emotion_intensity ?? initialData.outcomeEmotionIntensity ?? empty.outcomeEmotionIntensity,
    };
  });

  const [twoChoiceData, setTwoChoiceData] = useState<TwoChoiceData>(() => {
    const empty = createEmptyTwoChoiceData();
    if (!initialData || taskType !== "two_choice_worksheet") return empty;
    return {
      title: initialData.title ?? empty.title,
      prompts: initialData.prompts ?? empty.prompts,
      answers: initialData.answers ?? initialData.prompts?.map(() => null) ?? empty.answers,
      reflection: initialData.reflection ?? empty.reflection,
      reflection_prompt: initialData.reflection_prompt ?? empty.reflection_prompt,
      notes: initialData.notes ?? empty.notes,
    };
  });

  // ── Persistence state ─────────────────────────────────────────────────────
  const [submissionId, setSubmissionId] = useState<UUID | undefined>(
    initialSubmissionId ?? (externalSubmissionId || undefined)
  );

  // DELIBERATELY RETAINED (lint rank 8g, register row B11). The triage register calls this effect
  // redundant because the initialiser above already seeds the same prop — true at mount, and true
  // for the two call sites that never pass a submission id (`app/practice/[sessionId]/page.tsx`
  // runs with `persist={false}`; `components/client-view.tsx` passes none). It is NOT true at
  // `components/vignette-generator.tsx:715`, which passes `submissionId={generatedSubmissionId}`:
  // `handleRegenerateExplicit` sets a NEW draft id (`:513`) without changing `step`, so the form
  // stays mounted and the prop changes underneath it. This effect is the only thing that
  // re-points the mounted form at the new draft row; without it `performSave` would keep writing
  // (`id: submissionId ?? null`) into the previous row while the new draft keeps the newly
  // generated payload. The rule is left visible rather than disabled: the alternatives are a
  // `key` remount, which unmounts the form and drops a pending autosave debounce, or a derived
  // id, which diverges in the same post-save case.
  useEffect(() => {
    if (externalSubmissionId) {
      setSubmissionId(externalSubmissionId);
    }
  }, [externalSubmissionId]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // ── Commit state ──────────────────────────────────────────────────────────
  const [showApprovalGate, setShowApprovalGate] = useState(false);
  const [, startCommitTransition] = useTransition();
  const [isCommitting, setIsCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);

  // ── Debounce ref ──────────────────────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Build FormData payload from current state ─────────────────────────────
  const buildFormData = useCallback((): FormData => {
    if (taskType === "activity_log") {
      // Flatten WeeklySchedule to ActivityLogFormData for the first
      // non-empty entry as a representative; full grid is stored in notes.
      // Per types/tasks.ts, ActivityLogFormData has a single activity_date.
      // We store the full weekly grid as a JSON string in the notes field.
      const payload: ActivityLogFormData = {
        task_type: "activity_log",
        activity_date: new Date().toISOString().slice(0, 10),
        activity_description: JSON.stringify(schedule),
        pleasure_rating: 5,
        mastery_rating: 5,
        notes: "Weekly activity schedule — see activity_description for grid.",
      };
      return payload;
    } else if (taskType === "thought_record") {
      const payload: ThoughtRecordFormData = {
        task_type: "thought_record",
        situation: threeCsData.situation,
        automatic_thought: threeCsData.automaticThought,
        emotions: threeCsData.emotions.map((e) => ({
          label: e.label,
          intensity: e.intensity,
        })),
        evidence_for: threeCsData.evidenceFor,
        evidence_against: threeCsData.evidenceAgainst,
        balanced_thought: threeCsData.balancedThought,
        outcome_emotion_intensity: threeCsData.outcomeEmotionIntensity,
      };
      return payload;
    } else {
      const payload: TwoChoiceWorksheetFormData = {
        task_type: "two_choice_worksheet",
        title: twoChoiceData.title,
        prompts: twoChoiceData.prompts,
        answers: twoChoiceData.answers,
        reflection: twoChoiceData.reflection,
        reflection_prompt: twoChoiceData.reflection_prompt,
        notes: twoChoiceData.notes,
      };
      return payload;
    }
  }, [taskType, schedule, threeCsData, twoChoiceData]);

  // ── Core save function ────────────────────────────────────────────────────
  const performSave = useCallback(
    async (formData: FormData): Promise<boolean> => {
      // Fill-in-only mode: never touch the network.
      if (!persist) return false;

      setSaveStatus("saving");
      setSaveError(null);

      try {
        const res = await apiFetch(`${CLINICAL_AI_API_BASE}/tasks/submissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: submissionId ?? null,
            client_id: clientId,
            practitioner_id: practitionerId,
            task_type: taskType,
            form_data: formData,
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }

        const row = await res.json() as { id: UUID };
        // Persist the returned id so subsequent saves update the same row.
        setSubmissionId((prev) => prev ?? row.id);
        setSaveStatus("saved");
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setSaveError(msg);
        setSaveStatus("error");
        return false;
      }
    },
    [submissionId, clientId, practitionerId, taskType, persist]
  );

  // ── Debounced auto-save ───────────────────────────────────────────────────
  const triggerAutoSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Mark as pending immediately so the UI reflects unsaved state
    setSaveStatus("saving");
    debounceRef.current = setTimeout(() => {
      performSave(buildFormData());
    }, 1200);
  }, [buildFormData, performSave]);

  // DELIBERATELY RETAINED (lint rank 8g, register row B12). This is an intended side effect, not
  // state derived from props: `triggerAutoSave` marks the form "saving" and arms the 1200 ms
  // debounce, so the write is what tells the clinician their edit is pending, and the 1200 ms
  // timer is what stops every keystroke from hitting `POST /tasks/submissions`. The rule's real
  // subject — a cascading render from a state write during the effect's synchronous prologue —
  // does not apply to a debounce whose whole purpose is to defer the work. It is left visible
  // rather than silenced with a scoped `eslint-disable`, because every other rule downgrade in
  // `eslint.config.mjs` is deliberately kept in the totals: removing the autosave or its debounce
  // is out of the question, so the honest record is a retained finding with this reason.
  // Schedule save whenever data changes
  useEffect(() => {
    if (!persist) return;
    triggerAutoSave();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule, threeCsData, twoChoiceData]);

  // ── Manual retry ─────────────────────────────────────────────────────────
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    await performSave(buildFormData());
    setIsRetrying(false);
  }, [buildFormData, performSave]);

  // ── Navigation guards ─────────────────────────────────────────────────────
  // Without persistence there is no save state to wait on.
  const canProgress = !persist || saveStatus !== "error";
  const isLastStep = wizardStep === totalSteps - 1;

  // ── Final commit ──────────────────────────────────────────────────────────
  const handleCommit = useCallback(() => {
    if (!persist || !submissionId) return;
    setIsCommitting(true);

    startCommitTransition(async () => {
      try {
        const res = await apiFetch(
          `${CLINICAL_AI_API_BASE}/tasks/submissions/${encodeURIComponent(submissionId)}/commit`,
          { method: "POST", headers: { "Content-Type": "application/json" } }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => null) as { error?: string } | null;
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }

        const submitted = await res.json() as NormalisedSubmission;
        setCommitted(true);
        onSubmitted?.(submitted);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Submit failed";
        setSaveError(msg);
        setSaveStatus("error");
        setShowApprovalGate(false);
      } finally {
        setIsCommitting(false);
      }
    });
  }, [submissionId, onSubmitted, startCommitTransition, persist]);

  // ── Progress bar ──────────────────────────────────────────────────────────
  const progressValue = useMemo(
    () => Math.round(((wizardStep + 1) / totalSteps) * 100),
    [wizardStep, totalSteps]
  );

  // ── Success screen ────────────────────────────────────────────────────────
  if (committed) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
          <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Task submitted!</h2>
          <p className="text-muted-foreground max-w-sm">
            Your practitioner will review your responses and get back to you.
            Great work completing this task.
          </p>
        </div>
        {onCancel && (
          <Button variant="outline" onClick={onCancel} size="lg">
            Return to dashboard
          </Button>
        )}
      </div>
    );
  }

  // ── Task title ────────────────────────────────────────────────────────────
  const taskTitle =
    taskType === "activity_log"
      ? "Weekly Activity Schedule"
      : taskType === "thought_record" 
      ? "The 3 C's Practice Worksheet"
      : "Interactive Worksheet";

  const taskSubtitle =
    taskType === "activity_log"
      ? "Track your activities and mood ratings across the week"
      : taskType === "thought_record"
      ? "Identify, examine, and reframe automatic thoughts"
      : "Make choices and reflect on your task";

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{taskTitle}</h1>
            <p className="text-sm text-muted-foreground">{taskSubtitle}</p>
          </div>
          {persist && <SaveStatusBadge status={saveStatus} />}
        </div>

        {/* Progress bar */}
        {totalSteps > 1 && (
          <div className="space-y-1 pt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{ACTIVITY_STEPS[wizardStep].label}</span>
              <span>
                {wizardStep + 1} / {totalSteps}
              </span>
            </div>
            <Progress value={progressValue} className="h-1.5" />
          </div>
        )}
      </div>

      {/* ── Save-error banner (blocks progression) ─────────── */}
      {saveStatus === "error" && saveError && (
        <ErrorBanner
          message={saveError}
          onRetry={handleRetry}
          isRetrying={isRetrying}
        />
      )}

      {/* ── Form body ────────────────────────────────────────── */}
      <div className="min-h-[400px]">
        {taskType === "activity_log" && (
          <ActivityScheduleForm
            schedule={schedule}
            onChange={setSchedule}
            disabled={saveStatus === "error" || isCommitting}
          />
        )}

        {taskType === "thought_record" && (
          <ThreeCsForm
            data={threeCsData}
            onChange={setThreeCsData}
            disabled={saveStatus === "error" || isCommitting}
          />
        )}

        {taskType === "two_choice_worksheet" && (
          <TwoChoiceWorksheetForm
            data={twoChoiceData}
            onChange={setTwoChoiceData}
            disabled={saveStatus === "error" || isCommitting}
          />
        )}
      </div>

      {/* ── Approval gate ────────────────────────────────────── */}
      {showApprovalGate && (
        <ApprovalGate
          onConfirm={handleCommit}
          onCancel={() => setShowApprovalGate(false)}
          isSubmitting={isCommitting}
        />
      )}

      {/* ── Navigation row ───────────────────────────────────── */}
      {!showApprovalGate && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          {!persist && wizardStep === 0 && !onCancel ? (
            // Fill-in-only with no cancel handler: a "Cancel" would do nothing.
            <span aria-hidden="true" />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (wizardStep > 0) {
                  setWizardStep((s) => s - 1);
                } else {
                  onCancel?.();
                }
              }}
              className="gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              {wizardStep === 0 ? "Cancel" : "Back"}
            </Button>
          )}

          <div className="flex items-center gap-2">
            {/* Dot pagination (multi-step only) */}
            {totalSteps > 1 &&
              Array.from({ length: totalSteps }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === wizardStep
                      ? "w-5 bg-primary"
                      : "w-1.5 bg-muted-foreground/30"
                  )}
                />
              ))}
          </div>

          {isLastStep && !persist ? (
            // Fill-in-only: there is nothing to submit, so say so plainly.
            <p className="text-xs text-muted-foreground text-right">
              Answers on this page are not saved or sent.
            </p>
          ) : isLastStep ? (
            <Button
              size="sm"
              disabled={
                saveStatus === "error" ||
                saveStatus === "saving" ||
                !submissionId
              }
              onClick={() => setShowApprovalGate(true)}
              className="gap-1.5"
              title={
                !submissionId
                  ? "Waiting for first auto-save…"
                  : saveStatus === "error"
                  ? "Resolve save error before submitting"
                  : undefined
              }
            >
              <Send className="h-4 w-4" />
              Submit for review
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={!canProgress}
              onClick={() => setWizardStep((s) => Math.min(s + 1, totalSteps - 1))}
              className="gap-1.5"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
