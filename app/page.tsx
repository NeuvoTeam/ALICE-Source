"use client"

import { useState } from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { MainContent } from "@/components/main-content"
import { ClientView } from "@/components/client-view"

type ViewMode = "clinician" | "client"
type ClinicianTab = "vignette" | "summaries"

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>("clinician")
  const [activeTab, setActiveTab] = useState<ClinicianTab>("vignette")

  return (
    <div className="flex h-screen">
      <DashboardSidebar 
        viewMode={viewMode}
        activeTab={activeTab}
        onViewModeChange={setViewMode}
        onTabChange={setActiveTab}
      />
      {viewMode === "clinician" ? (
        <MainContent activeTab={activeTab} />
      ) : (
        <ClientView />
      )}
    </div>
  )
}
