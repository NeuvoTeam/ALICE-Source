"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import {
  Loader2,
  AlertCircle,
} from "lucide-react";
import { CLINICAL_AI_API_BASE as API_BASE } from "@/lib/clinical-ai-api";
import { apiFetch } from "@/lib/auth";
import { Client } from "@/types";
import { useClientNavStore, type Session } from "@/stores/useClientNavStore";

const VignetteGenerator = dynamic(() => import("./vignette-generator"), {
  ssr: false,
});

/** `GET /sessions?clientId=` row (`formatSessionRow`, backend/CloudFlare.js:2469): the app's
 *  Session plus the DB timestamp the History tab renders. */
type Vignette = Session & { created_at: string | null };

export function MainContent({
  client,
  onChangeClient,
}: {
  client: Client;
  onChangeClient: () => void;
}) {
  const [savedVignettes, setSavedVignettes] = useState<Vignette[]>([]);
  // Loading and the failure banner are derived from the request key (see `requestKey` below),
  // not pre-set synchronously inside the effect (lint rank 8g, register row B9).
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
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

  /**
   * The request key ties each response to the client/session pair it belongs to. `isLoading`
   * and the error banner are derived from it, so a response for a key that is no longer
   * current is ignored rather than written through a synchronous pre-set. The pre-sets the
   * triage register recorded here were not bail-outs: `isLoading` starts `false`, and a
   * previous failure was only ever cleared at the head of the next fetch (lint rank 8g,
   * register row B9; the same edit clears row B10, the missing dependency).
   */
  const requestKey = `${CLIENT_ID}:${selectedSessionId ?? ""}`;

  const fetchVignettes = useCallback(async () => {
    try {
      const res = await apiFetch(
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

      // Cleared on success, not at the head of the next fetch, so a failure that is never
      // retried cannot leave a stale banner behind.
      setError(null);
    } catch (err) {
      console.error("Fetch error:", err);
      setError({ key: requestKey, message: "Failed to load sessions" });
    } finally {
      setLoadedKey(requestKey);
    }
  }, [client.id, requestKey]);

  useEffect(() => {
    // The loader runs as this effect's own async task: nothing is written synchronously in
    // the effect body (lint rank 8g, register rows B9/B10).
    void (async () => {
      await fetchVignettes();
    })();
  }, [fetchVignettes]);

  const isLoading = loadedKey !== requestKey;
  const errorMessage = error && error.key === requestKey ? error.message : null;

  return (
    <main className="flex-1 min-w-0 space-y-6 p-4 sm:p-6">

      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <h1 className="text-xl font-bold min-w-0 break-words">
          {client.name} Dashboard
        </h1>

        <Button
          variant="outline"
          size="sm"
          onClick={onChangeClient}
          className="shrink-0"
        >
          Change Client
        </Button>
      </div>

      {/* ERROR */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="h-4 w-4" />
          <span>{errorMessage}</span>
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
                <p className="text-sm text-muted-foreground">No data yet</p>
              ) : (
                <div className="space-y-2">
                  {savedVignettes.map((entry, i) => (
                    <div
                      key={i}
                      className="rounded-lg border p-3 text-sm break-words"
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

            <CardContent className="space-y-1 text-sm text-muted-foreground">
              <p className="break-all">API: {API_BASE}</p>
              <p className="break-words">Client: {CLIENT_ID}</p>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

    </main>
  );
}
