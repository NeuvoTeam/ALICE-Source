"use client"

import { FileText, ScrollText, Sparkles, User, Stethoscope } from "lucide-react"
import { cn } from "@/lib/utils"

type ViewMode = "clinician" | "client"
type ClinicianTab = "vignette" | "summaries"

interface DashboardSidebarProps {
  viewMode: ViewMode
  activeTab: ClinicianTab
  onViewModeChange: (mode: ViewMode) => void
  onTabChange: (tab: ClinicianTab) => void
}

export function DashboardSidebar({ 
  viewMode, 
  activeTab, 
  onViewModeChange, 
  onTabChange 
}: DashboardSidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-sidebar-foreground">MindCare</h1>
          <p className="text-xs text-muted-foreground">Clinical Portal</p>
        </div>
      </div>

      {/* View Mode Switcher */}
      <div className="border-b border-sidebar-border px-3 py-4">
        <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          View
        </p>
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
          <button
            onClick={() => onViewModeChange("clinician")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              viewMode === "clinician"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Stethoscope className="h-4 w-4" />
            Clinician
          </button>
          <button
            onClick={() => onViewModeChange("client")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              viewMode === "client"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="h-4 w-4" />
            Client
          </button>
        </div>
      </div>
      
      {/* Clinician Navigation */}
      {viewMode === "clinician" && (
        <nav className="flex-1 px-3 py-4">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tools
          </p>
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => onTabChange("vignette")}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  activeTab === "vignette"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <FileText className="h-4 w-4" />
                Vignette Generator
              </button>
            </li>
            <li>
              <button
                onClick={() => onTabChange("summaries")}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  activeTab === "summaries"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <ScrollText className="h-4 w-4" />
                Session Summaries
              </button>
            </li>
          </ul>
        </nav>
      )}

      {/* Client Navigation */}
      {viewMode === "client" && (
        <nav className="flex-1 px-3 py-4">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            My Materials
          </p>
          <ul className="space-y-1">
            <li>
              <div className="flex w-full items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-2.5 text-sm font-medium text-sidebar-accent-foreground">
                <FileText className="h-4 w-4" />
                Assigned Vignettes
              </div>
            </li>
          </ul>
        </nav>
      )}

      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-lg bg-muted/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {viewMode === "clinician" 
              ? "AI-assisted documentation for ethical, HIPAA-compliant practice."
              : "Review materials assigned by your care provider."}
          </p>
        </div>
      </div>
    </aside>
  )
}
