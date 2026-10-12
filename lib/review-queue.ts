/**
 * lib/review-queue.ts
 *
 * Domain and presentation logic for the Practitioner Review Queue.
 *
 * Spec: docs/design/2026-10-11 - Practitioner Review Queue Spec.md
 *   - §3.2 Sort & fairness queue (FIFO for Needs review, tie-break by id)
 *   - §3.3 Group header & client grouping
 *   - §3.4 Row anatomy, relative waiting time escalation, and null submitted_at handling
 *   - §3.6 Empty states
 *   - §3.7 Error state allowlist branching (Constraint 6)
 *   - §4 Shell badge pending count formatting
 */

import type { ReviewQueueRow, ReviewQueueCounts, TaskStatus } from "@/types/tasks";

export interface WaitTimeDisplay {
  text: string;
  amber: boolean;
  overdue: boolean;
}

/**
 * Calculates relative waiting time and escalation treatment.
 * Spec §3.4:
 *   < 3 days: as-is (e.g. "waiting 2 days" or "waiting < 1 day")
 *   3–6 days: text-amber (e.g. "waiting 4 days")
 *   ≥ 7 days: border-amber and overdue label (e.g. "waiting 8 days — overdue")
 * Historical NULL rows: "submitted date unknown", never throwing or fabricating a timestamp.
 */
export function relativeWait(
  submittedAt: string | null | undefined,
  now: Date = new Date()
): WaitTimeDisplay {
  if (!submittedAt) {
    return {
      text: "submitted date unknown",
      amber: false,
      overdue: false,
    };
  }

  const submittedDate = new Date(submittedAt);
  if (isNaN(submittedDate.getTime())) {
    return {
      text: "submitted date unknown",
      amber: false,
      overdue: false,
    };
  }

  const diffMs = now.getTime() - submittedDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      text: "waiting 0 days",
      amber: false,
      overdue: false,
    };
  }

  if (diffDays < 3) {
    const text = diffDays === 0 ? "waiting < 1 day" : `waiting ${diffDays} day${diffDays === 1 ? "" : "s"}`;
    return {
      text,
      amber: false,
      overdue: false,
    };
  }

  if (diffDays <= 6) {
    return {
      text: `waiting ${diffDays} days`,
      amber: true,
      overdue: false,
    };
  }

  return {
    text: `waiting ${diffDays} days — overdue`,
    amber: true,
    overdue: true,
  };
}

/**
 * Formats submitted_at timestamp for display.
 * Sourced from practice_task_submissions.submitted_at (never created_at or status_audit_log).
 */
export function formatSubmittedAt(submittedAt: string | null | undefined): string {
  if (!submittedAt) {
    return "Date unknown";
  }
  const date = new Date(submittedAt);
  if (isNaN(date.getTime())) {
    return "Date unknown";
  }
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/**
 * Allowlist of machine-readable codes that suppress the retry CTA.
 *
 * DEFAULT: An unrecognised code (or network failure, timeout, unknown 5xx) is treated as RETRYABLE.
 * Only a known non-retryable code (CURSOR_SECRET_UNCONFIGURED, plus auth failures) suppresses the CTA —
 * an allowlist of codes that suppress retry, never a denylist of codes that permit it.
 * The asymmetry decides it: a useless retry wastes one tap, whereas suppressing a retry that would have
 * worked leaves the user with no path forward and no way to know one existed.
 */
export const NON_RETRYABLE_ERROR_CODES = new Set([
  "CURSOR_SECRET_UNCONFIGURED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "AUTH_REQUIRED",
]);

/**
 * Determines whether an error state should render a "Try again" retry CTA.
 * Branches strictly on machine-readable error `code` or HTTP status, never message text.
 */
export function isRetryableError(
  code: string | null | undefined,
  httpStatus?: number
): boolean {
  if (httpStatus === 401 || httpStatus === 403) {
    return false;
  }
  if (code && NON_RETRYABLE_ERROR_CODES.has(code.trim())) {
    return false;
  }
  // Default is retryable (unknown 5xx, network error, timeout, unrecognised codes).
  return true;
}

/**
 * Formats pending count for shell nav badge.
 * Spec §4: Cap at `9+`.
 */
export function formatBadgeCount(pendingTotal: number | null | undefined): string | null {
  if (typeof pendingTotal !== "number" || pendingTotal <= 0) {
    return null;
  }
  return pendingTotal > 9 ? "9+" : String(pendingTotal);
}

export interface ClientSubmissionGroup {
  clientId: string;
  clientName: string;
  rows: ReviewQueueRow[];
  pendingCount: number;
  totalCount: number;
}

/**
 * Groups submissions by client, counting pending and total items per client,
 * sorting client groups alphabetically by client_name (Spec §3.2, §3.3).
 */
export function groupSubmissionsByClient(rows: ReviewQueueRow[]): ClientSubmissionGroup[] {
  const map = new Map<string, { clientName: string; rows: ReviewQueueRow[] }>();

  for (const row of rows) {
    const cid = row.client_id;
    const existing = map.get(cid);
    const resolvedName = row.client_name?.trim() || "Unknown Client";
    if (existing) {
      existing.rows.push(row);
      if (existing.clientName === "Unknown Client" && row.client_name?.trim()) {
        existing.clientName = row.client_name.trim();
      }
    } else {
      map.set(cid, {
        clientName: resolvedName,
        rows: [row],
      });
    }
  }

  const groups: ClientSubmissionGroup[] = [];

  for (const [clientId, { clientName, rows: clientRows }] of map.entries()) {
    const pendingCount = clientRows.filter(
      (r) => r.status === "pending_practitioner_review"
    ).length;
    groups.push({
      clientId,
      clientName,
      rows: clientRows,
      pendingCount,
      totalCount: clientRows.length,
    });
  }

  // Sort groups by client name ascending; tie-break by clientId
  groups.sort((a, b) => {
    const cmp = a.clientName.localeCompare(b.clientName, undefined, { sensitivity: "base" });
    if (cmp !== 0) return cmp;
    return a.clientId.localeCompare(b.clientId);
  });

  return groups;
}

/**
 * Sorts submissions according to queue order contract (§3.2):
 * - Needs review (FIFO): oldest submitted first (order=asc), NULLs last deterministically.
 * - Other tabs: newest submitted first (order=desc), NULLs last deterministically.
 * - Tie-break by stable row id.
 */
export function sortSubmissions(
  rows: ReviewQueueRow[],
  order: "asc" | "desc"
): ReviewQueueRow[] {
  return [...rows].sort((a, b) => {
    const aNull = a.submitted_at === null || a.submitted_at === undefined;
    const bNull = b.submitted_at === null || b.submitted_at === undefined;

    // Historical NULLs always sort last regardless of asc/desc
    if (aNull && !bNull) return 1;
    if (!aNull && bNull) return -1;
    if (aNull && bNull) {
      return a.id.localeCompare(b.id);
    }

    const aTime = new Date(a.submitted_at!).getTime();
    const bTime = new Date(b.submitted_at!).getTime();

    if (aTime !== bTime) {
      return order === "asc" ? aTime - bTime : bTime - aTime;
    }

    // Stable tie-break by id
    return a.id.localeCompare(b.id);
  });
}

export type EmptyStateKind =
  | "no_clients"
  | "nothing_waiting"
  | "all_caught_up"
  | "filter_empty";

/**
 * Discriminates between the four distinct empty states specified in §3.6.
 *
 * 1. "no_clients": Caseload has no clients.
 * 2. "nothing_waiting": Needs review tab, 0 pending, 0 total submissions ever.
 * 3. "all_caught_up": Needs review tab, 0 pending, but prior submissions exist (some reviewed).
 * 4. "filter_empty": Filtered tab/search has 0 rows matching.
 */
export function determineEmptyState({
  tab,
  counts,
  hasClients = true,
  isSearchFiltered = false,
  matchingRowCount = 0,
}: {
  tab: string;
  counts: ReviewQueueCounts;
  hasClients?: boolean;
  isSearchFiltered?: boolean;
  matchingRowCount?: number;
}): EmptyStateKind {
  if (!hasClients) {
    return "no_clients";
  }

  if (matchingRowCount === 0 && isSearchFiltered) {
    return "filter_empty";
  }

  if (tab === "pending_practitioner_review") {
    const pending = counts.pending_practitioner_review ?? 0;
    if (pending === 0) {
      const otherTotal =
        (counts.draft ?? 0) +
        (counts.reviewed ?? 0) +
        (counts.approved ?? 0) +
        (counts.revision_requested ?? 0) +
        (counts.archived ?? 0);
      if (otherTotal > 0) {
        return "all_caught_up";
      }
      return "nothing_waiting";
    }
  }

  return "filter_empty";
}
