"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  ScrollText,
  Sparkles,
  User,
  Users,
  Stethoscope,
  ArrowLeftRight,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/auth";
import { CLINICAL_AI_API_BASE } from "@/lib/clinical-ai-api";
import { formatBadgeCount } from "@/lib/review-queue";
import { ClientNode } from "@/components/sidebar/ClientNode";
import LogoutButton from "@/components/logout-button";
import { useClientNavStore } from "@/stores/useClientNavStore";

type ViewMode = "clinician" | "client";
type ClinicianTab = "vignette" | "summaries";

interface DashboardSidebarProps {
  viewMode?: ViewMode;
  activeTab?: ClinicianTab;
  onViewModeChange?: (mode: ViewMode) => void;
  onTabChange?: (tab: ClinicianTab) => void;
}

export function DashboardSidebar({
  viewMode = "clinician",
  activeTab = "vignette",
  onViewModeChange = () => {},
  onTabChange = () => {},
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [pendingTotal, setPendingTotal] = useState<number>(0);

  const client = useClientNavStore((s) => s.client);
  const clearClient = useClientNavStore((s) => s.clearClient);

  // Shell badge: fetches count_only=1 on mount to avoid paginating submission lists.
  // Spec: §4 Browser tab / badge & Constraint 1
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await apiFetch(`${CLINICAL_AI_API_BASE}/tasks/submissions?count_only=1`);
        if (!res.ok) return;
        const data = await res.json();
        if (active && data && typeof data.pending_total === "number") {
          setPendingTotal(data.pending_total);
        }
      } catch {
        // Silently tolerate network/auth failures for shell badge
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const badgeText = formatBadgeCount(pendingTotal);
  const isReviewActive = pathname?.startsWith("/practitioner/submissions") ?? false;
  const isDashboardActive = (pathname === "/dashboard" || pathname === "/") && !isReviewActive;

  const clientInitials = client
    ? client.name
        .split(" ")
        .filter(Boolean)
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "";

  return (
    <aside className="flex h-full w-72 flex-col border-r bg-sidebar text-sidebar-foreground border-sidebar-border shrink-0 select-none">

      {/* BRAND HEADER */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm tracking-tight text-foreground">ALICE</p>
          <p className="text-[10px] font-medium text-muted-foreground tracking-wide uppercase">
            Clinical AI Platform
          </p>
        </div>
      </div>

      {/* VIEW SWITCHER */}
      <div className="border-b border-sidebar-border px-3 py-3">
        <div className="grid grid-cols-2 p-1 gap-1 rounded-lg bg-muted/60 border border-border/50 text-xs">
          <button
            type="button"
            onClick={() => onViewModeChange("clinician")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              viewMode === "clinician"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Stethoscope className="h-3.5 w-3.5" />
            Clinician
          </button>

          <button
            type="button"
            onClick={() => onViewModeChange("client")}
            className={cn(
              "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              viewMode === "client"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="h-3.5 w-3.5" />
            Client
          </button>
        </div>
      </div>

      {/* CLINICIAN WORKSPACE */}
      {viewMode === "clinician" && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">

          {/* MAIN NAVIGATION */}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1.5">
              Workspace
            </p>

            <Link
              href="/dashboard"
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                isDashboardActive && !client
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              )}
            >
              <Users className="h-4 w-4 shrink-0" />
              <span>All Clients</span>
            </Link>

            <Link
              href="/practitioner/submissions"
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-2 text-xs font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                isReviewActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2.5">
                <ClipboardCheck className="h-4 w-4 shrink-0" />
                <span>Review Queue</span>
              </span>
              {badgeText && (
                <span
                  aria-label={`${pendingTotal} pending submissions`}
                  className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground"
                >
                  {badgeText}
                </span>
              )}
            </Link>
          </div>

          {/* ACTIVE CLIENT & CASELOAD TREE */}
          {client ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Active Client
                </p>
                <button
                  type="button"
                  onClick={clearClient}
                  title="Switch to all clients"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeftRight className="h-3 w-3" />
                  <span>Switch</span>
                </button>
              </div>

              {/* ACTIVE CLIENT CARD */}
              <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-2.5 space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                    {clientInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-xs text-foreground truncate">{client.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {client.cases?.length || 0} Cases
                    </p>
                  </div>
                </div>

                <div className="pt-1 border-t border-sidebar-border/60">
                  <ClientNode />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 px-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Caseload Tree
              </p>
              <div className="rounded-lg border border-dashed border-sidebar-border p-3 text-center text-xs text-muted-foreground">
                Select a client from the dashboard to explore case files &amp; sessions.
              </div>
            </div>
          )}

          {/* TOOLS */}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1.5">
              Tools
            </p>

            <button
              type="button"
              onClick={() => onTabChange("vignette")}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                activeTab === "vignette" && client
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              )}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span>Vignette Generator</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange("summaries")}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                activeTab === "summaries" && client
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              )}
            >
              <ScrollText className="h-4 w-4 shrink-0" />
              <span>Session Summaries</span>
            </button>
          </div>
        </div>
      )}

      {/* CLIENT MODE */}
      {viewMode === "client" && (
        <div className="flex-1 px-3 py-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2">
            My Materials
          </p>
          <div className="rounded-lg bg-sidebar-accent px-3 py-2 text-xs font-medium text-sidebar-accent-foreground">
            Assigned Vignettes &amp; Tasks
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="mt-auto border-t border-sidebar-border p-3 space-y-2">
        <LogoutButton />

        <div className="flex items-center justify-center gap-1.5 px-2 py-1 rounded-md bg-muted/30 text-[10px] text-muted-foreground font-medium">
          <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="whitespace-nowrap">APP 8 &amp; TGA Compliant</span>
        </div>
      </div>

    </aside>
  );
}
