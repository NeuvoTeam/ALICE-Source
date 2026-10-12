/**
 * lib/task-labels.ts
 *
 * Single source of truth for task type display labels across
 * the practitioner review queue and review gateway.
 *
 * Spec: docs/design/2026-10-11 - Practitioner Review Queue Spec.md §1a
 */

export const TASK_LABELS: Record<string, string> = {
  activity_log: "Weekly Activity Schedule",
  thought_record: "The 3 C's Worksheet",
  two_choice_worksheet: "Two-Choice Worksheet",
  reflection_prompt: "Reflection",
  behavioural_experiment: "Behavioural Experiment",
};

export const taskLabel = (t: string): string => TASK_LABELS[t] ?? "Practice task";
