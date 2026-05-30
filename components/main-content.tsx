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
import dynamic from 'next/dynamic'

// This tells Next.js to load the component ONLY on the client (MacBook screen)
// and skip trying to "build" it on the server.
const VignetteGenerator = dynamic(() => import("./vignette-generator"), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  )
})
import { History, LayoutDashboard, Settings, Loader2, AlertCircle } from "lucide-react"
import { CLINICAL_AI_API_BASE as API_BASE } from "@/lib/clinical-ai-api"

export function MainContent({ activeTab }: { activeTab: "vignette" | "summaries" }) {
  const [savedVignettes, setSavedVignettes] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || "default-user"

  const fetchVignettes = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const res = await fetch(`${API_BASE}/latest-session`)
      const text = await res.text()

      // FIX: Check if Cloudflare sent an error page instead of JSON
      if (text.includes("error code: 1016")) {
        setError("Cloudflare Engine is warming up. Please wait 30 seconds.")
        return
      }

      // Only parse if the response looks like a JSON array or object
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
  }, [])

  return (
    <main className="container mx-auto py-10 px-4 max-w-6xl space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-900">
            Clinical <span className="text-primary">Dashboard</span>
          </h1>
          <p className="text-zinc-500 font-medium">Professional Session Analysis & Vignette Generation</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-full border">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-bold text-zinc-600 uppercase tracking-widest">System Active</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="h-5 w-5" />
          <p className="font-semibold">{error}</p>
        </div>
      )}

      <Tabs defaultValue="generate" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md h-12 p-1 bg-zinc-100 rounded-xl">
          <TabsTrigger value="generate" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <LayoutDashboard className="h-4 w-4 mr-2" /> New Case
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <History className="h-4 w-4 mr-2" /> History
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Settings className="h-4 w-4 mr-2" /> Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          <VignetteGenerator clientId={CLIENT_ID} />
        </TabsContent>

        <TabsContent value="history">
          <Card className="rounded-3xl border-2">
            <CardHeader>
              <CardTitle>Clinical History</CardTitle>
              <CardDescription>Review and download previously generated worksheets.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex flex-col items-center py-20 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-zinc-400">Querying Clinical Database...</p>
                </div>
              ) : savedVignettes.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed rounded-3xl">
                  <p className="text-zinc-400 font-medium">No vignettes generated yet for this client ID.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {/* Map through history here */}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="settings">
          <Card className="rounded-3xl border-2">
            <CardHeader>
              <CardTitle>Engine Configuration</CardTitle>
              <CardDescription>Verify your Cloudflare Worker and Heidi API connection.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-zinc-50 border text-xs font-mono break-all">
                <span className="text-zinc-400">ENDPOINT:</span> {API_BASE}
              </div>
              <div className="p-4 rounded-xl bg-zinc-50 border text-xs font-mono">
                <span className="text-zinc-400">CLIENT_ID:</span> {CLIENT_ID}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </main>
  )
}