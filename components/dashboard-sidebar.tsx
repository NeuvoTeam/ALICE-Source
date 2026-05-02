"use client"

import { useState } from "react"
import {
  FileText,
  ScrollText,
  Sparkles,
  User,
  Stethoscope,
  Briefcase,
  UserPlus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { ClinicalWorkspace } from "@/hooks/use-clinical-workspace"
import { ClinicalFolderTree } from "@/components/clinical-folder-tree"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type ViewMode = "clinician" | "client"
type ClinicianTab = "vignette" | "summaries"

interface DashboardSidebarProps {
  viewMode: ViewMode
  activeTab: ClinicianTab
  onViewModeChange: (mode: ViewMode) => void
  onTabChange: (tab: ClinicianTab) => void
  clinicalWorkspace: ClinicalWorkspace
}

export function DashboardSidebar({
  viewMode,
  activeTab,
  onViewModeChange,
  onTabChange,
  clinicalWorkspace,
}: DashboardSidebarProps) {
  const [clientDialogOpen, setClientDialogOpen] = useState(false)
  const [caseDialogOpen, setCaseDialogOpen] = useState(false)
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false)
  const [sessionParent, setSessionParent] = useState<{
    clientId: string
    caseId: string
  } | null>(null)
  const [labelInput, setLabelInput] = useState("")

  const openNewClient = () => {
    setLabelInput("New client")
    setClientDialogOpen(true)
  }

  const openNewCase = () => {
    if (!clinicalWorkspace?.selectedClientId) return
    setLabelInput("New case")
    setCaseDialogOpen(true)
  }

  const openNewSession = (clientId: string, caseId: string) => {
    setSessionParent({ clientId, caseId })
    setLabelInput("New session")
    setSessionDialogOpen(true)
  }

  const submitNewClient = () => {
    clinicalWorkspace.onAddClient(labelInput)
    setClientDialogOpen(false)
    setLabelInput("")
  }

  const submitNewCase = () => {
    clinicalWorkspace.onAddCase(labelInput)
    setCaseDialogOpen(false)
    setLabelInput("")
  }

  const submitNewSession = () => {
    if (!sessionParent) return
    clinicalWorkspace.onAddSessionForCase(
      sessionParent.clientId,
      sessionParent.caseId,
      labelInput,
    )
    setSessionDialogOpen(false)
    setSessionParent(null)
    setLabelInput("")
  }

  return (
    <aside className="flex h-full min-h-0 w-80 min-w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-sidebar-foreground">MindCare</h1>
          <p className="text-xs text-muted-foreground">Clinical Portal</p>
        </div>
      </div>

      <div className="border-b border-sidebar-border px-3 py-3">
        <p className="mb-2 px-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          View
        </p>
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
          <button
            type="button"
            onClick={() => onViewModeChange("clinician")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors",
              viewMode === "clinician"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Stethoscope className="h-4 w-4 shrink-0" />
            Clinician
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("client")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors",
              viewMode === "client"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <User className="h-4 w-4 shrink-0" />
            Client
          </button>
        </div>
      </div>

      {viewMode === "clinician" && (
        <>
          <div className="border-b border-sidebar-border px-3 py-3">
            <p className="mb-2 px-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Clients & cases
            </p>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-full justify-start gap-2 rounded-lg border-sidebar-border bg-card/50"
                onClick={openNewClient}
              >
                <UserPlus className="h-4 w-4" />
                New client
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-full justify-start gap-2 rounded-lg border-sidebar-border bg-card/50"
                onClick={openNewCase}
                disabled={!clinicalWorkspace.selectedClientId}
              >
                <Briefcase className="h-4 w-4" />
                New case
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1">
  <div className="w-full"></div>
            
            <ClinicalFolderTree
              hierarchy={clinicalWorkspace.hierarchy}
              selectedClientId={clinicalWorkspace.selectedClientId}
              selectedCaseId={clinicalWorkspace.selectedCaseId}
              selectedSessionId={clinicalWorkspace.selectedSessionId}
              selectClient={clinicalWorkspace.selectClient}
              selectCasePath={clinicalWorkspace.selectCasePath}
              selectSessionPath={clinicalWorkspace.selectSessionPath}
              onRequestAddSession={openNewSession}
            />
          </div>

          <nav className="border-t border-sidebar-border px-3 py-3">
            <p className="mb-2 px-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Tools
            </p>
            <ul className="space-y-1">
              <li>
                <button
                  type="button"
                  onClick={() => onTabChange("vignette")}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    activeTab === "vignette"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                  )}
                >
                  <FileText className="h-4 w-4" />
                  Vignette Generator
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onTabChange("summaries")}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    activeTab === "summaries"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                  )}
                >
                  <ScrollText className="h-4 w-4" />
                  Session Summaries
                </button>
              </li>
            </ul>
          </nav>
        </>
      )}

      {viewMode === "client" && (
        <nav className="flex flex-1 flex-col px-3 py-4">
          <p className="mb-2 px-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            My Materials
          </p>
          <ul className="space-y-1">
            <li>
              <div className="bg-sidebar-accent text-sidebar-accent-foreground flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium">
                <FileText className="h-4 w-4" />
                Assigned Vignettes
              </div>
            </li>
          </ul>
        </nav>
      )}

      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-lg bg-muted/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            {viewMode === "clinician"
              ? "AI-assisted documentation for ethical, HIPAA-compliant practice."
              : "Review materials assigned by your care provider."}
          </p>
        </div>
      </div>

      <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New client</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-client-label">Name</Label>
            <Input
              id="new-client-label"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitNewClient()}
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setClientDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitNewClient}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={caseDialogOpen} onOpenChange={setCaseDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New case</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-case-label">Name</Label>
            <Input
              id="new-case-label"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitNewCase()}
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCaseDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitNewCase}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={sessionDialogOpen}
        onOpenChange={(open) => {
          setSessionDialogOpen(open)
          if (!open) setSessionParent(null)
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New session</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-session-label">Name</Label>
            <Input
              id="new-session-label"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitNewSession()}
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSessionDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitNewSession}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  )
}
