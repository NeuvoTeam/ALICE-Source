"use client";

import { useState } from "react";
import { useClientNavStore } from "@/stores/useClientNavStore";
import { DashboardShell } from "@/components/dashboard-shell";
import { MainContent } from "@/components/main-content";
import { ClientView } from "@/components/client-view";
import ClientLanding from "@/components/ClientLanding";
import { useToast } from "@/hooks/use-toast";
import AuthGuard from "@/components/auth-guard";
import type { Client } from "@/types";

type ViewMode = "clinician" | "client";
type ClinicianTab = "vignette" | "summaries";

export default function Dashboard() {
  const [viewMode, setViewMode] =
    useState<ViewMode>("clinician");

  const [activeTab, setActiveTab] =
    useState<ClinicianTab>("vignette");

  const storeClient = useClientNavStore(
    (s) => s.client
  );

  const selectClient = useClientNavStore(
    (s) => s.selectClient
  );

  const clearClient = useClientNavStore(
    (s) => s.clearClient
  );

  const { toast } = useToast();

  const content = !storeClient ? (
    <ClientLanding
      onSelectClient={async (
        client: Client,
        options?: { bootstrap?: boolean }
      ) => {
        await selectClient(
          client.id,
          options
        );

        const {
          client: loaded,
          error,
        } = useClientNavStore.getState();

        if (!loaded) {
          toast({
            title: "Could not open client",
            description:
              error ||
              "Failed to load client profile.",
            variant: "destructive",
          });
        }
      }}
    />
  ) : (
    <DashboardShell
      viewMode={viewMode}
      activeTab={activeTab}
      onViewModeChange={setViewMode}
      onTabChange={setActiveTab}
    >
      {viewMode === "clinician" ? (
        <MainContent
          key={storeClient.id}
          client={storeClient}
          onChangeClient={clearClient}
        />
      ) : (
        <ClientView client={storeClient} />
      )}
    </DashboardShell>
  );

  return (
    <AuthGuard>
      {content}
    </AuthGuard>
  );
}