"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import dynamic from "next/dynamic";
import {
  Loader2,
  AlertCircle,
} from "lucide-react";
import { CLINICAL_AI_API_BASE as API_BASE } from "@/lib/clinical-ai-api";
import { Client } from "@/types";
import { useClientNavStore } from "@/stores/useClientNavStore";

const VignetteGenerator = dynamic(() => import("./vignette-generator"), {
  ssr: false,
});

type Vignette = any;

export function MainContent({
  activeTab,
  client,
  onChangeClient,
}: {
  activeTab: "vignette" | "summaries";
  client: Client;
  onChangeClient: () => void;
}) {
  const [savedVignettes, setSavedVignettes] = useState<Vignette[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("generate");

  const CLIENT_ID = client.id.toString();

  const selectedCaseId = useClientNavStore((s) => s.selectedCaseId);
  const selectedSessionId = useClientNavStore((s) => s.selectedSessionId);

  // ✅ SAFE selectedSession (FIXED)
  const selectedSession = useClientNavStore((s) => {
    if (!s.client || !s.selectedCaseId || !s.selectedSessionId) {
      return null;
    }

    const cases = s.client.cases || [];
    const caseData = cases.find((c) => c.id === s.selectedCaseId);

    const sessions = caseData?.sessions || [];

    return (
      sessions.find((sess) => sess.id === s.selectedSessionId) || null
    );
  });

  const fetchVignettes = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/sessions?clientId=${client.id}`
      );

      const data = await res.json();

      if (Array.isArray(data)) {
        setSavedVignettes(data);
      } else if (data) {
        setSavedVignettes([data]);
      } else {
        setSavedVignettes([]);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load sessions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVignettes();
  }, [client.id, selectedSessionId]);

  return (
    <main className="flex-1 p-6 space-y-6">

      {/* HEADER */}
      <div className="flex justify-between items-center border-b pb-4">
        <h1 className="text-xl font-bold">
          {client.name} Dashboard
        </h1>

        <button
          onClick={onChangeClient}
          className="border px-3 py-1 rounded"
        >
          Change Client
        </button>
      </div>

      {/* ERROR */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>

        <TabsList>
          <TabsTrigger value="generate">Session</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* SESSION TAB */}
        <TabsContent value="generate">
          {selectedCaseId && selectedSessionId ? (
            <VignetteGenerator
              key={selectedSessionId}
              clientId={CLIENT_ID}
              caseId={selectedCaseId}
              sessionId={selectedSessionId}
              sessionName={selectedSession?.name}
            />
          ) : (
            <Card>
              <CardContent className="py-10 text-center">
                Select a session in the sidebar
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : savedVignettes.length === 0 ? (
                <p>No data yet</p>
              ) : (
                <div className="space-y-2">
                  {savedVignettes.map((entry, i) => (
                    <div
                      key={i}
                      className="p-2 border rounded"
                    >
                      {entry.created_at || "No date"}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Config</CardTitle>
            </CardHeader>

            <CardContent>
              <p>API: {API_BASE}</p>
              <p>Client: {CLIENT_ID}</p>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

    </main>
  );
}
``