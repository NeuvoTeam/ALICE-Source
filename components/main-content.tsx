"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card"
import dynamic from "next/dynamic"
import { History, LayoutDashboard, Settings, Loader2, AlertCircle } from "lucide-react"
import { CLINICAL_AI_API_BASE as API_BASE } from "@/lib/clinical-ai-api"
import { Client } from "@/types"
import { useClientNavStore } from "@/stores/useClientNavStore"

// ✅ Load generator safely (client only)
const VignetteGenerator = dynamic(() => import("./vignette-generator"), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
})

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
  const [savedVignettes, setSavedVignettes] = useState<Vignette[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState("generate")
  const CLIENT_ID = client.id.toString()
  const selectedCaseId = useClientNavStore((s) => s.selectedCaseId)
  const selectedSessionId = useClientNavStore((s) => s.selectedSessionId)
  const selectedSession = useClientNavStore((s) => {
    if (!s.client || !s.selectedCaseId || !s.selectedSessionId) return null
    const caseData = s.client.cases.find((c) => c.id === s.selectedCaseId)
    return caseData?.sessions.find((sess) => sess.id === s.selectedSessionId) ?? null
  })

  const fetchVignettes = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const sessionQuery = selectedSessionId
        ? `sessionId=${selectedSessionId}`
        : `clientId=${client.id}`
      const res = await fetch(`${API_BASE}/sessions?clientId${client.id}`)
      const text = await res.text()

      if (text.includes("error code: 1016")) {
        setError("Cloudflare Engine is warming up. Please wait 30 seconds.")
        return
      }

      if (text.startsWith("[") || text.startsWith("{")) {
        const data = JSON.parse(text)
        if (Array.isArray(data)) {
          setSavedVignettes(data)
        } else if (data) {
          setSavedVignettes([data])
        } else {
          setSavedVignettes([])
        }

      }
    } catch (err) {
      console.error("Failed to fetch vignettes:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchVignettes()
  }, [client.id, selectedSessionId])

  const handleLoadSession = (entry: any) => {
    console.log("Loading session:", entry)

    // store values so generator can pick them up
    localStorage.setItem("loadedNotes", entry.sessionNotes || "")
    localStorage.setItem("loadedMethodology", entry.modality || "")
    localStorage.setItem("loadedVignette", entry.vignette || "")

    // optional: attach session ID so generator fetches correct one
    if (entry.caseId && entry.sessionId) {
      useClientNavStore.getState().selectSession(entry.caseId, entry.sessionId)
    }
    console.log("Selected session:", useClientNavStore.getState().selectedSessionId)

    setTab("generate")
  }

  return (
    <main className="container mx-auto py-10 px-4 max-w-6xl space-y-8">

      {/* ✅ FIXED HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900">
            {client.name} <span className="text-primary">Dashboard</span>
          </h1>
          <p className="text-zinc-500 font-medium">
            Professional Session Analysis & Vignette Generation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-full border">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest">
              System Active
            </span>
          </div>

          <button
            onClick={onChangeClient}
            className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-gray-100 transition"
          >
            Change Client
          </button>
        </div>
      </div>

      {/* ✅ ERROR */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm">
          <AlertCircle className="h-5 w-5" />
          <p className="font-semibold">{error}</p>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md h-12 p-1 bg-zinc-100 rounded-xl">
          <TabsTrigger value="generate">
            <LayoutDashboard className="h-4 w-4 mr-2" /> Session Details
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" /> History
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" /> Config
          </TabsTrigger>
        </TabsList>

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
              <CardContent className="py-12 text-center text-muted-foreground">
                Select a session in the sidebar to add notes and generate a vignette.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Clinical History</CardTitle>
              <CardDescription>Previous work for this client</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loader2 className="animate-spin" />
              ) : savedVignettes.length === 0 ? (
                <p>No data yet</p>
              ) : (
                <div className="space-y-3">
                {Array.isArray(savedVignettes) && savedVignettes.map((entry, i) => (
                  console.log("ENTRY:", entry),
                  <div
                    key={i}
                    onClick={() => handleLoadSession(entry)}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                  >
                    <div className="text-sm font-semibold">
                    {entry.created_at || entry.updatedAt
                      ? new Date(entry.created_at || entry.updatedAt).toLocaleString()
                      : "No date available"}

                      
                    </div>
                  </div>
                ))}
              </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Config</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs">API: {API_BASE}</p>
              <p className="text-xs">Client: {CLIENT_ID}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

    </main>
  )
}