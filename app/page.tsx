"use client"

import { useState } from "react"
import { useClientNavStore } from "@/stores/useClientNavStore"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { MainContent } from "@/components/main-content"
import { ClientView } from "@/components/client-view"
import ClientLanding from "@/components/ClientLanding"
import { Client } from "@/types"
import { useToast } from "@/hooks/use-toast"

type ViewMode = "clinician" | "client"
type ClinicianTab = "vignette" | "summaries"

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>("clinician")
  const [activeTab, setActiveTab] = useState<ClinicianTab>("vignette")
  const storeClient = useClientNavStore((s) => s.client)
  const selectClient = useClientNavStore((s) => s.selectClient)
  const clearClient = useClientNavStore((s) => s.clearClient)
  const { toast } = useToast()

  if (!storeClient) {
    return (
      <ClientLanding 
        onSelectClient={async (client, options) => {
          await selectClient(client.id, options)
          const { client: loaded, error } = useClientNavStore.getState()
          if (!loaded) {
            toast({
              title: "Could not open client",
              description: error || "Failed to load client profile.",
              variant: "destructive",
            })
          }
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