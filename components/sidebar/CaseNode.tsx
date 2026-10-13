"use client";

import * as React from "react";
import { ChevronRight, Folder, FolderOpen, MoreHorizontal, Pencil, Plus, Trash } from "lucide-react";
import { SessionNode } from "./SessionNode";
import { useClientNavStore } from "@/stores/useClientNavStore";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EditableName from "./EditableName";

type Session = {
  id: string;
  name: string;
};

type Case = {
  id: string;
  name: string;
  sessions?: Session[]; // ✅ note optional
};

export function CaseNode({ caseData }: { caseData: Case }) {
  const [open, setOpen] = React.useState(true);
  const [isEditing, setIsEditing] = React.useState(false);
  const { toast } = useToast();

  const { createSession, deleteCase, renameCase } = useClientNavStore();

  const handleDeleteCase = async () => {
    if (!confirm("Delete this case and all sessions?")) return;

    useClientNavStore.setState({ error: null });
    await deleteCase(caseData.id);

    const { error } = useClientNavStore.getState();
    if (error) {
      toast({ title: "Delete failed", description: error, variant: "destructive" });
    }
  };

  // ✅ CRITICAL FIX — always safe array
  const sessions = caseData.sessions || [];

  return (
    <div className="space-y-1">

      {/* Case Row */}
      <div className="group flex items-center justify-between rounded-md hover:bg-sidebar-accent/50 transition-colors px-1 py-0.5 pointer-coarse:min-h-11">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              if (e.target !== e.currentTarget) return;
              if (e.key === " ") e.preventDefault();
              setOpen((o) => !o);
            }
          }}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1 text-xs font-medium cursor-pointer text-foreground select-none pointer-coarse:min-h-11"
        >
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
              open ? "rotate-90" : ""
            }`}
            aria-hidden="true"
          />

          {open ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}

          <div
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 truncate"
          >
            <EditableName
              value={caseData.name}
              showPencilOnCoarse={false}
              isEditing={isEditing}
              onEditChange={setIsEditing}
              onSave={async (newName) => {
                useClientNavStore.setState({ error: null });
                await renameCase(caseData.id, newName);
                const { error } = useClientNavStore.getState();
                if (error) throw new Error(error);
              }}
            />
          </div>

          <span className="text-[10px] text-muted-foreground font-normal px-1 shrink-0">
            {sessions.length}
          </span>
        </div>

        {/* Actions (fine pointer) */}
        <div
          className="flex items-center gap-0.5 shrink-0 ml-1 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto pointer-coarse:hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void createSession(caseData.id);
            }}
            aria-label="New session in case"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring pointer-coarse:size-11 pointer-coarse:inline-flex pointer-coarse:items-center pointer-coarse:justify-center"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => void handleDeleteCase()}
            aria-label="Delete case"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring pointer-coarse:size-11 pointer-coarse:inline-flex pointer-coarse:items-center pointer-coarse:justify-center"
          >
            <Trash className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* Actions (coarse pointer) */}
        <div
          className="hidden pointer-coarse:flex items-center shrink-0 ml-1"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More case actions"
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring pointer-coarse:size-11 pointer-coarse:inline-flex pointer-coarse:items-center pointer-coarse:justify-center"
              >
                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 text-xs">
              <DropdownMenuItem
                onClick={() => void createSession(caseData.id)}
                className="pointer-coarse:min-h-11"
              >
                <Plus className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <span>New session in case</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setIsEditing(true)}
                className="pointer-coarse:min-h-11"
              >
                <Pencil className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <span>Rename case</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="pointer-coarse:min-h-11"
                onClick={() => void handleDeleteCase()}
              >
                <Trash className="mr-2 h-3.5 w-3.5" />
                <span>Delete case</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Sessions */}
      {open && (
        <div className="ml-6 space-y-1">

          {/* ✅ SAFE EMPTY CHECK */}
          {sessions.length === 0 && (
            <div className="text-xs text-muted-foreground px-3">
              No sessions
            </div>
          )}

          {/* ✅ SAFE MAP */}
          {sessions.map((s) => (
            <SessionNode
              key={s.id}
              session={s}
              caseId={caseData.id}
            />
          ))}

        </div>
      )}
    </div>
  );
}
