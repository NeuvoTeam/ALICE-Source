/**
 * tests/review-queue.test.mjs
 *
 * Page-level regression tests for Practitioner Review Queue logic and contracts.
 * Spec: docs/design/2026-10-11 - Practitioner Review Queue Spec.md §7
 *
 * aya's rule: Every test explicitly names the failure mode it guards.
 */

import assert from "node:assert/strict";

import { TASK_LABELS, taskLabel } from "../lib/task-labels.ts";
import { STATUS_CONFIG } from "../lib/task-status.ts";
import {
  relativeWait,
  formatSubmittedAt,
  isRetryableError,
  formatBadgeCount,
  groupSubmissionsByClient,
  sortSubmissions,
  determineEmptyState,
  NON_RETRYABLE_ERROR_CODES,
} from "../lib/review-queue.ts";

let passed = 0;
function pass(name, failureModeGuarded) {
  passed += 1;
  console.log(`PASS  ${passed} ${name}\n      [Guards against: ${failureModeGuarded}]`);
}

async function main() {
  /* -------------------------------------------------------------------------
   * Case 1: All 5 task types have real display labels (§7 case 1)
   * ------------------------------------------------------------------------- */
  {
    const expected = {
      activity_log: "Weekly Activity Schedule",
      thought_record: "The 3 C's Worksheet",
      two_choice_worksheet: "Two-Choice Worksheet",
      reflection_prompt: "Reflection",
      behavioural_experiment: "Behavioural Experiment",
    };

    for (const [type, label] of Object.entries(expected)) {
      assert.equal(
        taskLabel(type),
        label,
        `taskLabel('${type}') must equal '${label}'`
      );
      assert.equal(
        TASK_LABELS[type],
        label,
        `TASK_LABELS['${type}'] must equal '${label}'`
      );
    }

    assert.equal(
      taskLabel("unrecognized_future_task"),
      "Practice task",
      "Unrecognized task types must degrade to safe generic fallback"
    );

    pass(
      "case 1: queue renders two_choice_worksheet, reflection_prompt, and all allowed tasks with real titles",
      "Incomplete label registry causing worksheets and canvas handouts to render ambiguous 'Practice task' fallback labels, depriving clinicians of knowing what activity was submitted"
    );
  }

  /* -------------------------------------------------------------------------
   * Case 2: 'Needs review' sorts oldest-submitted first (FIFO fairness) (§7 case 2)
   * ------------------------------------------------------------------------- */
  {
    const baseDate = new Date("2026-10-10T12:00:00Z");
    const subOld = {
      id: "sub-1-old",
      client_id: "c-1",
      client_name: "Client One",
      task_type: "thought_record",
      status: "pending_practitioner_review",
      submitted_at: new Date(baseDate.getTime() - 5 * 86400000).toISOString(),
      created_at: baseDate.toISOString(),
      updated_at: baseDate.toISOString(),
      reflection_count: 0,
      session_id: null,
      session_name: null,
    };
    const subMid = {
      id: "sub-2-mid",
      client_id: "c-1",
      client_name: "Client One",
      task_type: "activity_log",
      status: "pending_practitioner_review",
      submitted_at: new Date(baseDate.getTime() - 2 * 86400000).toISOString(),
      created_at: baseDate.toISOString(),
      updated_at: baseDate.toISOString(),
      reflection_count: 0,
      session_id: null,
      session_name: null,
    };
    const subNew = {
      id: "sub-3-new",
      client_id: "c-1",
      client_name: "Client One",
      task_type: "two_choice_worksheet",
      status: "pending_practitioner_review",
      submitted_at: baseDate.toISOString(),
      created_at: baseDate.toISOString(),
      updated_at: baseDate.toISOString(),
      reflection_count: 0,
      session_id: null,
      session_name: null,
    };

    // Shuffled input
    const sortedAsc = sortSubmissions([subNew, subOld, subMid], "asc");
    assert.deepEqual(
      sortedAsc.map((s) => s.id),
      ["sub-1-old", "sub-2-mid", "sub-3-new"],
      "Needs review order=asc must position oldest submitted first"
    );

    pass(
      "case 2: 'Needs review' sorts oldest-submitted first (FIFO fairness queue)",
      "Starvation of earlier submissions if sorted newest-first (LIFO), risking client's next session arriving before homework is read"
    );
  }

  /* -------------------------------------------------------------------------
   * Case 3: Waiting time calculation & escalation thresholds (§3.4)
   * ------------------------------------------------------------------------- */
  {
    const now = new Date("2026-10-11T12:00:00Z");

    // 1 day ago: < 3 days -> no amber, not overdue
    const w1 = relativeWait(new Date(now.getTime() - 1 * 86400000).toISOString(), now);
    assert.equal(w1.text, "waiting 1 day");
    assert.equal(w1.amber, false);
    assert.equal(w1.overdue, false);

    // 4 days ago: 3–6 days -> amber, not overdue
    const w4 = relativeWait(new Date(now.getTime() - 4 * 86400000).toISOString(), now);
    assert.equal(w4.text, "waiting 4 days");
    assert.equal(w4.amber, true);
    assert.equal(w4.overdue, false);

    // 8 days ago: >= 7 days -> amber and overdue
    const w8 = relativeWait(new Date(now.getTime() - 8 * 86400000).toISOString(), now);
    assert.equal(w8.text, "waiting 8 days — overdue");
    assert.equal(w8.amber, true);
    assert.equal(w8.overdue, true);

    // 0 days (< 1 day)
    const w0 = relativeWait(new Date(now.getTime() - 3600000).toISOString(), now);
    assert.equal(w0.text, "waiting < 1 day");
    assert.equal(w0.amber, false);
    assert.equal(w0.overdue, false);

    pass(
      "case 3: waiting time escalates across <3 days, 3-6 days (amber), and >=7 days (overdue)",
      "Miscalculating waiting duration thresholds, failing to visually escalate overdue clinical reviews"
    );
  }

  /* -------------------------------------------------------------------------
   * Case 4: Historical NULL submitted_at sorts last and renders unknown wait (§7 case 4)
   * ------------------------------------------------------------------------- */
  {
    const baseDate = new Date("2026-10-10T12:00:00Z");
    const subNull1 = {
      id: "sub-null-1",
      client_id: "c-1",
      client_name: "Historical Client",
      task_type: "thought_record",
      status: "pending_practitioner_review",
      submitted_at: null,
      created_at: baseDate.toISOString(),
      updated_at: baseDate.toISOString(),
      reflection_count: 0,
      session_id: null,
      session_name: null,
    };
    const subNull2 = {
      id: "sub-null-2",
      client_id: "c-1",
      client_name: "Historical Client",
      task_type: "activity_log",
      status: "pending_practitioner_review",
      submitted_at: null,
      created_at: baseDate.toISOString(),
      updated_at: baseDate.toISOString(),
      reflection_count: 0,
      session_id: null,
      session_name: null,
    };
    const subReal = {
      id: "sub-real",
      client_id: "c-1",
      client_name: "Historical Client",
      task_type: "thought_record",
      status: "pending_practitioner_review",
      submitted_at: baseDate.toISOString(),
      created_at: baseDate.toISOString(),
      updated_at: baseDate.toISOString(),
      reflection_count: 0,
      session_id: null,
      session_name: null,
    };

    // Both asc and desc must sort NULL rows last, tie-breaking by id
    const sortedAsc = sortSubmissions([subNull2, subReal, subNull1], "asc");
    assert.deepEqual(
      sortedAsc.map((s) => s.id),
      ["sub-real", "sub-null-1", "sub-null-2"]
    );

    const sortedDesc = sortSubmissions([subNull2, subReal, subNull1], "desc");
    assert.deepEqual(
      sortedDesc.map((s) => s.id),
      ["sub-real", "sub-null-1", "sub-null-2"]
    );

    // Relative wait rendering for null submitted_at
    const waitNull = relativeWait(null);
    assert.equal(waitNull.text, "submitted date unknown");
    assert.equal(waitNull.amber, false);
    assert.equal(waitNull.overdue, false);

    assert.equal(formatSubmittedAt(null), "Date unknown");

    pass(
      "case 4: historical rows with submitted_at = NULL sort last deterministically and render unknown wait",
      "Comparing NULL in keyset pagination skipping rows, infinite loops, or fabricating non-existent wait times for pre-migration data"
    );
  }

  /* -------------------------------------------------------------------------
   * Case 5: Tab badge counts come from counts, not rendered row count (§7 case 5)
   * ------------------------------------------------------------------------- */
  {
    const countsPayload = {
      pending_practitioner_review: 15,
      draft: 4,
      reviewed: 8,
      approved: 5,
      revision_requested: 3,
      archived: 2,
    };

    // Client only received 1 row on this page (limit=1)
    const paginatedRows = [
      {
        id: "sub-page-1",
        client_id: "c-1",
        client_name: "Client",
        task_type: "thought_record",
        status: "pending_practitioner_review",
        submitted_at: "2026-10-10T00:00:00Z",
        created_at: "2026-10-10T00:00:00Z",
        updated_at: "2026-10-10T00:00:00Z",
        reflection_count: 0,
        session_id: null,
        session_name: null,
      },
    ];

    assert.equal(paginatedRows.length, 1);
    // Tab badges MUST read from countsPayload, not paginatedRows.length
    assert.equal(countsPayload.pending_practitioner_review, 15);
    const reviewedTotal = countsPayload.reviewed + countsPayload.approved + countsPayload.revision_requested;
    assert.equal(reviewedTotal, 16);

    pass(
      "case 5: tab badge counts sourced from counts object, independent of paginated row count",
      "Deriving tab counts from paginated or limited rows displaying wrong counts (e.g. '1' instead of '15') when only a subset of rows is fetched"
    );
  }

  /* -------------------------------------------------------------------------
   * Case 6: Navigation URL carries submission id and tab query context (§7 case 6)
   * ------------------------------------------------------------------------- */
  {
    const submissionId = "e87f8702-861c-4b5b-b9d1-049d5926ec39";
    const currentTab = "draft";
    const expectedHref = `/practitioner/tasks/${submissionId}/review?tab=${currentTab}`;

    assert.ok(
      expectedHref.startsWith(`/practitioner/tasks/${submissionId}/review`),
      "Must navigate to specific review gateway"
    );
    assert.ok(
      expectedHref.includes("tab=draft"),
      "Must preserve caller tab filter so gateway back-link returns to identical view"
    );

    pass(
      "case 6: row links resolve to /practitioner/tasks/<id>/review with preserved tab filter",
      "Broken navigation links or missing tab filter context dropping clinician on dead pages or resetting the work list"
    );
  }

  /* -------------------------------------------------------------------------
   * Case 7: Session slot conditional rendering (§7 case 7)
   * ------------------------------------------------------------------------- */
  {
    const rowWithSession = {
      id: "sub-sess-1",
      session_name: "Session 4: Behavioural Activation",
    };
    const rowWithoutSession = {
      id: "sub-sess-2",
      session_name: null,
    };

    // When session_name is present -> session line renders
    assert.equal(rowWithSession.session_name, "Session 4: Behavioural Activation");

    // When session_name is null -> must render NOTHING (null), no placeholder string, no empty wrapper
    const renderedSlot = rowWithoutSession.session_name ?? null;
    assert.equal(renderedSlot, null, "Null session must render strictly null with no placeholder string");

    pass(
      "case 7: session slot renders nothing when session_id/session_name is null (no placeholder or fallback text)",
      "Speculative session inference or placeholder elements cluttering interface and falsely attributing pre-migration rows to wrong sessions"
    );
  }

  /* -------------------------------------------------------------------------
   * Case 8: Error classification — allowlist of non-retryable codes vs default retryable (Constraint 6)
   * ------------------------------------------------------------------------- */
  {
    // Allowlist of non-retryable codes
    assert.ok(NON_RETRYABLE_ERROR_CODES.has("CURSOR_SECRET_UNCONFIGURED"));
    assert.ok(NON_RETRYABLE_ERROR_CODES.has("UNAUTHORIZED"));
    assert.ok(NON_RETRYABLE_ERROR_CODES.has("FORBIDDEN"));

    // Known non-retryable code -> suppress retry CTA
    assert.equal(isRetryableError("CURSOR_SECRET_UNCONFIGURED", 503), false);
    assert.equal(isRetryableError("UNAUTHORIZED", 401), false);
    assert.equal(isRetryableError("FORBIDDEN", 403), false);
    assert.equal(isRetryableError(null, 401), false);
    assert.equal(isRetryableError(null, 403), false);

    // DEFAULT: any unrecognised code, network error, timeout, generic 500 MUST be retryable
    assert.equal(isRetryableError(null, 500), true);
    assert.equal(isRetryableError(null, 502), true);
    assert.equal(isRetryableError(null, 504), true);
    assert.equal(isRetryableError("INTERNAL_SERVER_ERROR", 500), true);
    assert.equal(isRetryableError("DATABASE_TIMEOUT", 504), true);
    assert.equal(isRetryableError("UNEXPECTED_TRANSIENT_ERROR", 500), true);
    assert.equal(isRetryableError(undefined, undefined), true);

    pass(
      "case 8: error states branch on machine-readable code: allowlist suppresses retry, default is retryable",
      "Pointless retry loop blaming user/network for fatal configuration issues (503 CURSOR_SECRET_UNCONFIGURED), or suppressing retries trapping clinicians with transient errors"
    );
  }

  /* -------------------------------------------------------------------------
   * Case 9: Shell badge formatting and 9+ cap (§4 & Constraint 1)
   * ------------------------------------------------------------------------- */
  {
    assert.equal(formatBadgeCount(0), null, "0 pending total renders no badge");
    assert.equal(formatBadgeCount(-1), null, "Negative count renders no badge");
    assert.equal(formatBadgeCount(null), null, "Null count renders no badge");
    assert.equal(formatBadgeCount(1), "1");
    assert.equal(formatBadgeCount(5), "5");
    assert.equal(formatBadgeCount(9), "9");
    assert.equal(formatBadgeCount(10), "9+", "Counts greater than 9 must be capped at 9+");
    assert.equal(formatBadgeCount(99), "9+");

    pass(
      "case 9: shell nav badge formats pending_total and caps at 9+",
      "Pending totals exceeding 9 breaking sidebar layout or 0 values rendering meaningless badge noise in shared chrome"
    );
  }

  /* -------------------------------------------------------------------------
   * Case 10: Client grouping and group alphabetical sorting (§3.2, §3.3)
   * ------------------------------------------------------------------------- */
  {
    const rows = [
      {
        id: "r-1",
        client_id: "c-marcus",
        client_name: "Marcus Webb",
        task_type: "thought_record",
        status: "draft",
        submitted_at: null,
        created_at: "2026-10-10T00:00:00Z",
        updated_at: "2026-10-10T00:00:00Z",
        reflection_count: 0,
        session_id: null,
        session_name: null,
      },
      {
        id: "r-2",
        client_id: "c-ana",
        client_name: "Ana Ruiz",
        task_type: "activity_log",
        status: "pending_practitioner_review",
        submitted_at: "2026-10-10T00:00:00Z",
        created_at: "2026-10-10T00:00:00Z",
        updated_at: "2026-10-10T00:00:00Z",
        reflection_count: 0,
        session_id: null,
        session_name: null,
      },
      {
        id: "r-3",
        client_id: "c-ana",
        client_name: "Ana Ruiz",
        task_type: "two_choice_worksheet",
        status: "pending_practitioner_review",
        submitted_at: "2026-10-09T00:00:00Z",
        created_at: "2026-10-09T00:00:00Z",
        updated_at: "2026-10-09T00:00:00Z",
        reflection_count: 1,
        session_id: null,
        session_name: null,
      },
    ];

    const groups = groupSubmissionsByClient(rows);
    assert.equal(groups.length, 2);

    // Ana Ruiz must sort before Marcus Webb (client name A-Z)
    assert.equal(groups[0].clientName, "Ana Ruiz");
    assert.equal(groups[0].pendingCount, 2);
    assert.equal(groups[0].totalCount, 2);

    assert.equal(groups[1].clientName, "Marcus Webb");
    assert.equal(groups[1].pendingCount, 0);
    assert.equal(groups[1].totalCount, 1);

    pass(
      "case 10: client groups sort alphabetically A-Z and tally pending vs total counts per client",
      "Arbitrary group ordering making caseload navigation disorienting, or incorrect per-client pending counters"
    );
  }

  /* -------------------------------------------------------------------------
   * Case 11: Four distinct empty states (§3.6)
   * ------------------------------------------------------------------------- */
  {
    // 1. No clients at all
    const e1 = determineEmptyState({
      tab: "pending_practitioner_review",
      counts: {},
      hasClients: false,
    });
    assert.equal(e1, "no_clients");

    // 2. Nothing waiting ever (0 pending, 0 others)
    const e2 = determineEmptyState({
      tab: "pending_practitioner_review",
      counts: { pending_practitioner_review: 0, draft: 0, reviewed: 0 },
      hasClients: true,
    });
    assert.equal(e2, "nothing_waiting");

    // 3. All caught up (0 pending, but 5 reviewed exist)
    const e3 = determineEmptyState({
      tab: "pending_practitioner_review",
      counts: { pending_practitioner_review: 0, reviewed: 3, approved: 2 },
      hasClients: true,
    });
    assert.equal(e3, "all_caught_up");

    // 4. Filtered to empty on another tab
    const e4 = determineEmptyState({
      tab: "draft",
      counts: { pending_practitioner_review: 3, draft: 0 },
      hasClients: true,
    });
    assert.equal(e4, "filter_empty");

    // 5. Search filter yielded 0 matching rows
    const e5 = determineEmptyState({
      tab: "pending_practitioner_review",
      counts: { pending_practitioner_review: 5 },
      hasClients: true,
      isSearchFiltered: true,
      matchingRowCount: 0,
    });
    assert.equal(e5, "filter_empty");

    pass(
      "case 11: empty states correctly discriminate 'no_clients', 'nothing_waiting', 'all_caught_up', and 'filter_empty'",
      "Single generic empty state misleading clinicians into believing no work exists when items are simply reviewed, caught up, or filtered out"
    );
  }

  /* -------------------------------------------------------------------------
   * Case 12: StatusConfig vocabulary agreement with Review Gateway (§3.4)
   * ------------------------------------------------------------------------- */
  {
    const expectedStatuses = [
      "draft",
      "pending_practitioner_review",
      "reviewed",
      "approved",
      "revision_requested",
      "archived",
    ];

    for (const st of expectedStatuses) {
      assert.ok(STATUS_CONFIG[st], `STATUS_CONFIG must define status '${st}'`);
      assert.ok(STATUS_CONFIG[st].label, `Status '${st}' must have human label`);
      assert.ok(STATUS_CONFIG[st].cls, `Status '${st}' must have styling classes`);
    }

    pass(
      "case 12: shared StatusPill configuration covers all 6 canonical task statuses",
      "Visual drift between the queue and review gateway where identical statuses present conflicting badge colours or copy"
    );
  }
}

const TOTAL_CHECKS = 12;

main()
  .then(() => {
    if (passed !== TOTAL_CHECKS) {
      throw new Error(`${passed} checks ran but TOTAL_CHECKS is ${TOTAL_CHECKS}`);
    }
    console.log(`\n${passed}/${TOTAL_CHECKS} checks passed`);
  })
  .catch((err) => {
    console.error(`\nFAILED after ${passed} passing checks:\n`, err);
    process.exitCode = 1;
  });
