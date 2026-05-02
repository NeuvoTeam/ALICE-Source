"use client"

import { useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import dynamic from "next/dynamic"
import type { ClinicalWorkspace } from "@/hooks/use-clinical-workspace"
import { SessionHistoryPanel } from "@/components/session-history-panel"
import { buildVignetteRestoreFromSession } from "@/lib/vignette-restore"

const VignetteGenerator = dynamic(() => import("./vignette-generator"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  ),
})
import { History, LayoutDashboard, Settings } from "lucide-react"

type ClinicianTab = "vignette" | "summaries"

export function MainContent({
  activeTab = "vignette",
  workspace,
}: {
  activeTab?: ClinicianTab
  workspace: ClinicalWorkspace
}) {
  const {
    clientIdForApi,
    sessionContextKey,
    sessionNotes,
    selectedSession,
    persistSessionNotes,
    persistSessionAnalysis,
    persistSessionWorksheet,
  } = workspace

  const API_BASE = process.env.NEXT_PUBLIC_CLINICAL_AI_API_BASE

  const vignetteRestore = useMemo(
    () => buildVignetteRestoreFromSession(selectedSession, sessionNotes),
    [selectedSession, sessionNotes],
  )

  const historyPanel = <SessionHistoryPanel workspace={workspace} />

  return (
    <main className="container mx-auto max-w-6xl space-y-8 px-4 py-10">
      <div className="flex flex-col items-start justify-between gap-4 border-b pb-8 md:flex-row md:items-center">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900">
            Clinical <span className="text-primary">Dashboard</span>
          </h1>
          <p className="font-medium text-zinc-500">
            Professional Session Analysis & Vignette Generation
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border bg-zinc-100 px-4 py-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          <span className="text-xs font-bold tracking-widest text-zinc-600 uppercase">
            System Active
          </span>
        </div>
      </div>

      {activeTab === "summaries" ? (
        historyPanel
      ) : (
        <Tabs defaultValue="generate" className="w-full space-y-6">
          <TabsList className="grid h-12 w-full max-w-md grid-cols-3 rounded-xl bg-zinc-100 p-1">
            <TabsTrigger
              value="generate"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <LayoutDashboard className="mr-2 h-4 w-4" /> New Case
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <History className="mr-2 h-4 w-4" /> History
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <Settings className="mr-2 h-4 w-4" /> Config
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4">
            <VignetteGenerator
              key={sessionContextKey || "ctx"}
              clientId={clientIdForApi}
              initialSessionNotes={sessionNotes}
              vignetteRestore={vignetteRestore}
              onSessionNotesChange={persistSessionNotes}
              onAnalysisComplete={persistSessionAnalysis}
              onWorksheetGenerated={persistSessionWorksheet}
            />
          </TabsContent>

          <TabsContent value="history">{historyPanel}</TabsContent>

          <TabsContent value="settings">
            <Card className="rounded-3xl border-2">
              <CardHeader>
                <CardTitle>Engine Configuration</CardTitle>
                <CardDescription>
                  Verify your Cloudflare Worker and Heidi API connection.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border bg-zinc-50 p-4 font-mono text-xs break-all">
                  <span className="text-zinc-400">ENDPOINT:</span> {API_BASE || "NOT_SET"}
                </div>
                <div className="rounded-xl border bg-zinc-50 p-4 font-mono text-xs">
                  <span className="text-zinc-400">CLIENT_ID (selected folder):</span>{" "}
                  {clientIdForApi || "—"}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </main>
  )
}
