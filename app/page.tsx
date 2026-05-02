"use client"

import { useState } from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { MainContent } from "@/components/main-content"
import { ClientView } from "@/components/client-view"
import { useClinicalWorkspace } from "@/hooks/use-clinical-workspace"

type ViewMode = "clinician" | "client"
type ClinicianTab = "vignette" | "summaries"

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>("clinician")
  const [activeTab, setActiveTab] = useState<ClinicianTab>("vignette")
  const clinicalWorkspace = useClinicalWorkspace()

  return (
    <div className="flex h-screen min-h-0">
      <DashboardSidebar
        viewMode={viewMode}
        activeTab={activeTab}
        onViewModeChange={setViewMode}
        onTabChange={setActiveTab}
        clinicalWorkspace={clinicalWorkspace}
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {viewMode === "clinician" ? (
          <MainContent activeTab={activeTab} workspace={clinicalWorkspace} />
        ) : (
          <ClientView />
        )}
      </div>
    </div>
  )
}
