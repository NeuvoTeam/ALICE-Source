/**
 * lib/task-status.ts
 *
 * Single source of truth for task status display configuration across
 * the review queue and the review gateway.
 */

import type { TaskStatus } from "@/types/tasks";

export const STATUS_CONFIG: Record<TaskStatus, { label: string; cls: string }> = {
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
