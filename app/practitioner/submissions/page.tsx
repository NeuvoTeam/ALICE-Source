"use client";

/**
 * app/practitioner/submissions/page.tsx
 *
 * Practitioner Review Queue — the landing work list for clinicians to review
 * client practice-task submissions.
 *
 * Spec: docs/design/2026-10-11 - Practitioner Review Queue Spec.md
 *   - §3 Layout, tabs, sort fairness queue, client grouping, row anatomy, empty/error states
 *   - §4 Shell badge pending total alignment
 *   - §5 Accessibility (DOM hierarchy, aria attributes, no grid roles)
 *   - §6 API contract
 *
 * Architectural constraints:
 *   - No client-side storage (localStorage/sessionStorage strictly avoided)
 *   - All API access via apiFetch -> Cloudflare Worker -> Supabase
 *   - Sourced from GET /tasks/submissions
 *   - Counts vs rows: tab badges driven by counts, nav badge driven by pending_total
 *   - Client A–Z row sort withdrawn: default view groups by client under client heading
 *   - Error branching on machine-readable error code with allowlist suppressing retry
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FilterX,
  ImageIcon,
  Inbox,
  Loader2,
  RefreshCcw,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/auth";
import { CLINICAL_AI_API_BASE } from "@/lib/clinical-ai-api";
import { taskLabel } from "@/lib/task-labels";
import { StatusPill } from "@/components/status-pill";
import {
  relativeWait,
  formatSubmittedAt,
  isRetryableError,
  groupSubmissionsByClient,
  sortSubmissions,
  determineEmptyState,
} from "@/lib/review-queue";
import { DashboardShell } from "@/components/dashboard-shell";
import AuthGuard from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ReviewQueueRow,
  ReviewQueueCounts,
  ReviewQueueResponse,
} from "@/types/tasks";

// ---------------------------------------------------------------------------
// Tabs configuration (§3.1)
// ---------------------------------------------------------------------------

interface TabConfig {
  id: string;
  label: string;
  statusParam: string | null;
  defaultOrder: "asc" | "desc";
  count: (counts: ReviewQueueCounts) => number;
}

const TABS: TabConfig[] = [
  {
    id: "pending_practitioner_review",
    label: "Needs review",
    statusParam: "pending_practitioner_review",
    defaultOrder: "asc", // FIFO fairness queue: oldest submitted first
    count: (c) => c.pending_practitioner_review ?? 0,
  },
  {
    id: "all",
    label: "All",
    statusParam: null,
    defaultOrder: "desc",
    count: (c) =>
      (c.pending_practitioner_review ?? 0) +
      (c.draft ?? 0) +
      (c.reviewed ?? 0) +
      (c.approved ?? 0) +
      (c.revision_requested ?? 0) +
      (c.archived ?? 0),
  },
  {
    id: "draft",
    label: "Drafts",
    statusParam: "draft",
    defaultOrder: "desc",
    count: (c) => c.draft ?? 0,
  },
  {
    id: "reviewed",
    label: "Reviewed",
    statusParam: "in.(reviewed,approved,revision_requested)",
    defaultOrder: "desc",
    count: (c) =>
      (c.reviewed ?? 0) +
      (c.approved ?? 0) +
      (c.revision_requested ?? 0),
  },
  {
    id: "archived",
    label: "Archived",
    statusParam: "archived",
    defaultOrder: "desc",
    count: (c) => c.archived ?? 0,
  },
];

// ---------------------------------------------------------------------------
// Queue Main Component
// ---------------------------------------------------------------------------

function ReviewQueueContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL state
  const currentTabId = searchParams.get("tab") || "pending_practitioner_review";
  const activeTab = TABS.find((t) => t.id === currentTabId) ?? TABS[0];

  const orderParam = searchParams.get("order");
  const currentOrder: "asc" | "desc" =
    orderParam === "asc" || orderParam === "desc"
      ? orderParam
      : activeTab.defaultOrder;

  // Local state
  const [rows, setRows] = useState<ReviewQueueRow[]>([]);
  const [counts, setCounts] = useState<ReviewQueueCounts>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasLoadedCaseload, setHasLoadedCaseload] = useState(false);

  // Error state — stores machine-readable code and retryable flag
  const [fetchError, setFetchError] = useState<{
    message: string;
    code: string | null;
    retryable: boolean;
  } | null>(null);

  // Track manually toggled group collapse states
  // Format in URL: ?collapsed=client1,client2
  const collapsedParam = searchParams.get("collapsed");
  const urlCollapsedSet = useMemo(() => {
    if (!collapsedParam) return new Set<string>();
    return new Set(collapsedParam.split(",").filter(Boolean));
  }, [collapsedParam]);

  const [toggledCollapsed, setToggledCollapsed] = useState<Record<string, boolean>>({});

  // Synchronize URL helper
  const updateUrl = useCallback(
    (newParams: { tab?: string; order?: "asc" | "desc"; collapsed?: string }) => {
      const next = new URLSearchParams(searchParams.toString());
      if (newParams.tab !== undefined) {
        if (newParams.tab === "pending_practitioner_review") {
          next.delete("tab");
        } else {
          next.set("tab", newParams.tab);
        }
      }
      if (newParams.order !== undefined) {
        next.set("order", newParams.order);
      }
      if (newParams.collapsed !== undefined) {
        if (!newParams.collapsed) {
          next.delete("collapsed");
        } else {
          next.set("collapsed", newParams.collapsed);
        }
      }
      router.replace(`/practitioner/submissions?${next.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Fetch queue page
  const fetchQueue = useCallback(
    async (isPageAppend = false, cursorValue: string | null = null) => {
      if (isPageAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setFetchError(null);
      }

      try {
        const query = new URLSearchParams();
        if (activeTab.statusParam) {
          query.set("status", activeTab.statusParam);
        }
        query.set("order", currentOrder);
        query.set("limit", "50");
        if (cursorValue) {
          query.set("cursor", cursorValue);
        }

        const res = await apiFetch(`${CLINICAL_AI_API_BASE}/tasks/submissions?${query.toString()}`);

        if (!res.ok) {
          const errBody = (await res.json().catch(() => null)) as {
            code?: string;
            error?: string;
            message?: string;
          } | null;

          const errorCode = errBody?.code ?? null;
          // Determine retryability based strictly on machine-readable code / status
          const retryable = isRetryableError(errorCode, res.status);
          const errorMsg =
            errBody?.error || errBody?.message || `HTTP ${res.status} error loading submissions`;

          setFetchError({
            message: errorMsg,
            code: errorCode,
            retryable,
          });
          return;
        }

        const data = (await res.json()) as ReviewQueueResponse;

        setCounts(data.counts || {});
        setNextCursor(data.next_cursor || null);
        setHasLoadedCaseload(true);

        if (isPageAppend) {
          setRows((prev) => [...prev, ...(data.rows || [])]);
        } else {
          setRows(data.rows || []);
        }
      } catch (err) {
        // Network errors and unexpected exceptions are retryable by default
        setFetchError({
          message: err instanceof Error ? err.message : "Network error loading submissions",
          code: null,
          retryable: true,
        });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeTab.statusParam, currentOrder]
  );

  // Trigger fetch when tab or order changes
  useEffect(() => {
    void fetchQueue(false, null);
  }, [fetchQueue]);

  // Tab change handler
  const handleTabChange = (tabId: string) => {
    const targetTab = TABS.find((t) => t.id === tabId);
    if (!targetTab) return;
    updateUrl({
      tab: tabId,
      order: targetTab.defaultOrder,
    });
  };

  // Sort change handler
  const handleSortChange = (newOrder: "asc" | "desc") => {
    updateUrl({ order: newOrder });
  };

  // Pagination handler
  const handleLoadMore = () => {
    if (!nextCursor || loadingMore) return;
    void fetchQueue(true, nextCursor);
  };

  // Group and sort rows
  const clientGroups = useMemo(() => {
    const groups = groupSubmissionsByClient(rows);

    // Sort rows inside each group according to active sort order
    for (const g of groups) {
      g.rows = sortSubmissions(g.rows, currentOrder);
    }

    // Filter by client search query if entered
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return groups.filter((g) => g.clientName.toLowerCase().includes(q));
    }

    return groups;
  }, [rows, currentOrder, searchQuery]);

  const totalMatchingRows = useMemo(() => {
    return clientGroups.reduce((acc, g) => acc + g.rows.length, 0);
  }, [clientGroups]);

  // Toggle group collapse
  const toggleGroup = (clientId: string, defaultExpanded: boolean) => {
    const isCurrentlyExpanded =
      toggledCollapsed[clientId] !== undefined
        ? toggledCollapsed[clientId]
        : defaultExpanded;

    const nextState = !isCurrentlyExpanded;
    setToggledCollapsed((prev) => ({
      ...prev,
      [clientId]: nextState,
    }));

    // Update URL collapsed set
    const updated = new Set(urlCollapsedSet);
    if (nextState) {
      updated.delete(clientId);
    } else {
      updated.add(clientId);
    }
    updateUrl({ collapsed: Array.from(updated).join(",") });
  };

  // Empty state discriminator
  const emptyStateKind = useMemo(() => {
    return determineEmptyState({
      tab: activeTab.id,
      counts,
      hasClients: hasLoadedCaseload,
      isSearchFiltered: searchQuery.trim().length > 0,
      matchingRowCount: totalMatchingRows,
    });
  }, [activeTab.id, counts, hasLoadedCaseload, searchQuery, totalMatchingRows]);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">

        {/* ================================================================ */}
        {/* Header & Client Search                                           */}
        {/* ================================================================ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Submissions
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review and integrate completed practice activities into the clinical file.
            </p>
          </div>

          {/* Client search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search clients…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm"
              aria-label="Search clients by name"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* Controls: Tabs & Sort                                            */}
        {/* ================================================================ */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">

          {/* Tabs list (role="tablist", aria-selected per §3.1) */}
          <div
            role="tablist"
            aria-label="Submission filter tabs"
            className="flex flex-wrap items-center gap-1.5"
          >
            {TABS.map((tab) => {
              const isSelected = activeTab.id === tab.id;
              const tabCount = tab.count(counts);

              return (
                <button
                  key={tab.id}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isSelected}
                  aria-controls={`panel-${tab.id}`}
                  aria-label={`${tab.label}, ${tabCount} submissions`}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-xs font-semibold",
                      isSelected
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {tabCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sort Control (§3.2) */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <span className="text-xs text-muted-foreground font-medium">Sort:</span>
            <Select
              value={currentOrder}
              onValueChange={(val) => handleSortChange(val as "asc" | "desc")}
            >
              <SelectTrigger
                className="h-8 text-xs w-36"
                aria-label="Select submission sort order"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc" className="text-xs">
                  Waiting longest
                </SelectItem>
                <SelectItem value="desc" className="text-xs">
                  Newest
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ================================================================ */}
        {/* Error States (Constraint 6 & Spec §3.7)                          */}
        {/* ================================================================ */}
        {fetchError && (
          <div
            role="alert"
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  {fetchError.retryable
                    ? "Couldn't load submissions"
                    : "Submissions are unavailable right now."}
                </p>
                {fetchError.retryable && (
                  <p className="text-xs text-destructive/80 mt-0.5">
                    {fetchError.message}
                  </p>
                )}
              </div>
            </div>

            {/* Suppress retry CTA on non-retryable error codes */}
            {fetchError.retryable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchQueue(false, null)}
                className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/20"
              >
                <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                Try again
              </Button>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* Loading Skeletons (§3.7: 3 per group, never a spinner)           */}
        {/* ================================================================ */}
        {loading && (
          <div className="space-y-6" aria-busy="true" aria-label="Loading submissions">
            {[1, 2].map((g) => (
              <div key={g} className="space-y-3">
                <div className="h-5 w-44 rounded bg-muted animate-pulse" />
                <div className="space-y-2">
                  {[1, 2, 3].map((r) => (
                    <div
                      key={r}
                      className="h-[68px] rounded-xl bg-muted animate-pulse border border-border"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================================================================ */}
        {/* Empty States (§3.6 — four distinct states)                       */}
        {/* ================================================================ */}
        {!loading && !fetchError && clientGroups.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4 rounded-xl border border-dashed border-border bg-card">
            {emptyStateKind === "no_clients" && (
              <>
                <UserPlus className="h-10 w-10 text-muted-foreground mb-3" />
                <h2 className="text-base font-semibold text-foreground">No clients yet</h2>
                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                  Add a client to start assigning practice activities.
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                >
                  Go to clients
                </Button>
              </>
            )}

            {emptyStateKind === "nothing_waiting" && (
              <>
                <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
                <h2 className="text-base font-semibold text-foreground">
                  Nothing waiting for review
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                  Submissions appear here when a client completes an activity.
                </p>
              </>
            )}

            {emptyStateKind === "all_caught_up" && (
              <>
                <CheckCircle2 className="h-10 w-10 text-emerald-600 mb-3" />
                <h2 className="text-base font-semibold text-foreground">
                  You&apos;re all caught up
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                  {counts.reviewed ?? 0} submissions reviewed. {counts.approved ?? 0} approved,{" "}
                  {counts.revision_requested ?? 0} awaiting the client&apos;s revision.
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => handleTabChange("reviewed")}
                >
                  View reviewed submissions
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}

            {emptyStateKind === "filter_empty" && (
              <>
                <FilterX className="h-10 w-10 text-muted-foreground mb-3" />
                <h2 className="text-base font-semibold text-foreground">
                  No {activeTab.label} submissions
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                  {searchQuery ? "No submissions match this search." : "Nothing matches this filter."}
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    handleTabChange("pending_practitioner_review");
                  }}
                >
                  Clear filter
                </Button>
              </>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* Main List: Client Groups & Submission Rows (§3.3, §3.4, §5)      */}
        {/* ================================================================ */}
        {!loading && !fetchError && clientGroups.length > 0 && (
          <ul
            id={`panel-${activeTab.id}`}
            role="region"
            aria-labelledby={`tab-${activeTab.id}`}
            className="space-y-6 list-none p-0 m-0"
          >
            {clientGroups.map((group) => {
              // Default expansion: pending work > 0 is expanded; 0 pending is collapsed (§3.3)
              const defaultExpanded = group.pendingCount > 0;
              const isExpanded =
                toggledCollapsed[group.clientId] !== undefined
                  ? toggledCollapsed[group.clientId]
                  : urlCollapsedSet.has(group.clientId)
                    ? false
                    : defaultExpanded;

              return (
                <li key={group.clientId} className="space-y-2.5">
                  {/* Group header button (§3.3) */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.clientId, defaultExpanded)}
                    aria-expanded={isExpanded}
                    aria-controls={`client-group-${group.clientId}`}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <h3 className="text-sm font-semibold text-foreground">
                        {group.clientName}
                      </h3>
                    </div>

                    <span className="text-xs text-muted-foreground font-mono">
                      {group.pendingCount} pending · {group.totalCount} total
                    </span>
                  </button>

                  {/* Submission rows nested list (§3.4, §5) */}
                  {isExpanded && (
                    <ul
                      id={`client-group-${group.clientId}`}
                      className="space-y-2 list-none p-0 pl-2 sm:pl-6 m-0"
                    >
                      {group.rows.map((s) => {
                        const wait = relativeWait(s.submitted_at);

                        return (
                          <li key={s.id}>
                            <Link
                              href={`/practitioner/tasks/${s.id}/review?tab=${activeTab.id}`}
                              aria-label={`Review ${taskLabel(s.task_type)} for ${s.client_name ?? group.clientName}`}
                              className={cn(
                                "group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1",
                                "rounded-xl border bg-card px-4 py-3 transition-colors",
                                "hover:border-primary/40 hover:bg-muted/40",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                wait.overdue
                                  ? "border-amber-300 dark:border-amber-800"
                                  : "border-border"
                              )}
                            >
                              {/* Top row: Activity Title */}
                              <div className="flex items-center gap-2 truncate">
                                <span className="truncate text-sm font-semibold text-card-foreground">
                                  {taskLabel(s.task_type)}
                                </span>
                              </div>

                              {/* Top right: Status Pill & Relative Wait */}
                              <div className="flex shrink-0 items-center gap-1.5">
                                <StatusPill status={s.status} />
                                <span
                                  className={cn(
                                    "text-xs text-muted-foreground",
                                    wait.amber && "text-amber-700 dark:text-amber-300 font-medium"
                                  )}
                                >
                                  {wait.text}
                                </span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                              </div>

                              {/* Bottom row: Submitted timestamp, session slot, reflections */}
                              <div className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                <span>{formatSubmittedAt(s.submitted_at)}</span>

                                {/* Session slot (§3.4 & §7 test 7): renders ONLY when session_name present; NULL renders nothing at all */}
                                {s.session_name && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>{s.session_name}</span>
                                  </>
                                )}

                                {/* Attachments/Reflections count */}
                                {s.reflection_count > 0 && (
                                  <span className="inline-flex items-center gap-1">
                                    <span aria-hidden="true">·</span>
                                    <ImageIcon className="h-3 w-3" />
                                    {s.reflection_count} reflection{s.reflection_count !== 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* ================================================================ */}
        {/* Pagination: Keyset Load More                                     */}
        {/* ================================================================ */}
        {!loading && nextCursor && (
          <div className="pt-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="text-xs"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Loading more submissions…
                </>
              ) : (
                "Load more submissions"
              )}
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported Route Component (Wrapped in AuthGuard & DashboardShell)
// ---------------------------------------------------------------------------

export default function PractitionerSubmissionsPage() {
  return (
    <AuthGuard>
      <DashboardShell>
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-muted-foreground">Loading review queue…</span>
            </div>
          }
        >
          <ReviewQueueContent />
        </Suspense>
      </DashboardShell>
    </AuthGuard>
  );
}
