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
import { Client } from "@/types";

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

  // ✅ Use selected client
  const CLIENT_ID = client.id.toString()

  const fetchVignettes = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const res = await fetch(`${API_BASE}/latest-session?clientId=${client.id}`)
      const text = await res.text()

      if (text.includes("error code: 1016")) {
        setError("Cloudflare Engine is warming up. Please wait 30 seconds.")
        return
      }

      if (text.startsWith("[") || text.startsWith("{")) {
        const data = JSON.parse(text)
        setSavedVignettes(data)
      }
    } catch (err) {
      console.error("Failed to fetch vignettes:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchVignettes()
  }, [client.id])

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

      <Tabs defaultValue="generate" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md h-12 p-1 bg-zinc-100 rounded-xl">
          <TabsTrigger value="generate">
            <LayoutDashboard className="h-4 w-4 mr-2" /> New Case
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" /> History
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" /> Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <VignetteGenerator clientId={CLIENT_ID} />
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
                <div>{savedVignettes.length} entries found</div>
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