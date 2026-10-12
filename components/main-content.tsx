"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import dynamic from "next/dynamic";
import {
  Loader2,
  AlertCircle,
  PanelLeft,
  PanelLeftClose,
} from "lucide-react";
import { useSidebar } from "@/components/dashboard-shell";
import { CLINICAL_AI_API_BASE as API_BASE } from "@/lib/clinical-ai-api";
import { apiFetch } from "@/lib/auth";
import { Client } from "@/types";
import { useClientNavStore, type Session, type Case } from "@/stores/useClientNavStore";

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

  const { client: navClient, createCase, createSession, selectSession } = useClientNavStore();

  const cases: Case[] = navClient?.cases || [];
  const totalSessions = cases.reduce((acc: number, c: Case) => acc + (c.sessions?.length || 0), 0);

  const { isOpen, toggleSidebar } = useSidebar();

  return (
    <main className="flex-1 min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">

      {/* HEADER BREADCRUMB / ACTION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="h-9 w-9 p-0 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-lg shrink-0"
            title={isOpen ? "Collapse navigation sidebar" : "Expand navigation sidebar"}
            aria-label={isOpen ? "Collapse navigation sidebar" : "Expand navigation sidebar"}
          >
            {isOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeft className="h-5 w-5" />
            )}
          </Button>

          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Client Workspace
              </span>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-xs font-medium text-foreground truncate">
                {client.name}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
              {client.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onChangeClient}
            className="h-9 text-xs font-medium"
          >
            Switch Client
          </Button>

          <Button
            size="sm"
            onClick={() => void createCase()}
            className="h-9 text-xs font-semibold shadow-xs"
          >
            + New Case File
          </Button>
        </div>
      </div>

      {/* ERROR BANNER */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs font-medium text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* TABS CONTAINER */}
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">

        <TabsList className="bg-muted/60 p-1 border border-border/50">
          <TabsTrigger value="generate" className="text-xs font-medium data-[state=active]:font-semibold">
            Session Workbench
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs font-medium data-[state=active]:font-semibold">
            Session History
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs font-medium data-[state=active]:font-semibold">
            Configuration
          </TabsTrigger>
        </TabsList>

        {/* SESSION TAB */}
        <TabsContent value="generate" className="focus-visible:outline-none space-y-6">
          {selectedCaseId && selectedSessionId ? (
            <VignetteGenerator
              key={selectedSessionId}
              clientId={CLIENT_ID}
              caseId={selectedCaseId}
              sessionId={selectedSessionId}
              sessionName={selectedSession?.name}
            />
          ) : (
            /* CLIENT OVERVIEW DASHBOARD WHEN NO SESSION IS SELECTED */
            <div className="space-y-6">
              {/* STATS STRIP */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="border-border/70 shadow-xs">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Case Files</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{cases.length}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Active formulations</p>
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-xs">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Sessions</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{totalSessions}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Clinical encounters</p>
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-xs">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Practice Package</p>
                    <p className="text-2xl font-bold text-foreground mt-1">Ready</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">AI worksheets enabled</p>
                  </CardContent>
                </Card>
              </div>

              {/* CASE & SESSION EXPLORER */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-foreground">
                    Clinical Cases &amp; Encounters
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    Select a session to launch the dual-pane workbench
                  </span>
                </div>

                {cases.length === 0 ? (
                  <Card className="border-dashed bg-muted/20">
                    <CardContent className="py-12 text-center space-y-3">
                      <p className="text-sm font-medium text-foreground">No clinical cases established yet</p>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        Create an intake or case file to begin recording session notes and generating AI practice tasks.
                      </p>
                      <Button size="sm" onClick={() => void createCase()}>
                        Create Intake Case
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {cases.map((c: Case) => {
                      const caseSessions = c.sessions || [];
                      return (
                        <Card key={c.id} className="border-border/70 shadow-xs overflow-hidden">
                          <CardHeader className="bg-muted/30 py-3.5 px-5 border-b flex flex-row items-center justify-between">
                            <div>
                              <CardTitle className="text-sm font-semibold text-foreground">
                                {c.name}
                              </CardTitle>
                              <CardDescription className="text-xs">
                                {caseSessions.length} {caseSessions.length === 1 ? "Session" : "Sessions"}
                              </CardDescription>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void createSession(c.id)}
                              className="h-8 text-xs"
                            >
                              + New Session
                            </Button>
                          </CardHeader>

                          <CardContent className="p-4">
                            {caseSessions.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-2 text-center">
                                No sessions in this case yet. Click &quot;+ New Session&quot; to begin.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                                {caseSessions.map((sess: Session) => (
                                  <div
                                    key={sess.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => void selectSession(c.id, sess.id)}
                                    className="group flex items-center justify-between p-3 rounded-lg border border-border/60 bg-card hover:border-foreground/30 hover:shadow-xs transition-all cursor-pointer"
                                  >
                                    <div className="min-w-0 space-y-0.5">
                                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                        {sess.name}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">
                                        Open session workbench
                                      </p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 shrink-0 text-muted-foreground group-hover:text-foreground"
                                    >
                                      →
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="focus-visible:outline-none">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base font-semibold">Session History</CardTitle>
              <CardDescription className="text-xs">
                Archived clinical runs and previous AI practice packages for {client.name}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : savedVignettes.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No prior session records found for this client.</p>
              ) : (
                <div className="divide-y rounded-xl border">
                  {savedVignettes.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 text-xs"
                    >
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground">{entry.name || `Session ${i + 1}`}</p>
                        <p className="text-muted-foreground">
                          {entry.created_at ? new Date(entry.created_at).toLocaleString() : "Date not recorded"}
                        </p>
                      </div>
                      <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md dark:bg-emerald-950/40 dark:text-emerald-300">
                        Completed
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings" className="focus-visible:outline-none">
          <Card className="border-border/70 shadow-xs">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base font-semibold">Workspace Configuration</CardTitle>
              <CardDescription className="text-xs">
                Environment endpoints and patient routing identifiers
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6 space-y-3 text-xs">
              <div className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3 border">
                <span className="font-semibold text-muted-foreground">Worker API Endpoint</span>
                <span className="font-mono text-foreground break-all">{API_BASE}</span>
              </div>

              <div className="flex flex-col gap-1 rounded-lg bg-muted/40 p-3 border">
                <span className="font-semibold text-muted-foreground">Patient Identifier (UUID)</span>
                <span className="font-mono text-foreground break-all">{CLIENT_ID}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

    </main>
  );
}
