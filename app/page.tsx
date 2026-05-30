"use client"

import { useState } from "react"
import { useClientNavStore } from "@/stores/useClientNavStore";
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { MainContent } from "@/components/main-content"
import { ClientView } from "@/components/client-view"
import ClientLanding from "@/components/ClientLanding"
import { Client } from "@/types";

type ViewMode = "clinician" | "client"
type ClinicianTab = "vignette" | "summaries"

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>("clinician")
  const [activeTab, setActiveTab] = useState<ClinicianTab>("vignette")
  const storeClient = useClientNavStore((s) => s.client);
  const selectClient = useClientNavStore((s) => s.selectClient);
  const setClientInStore = useClientNavStore((s) => s.selectClient);
  const clearClient = useClientNavStore((s) => s.clearClient);

  // ✅ Show client picker first
  if (!storeClient) {
    return (
      <ClientLanding 
        onSelectClient={(client) => {
          selectClient(client.id);
        }} 
      />
    )
  }
  

  return (
    <div className="flex h-screen">
      <DashboardSidebar 
        viewMode={viewMode}
        activeTab={activeTab}
        onViewModeChange={setViewMode}
        onTabChange={setActiveTab}
      />

      {viewMode === "clinician" ? (
        <MainContent 
          key={storeClient.id}
          activeTab={activeTab}
          client={storeClient}
          onChangeClient={clearClient}
        />
      ) : (
        <ClientView client={storeClient} />
      )}
    </div>
  )
}