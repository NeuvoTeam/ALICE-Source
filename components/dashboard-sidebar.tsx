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
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/auth";
import { CLINICAL_AI_API_BASE } from "@/lib/clinical-ai-api";
import { formatBadgeCount } from "@/lib/review-queue";
import { ClientNode } from "@/components/sidebar/ClientNode";
import LogoutButton from "@/components/logout-button";

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
  return (
    <aside className="flex h-full w-64 flex-col border-r bg-sidebar text-sidebar-foreground border-sidebar-border shrink-0">

      {/* HEADER */}
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-semibold">ALICE</p>
        </div>
      </div>

      {/* VIEW SWITCH */}
      <div className="border-b px-3 py-3">
        <p className="text-xs text-muted-foreground px-2 mb-2">View</p>

        <div className="flex gap-2">
          <button
            onClick={() => onViewModeChange("clinician")}
            className={cn(
              "flex-1 text-sm px-3 py-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              viewMode === "clinician"
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "hover:bg-sidebar-accent/50"
            )}
          >
            <Stethoscope className="inline h-4 w-4 mr-1" />
            Clinician
          </button>

          <button
            onClick={() => onViewModeChange("client")}
            className={cn(
              "flex-1 text-sm px-3 py-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              viewMode === "client"
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "hover:bg-sidebar-accent/50"
            )}
          >
            <User className="inline h-4 w-4 mr-1" />
            Client
          </button>
        </div>
      </div>

      {/* CLINICIAN MODE */}
      {viewMode === "clinician" && (
        <div className="flex-1 overflow-y-auto">

          {/* NAVIGATION */}
          <div className="px-3 py-3 border-b border-sidebar-border space-y-1">
            <Link
              href="/dashboard"
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                isDashboardActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "hover:bg-sidebar-accent/50"
              )}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/practitioner/submissions"
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                isReviewActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "hover:bg-sidebar-accent/50"
              )}
            >
              <span className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                <span>Review</span>
              </span>
              {badgeText && (
                <span
                  aria-label={`${pendingTotal} pending submissions`}
                  className="rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"
                >
                  {badgeText}
                </span>
              )}
            </Link>
          </div>

          {/* CLIENT / CASE / SESSION TREE */}
          <div className="px-3 py-3">
            <p className="text-xs text-muted-foreground mb-2">Clients</p>

            {/* ✅ IMPORTANT: this must NOT handle routing */}
            <ClientNode />
          </div>

          {/* TOOLS */}
          <div className="px-3 py-3">
            <p className="text-xs text-muted-foreground mb-2">Tools</p>

            <button
              onClick={() => onTabChange("vignette")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                activeTab === "vignette"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "hover:bg-sidebar-accent/50"
              )}
            >
              <FileText className="h-4 w-4" />
              Vignette Generator
            </button>

            <button
              onClick={() => onTabChange("summaries")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                activeTab === "summaries"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "hover:bg-sidebar-accent/50"
              )}
            >
              <ScrollText className="h-4 w-4" />
              Session Summaries
            </button>
          </div>
        </div>
      )}

      {/* CLIENT MODE */}
      {viewMode === "client" && (
        <div className="flex-1 px-3 py-3">
          <p className="text-xs text-muted-foreground mb-2">My Materials</p>

          <div className="rounded-md bg-sidebar-accent px-3 py-2 text-sm text-sidebar-accent-foreground">
            Assigned Vignettes
          </div>
        </div>
      )}


      {/* FOOTER */}
      <div className="mt-auto border-t border-sidebar-border px-3 py-2">
        <LogoutButton />

        <div className="mt-2 text-center text-[11px] text-muted-foreground">
          {viewMode === "clinician"
            ? "Powered by ALICE v1.1"
            : "Client learning materials"}
        </div>
      </div>

    </aside>
  );
}
