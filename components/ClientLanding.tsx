"use client"

import { useEffect, useState, FormEvent } from "react"
import { CLINICAL_AI_API_BASE as API_BASE } from "@/lib/clinical-ai-api"
import { Client } from "@/types"
import { useToast } from "@/hooks/use-toast"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Plus,
  Search,
  RefreshCw,
  User,
  ChevronRight,
  UserPlus,
  Sparkles,
  Loader2,
} from "lucide-react"

// Helper to get initials from a client name (e.g. "John Doe" -> "JD")
function getInitials(name: string) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// Visual avatar gradients for the client list
const AVATAR_GRADIENTS = [
  "from-blue-500/20 to-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-900/50",
  "from-emerald-500/20 to-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-100 dark:border-teal-900/50",
  "from-violet-500/20 to-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-900/50",
  "from-rose-500/20 to-pink-500/20 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-900/50",
  "from-amber-500/20 to-orange-500/20 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/50",
  "from-cyan-500/20 to-blue-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-100 dark:border-cyan-900/50",
]

function getAvatarStyles(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length
  return AVATAR_GRADIENTS[index]
}

export default function ClientLanding({
  onSelectClient,
}: {
  onSelectClient: (client: Client) => void
}) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Dialog & creation states
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newClientName, setNewClientName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [validationError, setValidationError] = useState("")

  const { toast } = useToast()

  const fetchClients = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/clients`)
      
      if (!res.ok) {
        throw new Error("Failed to fetch clients")
      }

      const data = await res.json()
      console.log("✅ Clients from Worker:", data)
      setClients(data)
    } catch (err) {
      console.error("❌ Client fetch failed:", err)
      toast({
        title: "Connection Error",
        description: "Failed to retrieve the list of clients from the database.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const handleCreateClient = async (e: FormEvent) => {
    e.preventDefault()

    const trimmedName = newClientName.trim()
    if (!trimmedName) {
      setValidationError("Client name cannot be empty.")
      return
    }

    setIsCreating(true)
    setValidationError("")

    try {
      const res = await fetch(`${API_BASE}/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        const errMsg = errData?.error || errData?.message || await res.text().catch(() => "") || "Server error"
        throw new Error(errMsg)
      }

      const createdClient = await res.json()

      toast({
        title: "Success",
        description: `Client "${trimmedName}" created successfully.`,
      })

      setIsDialogOpen(false)
      setNewClientName("")

      // Select the client immediately to redirect to their dashboard
      onSelectClient(createdClient)
    } catch (err: any) {
      console.error("❌ Failed to create client:", err)
      toast({
        title: "Creation Failed",
        description: err.message || "Could not add a new client to the database. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  // Filter clients locally by search term
  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="relative min-h-screen bg-linear-to-br from-zinc-50 via-zinc-100 to-indigo-50/30 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex flex-col items-center justify-center p-4 sm:p-6 md:p-10">
      {/* Decorative subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Main glass card container */}
      <Card className="w-full max-w-lg bg-card/75 backdrop-blur-md border border-border/80 shadow-xl rounded-2xl relative z-10 transition-all duration-300">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/25 border border-primary/20 animate-pulse">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <div className="text-center space-y-1.5">
            <CardTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-700 dark:from-zinc-50 dark:to-zinc-300 bg-clip-text text-transparent">
              ALICE MindCare
            </CardTitle>
            <CardDescription className="text-sm font-medium text-muted-foreground max-w-sm mx-auto">
              Select an active client profile or register a new client to begin documentation and clinical analysis.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Controls: Search, Refresh, and Add Client */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-background/50 border-muted-foreground/20 focus-visible:ring-primary"
              />
            </div>

            {/* Manual list refresh */}
            <Button
              variant="outline"
              size="icon"
              onClick={fetchClients}
              disabled={loading}
              title="Refresh Client List"
              className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>

            {/* Add Client Dialog Trigger */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  className="h-10 gap-1.5 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold shadow-xs"
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Client</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md border-border/80 shadow-2xl bg-card">
                <form onSubmit={handleCreateClient}>
                  <DialogHeader className="space-y-1">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-primary" />
                      Add New Client
                    </DialogTitle>
                    <DialogDescription>
                      Create a new client profile. A default case formulation and session tree can be initialized within their profile dashboard.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="py-4 space-y-2">
                    <Label htmlFor="client-name" className="text-sm font-semibold">
                      Client Full Name
                    </Label>
                    <Input
                      id="client-name"
                      placeholder="e.g. John Doe"
                      value={newClientName}
                      onChange={(e) => {
                        setNewClientName(e.target.value)
                        if (e.target.value.trim()) setValidationError("")
                      }}
                      className="bg-background/50 focus-visible:ring-primary border-muted-foreground/25"
                      autoFocus
                      disabled={isCreating}
                    />
                    {validationError && (
                      <p className="text-xs font-semibold text-destructive mt-1">
                        {validationError}
                      </p>
                    )}
                  </div>

                  <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false)
                        setNewClientName("")
                        setValidationError("")
                      }}
                      disabled={isCreating}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isCreating}
                      className="gap-1.5 min-w-[100px]"
                    >
                      {isCreating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Client"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Client List */}
          <div className="border border-border/50 rounded-xl overflow-hidden bg-background/30 backdrop-blur-xs">
            <div className="max-h-[320px] overflow-y-auto divide-y divide-border/40 scrollbar-thin">
              {loading ? (
                // Loading Skeletons
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="flex items-center gap-3 animate-pulse">
                      <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-sm w-1/3" />
                        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-sm w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredClients.length === 0 ? (
                // Empty state
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
                    <User className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {searchQuery ? "No clients match search" : "No clients registered"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                    {searchQuery
                      ? "Try typing another name or register this person as a new client."
                      : "Create a client profile using the 'Add Client' button above."}
                  </p>
                </div>
              ) : (
                // Filtered Client List
                filteredClients.map((client) => {
                  const avatarStyles = getAvatarStyles(client.name)
                  const initials = getInitials(client.name)

                  return (
                    <div
                      key={client.id}
                      onClick={() => {
                        console.log("CLICKED CLIENT:", client)
                        onSelectClient(client)
                      }}
                      className="group flex items-center justify-between p-3.5 hover:bg-muted/65 cursor-pointer transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-10 w-10 rounded-full border flex items-center justify-center font-bold text-sm bg-gradient-to-br ${avatarStyles} shadow-2xs group-hover:scale-105 transition-transform duration-200`}
                        >
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-primary transition-colors text-sm">
                            {client.name}
                          </p>
                          <p className="text-xs text-muted-foreground font-medium">
                            ID: {client.id.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-center h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 group-hover:bg-primary/10 group-hover:text-primary transition-all duration-200">
                        <ChevronRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Small subtle brand mark at page bottom */}
      <p className="text-xs text-muted-foreground/60 mt-6 font-medium z-10">
        ALICE Clinical Portal &bull; Secure HIPAA-Compliant Gateway
      </p>
    </div>
  )
}
