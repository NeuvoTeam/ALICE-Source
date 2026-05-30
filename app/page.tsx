"use client"

import { useState } from "react"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { MainContent } from "@/components/main-content"
import { ClientView } from "@/components/client-view"
import ClientLanding from "@/components/ClientLanding"

type Client = {
  id: number;
  name: string;
};

type ViewMode = "clinician" | "client"
type ClinicianTab = "vignette" | "summaries"

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>("clinician")
  const [activeTab, setActiveTab] = useState<ClinicianTab>("vignette")
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)

  // ✅ If NO client selected → show landing page
  if (!selectedClient) {
    return <ClientLanding onSelectClient={setSelectedClient} />
  }

  // ✅ If client selected → show your dashboard
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