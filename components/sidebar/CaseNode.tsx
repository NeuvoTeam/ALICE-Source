"use client";

import * as React from "react";
import { ChevronRight, Folder, FolderOpen, Plus, Trash } from "lucide-react";
import { SessionNode } from "./SessionNode";
import { useClientNavStore } from "@/stores/useClientNavStore";
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

  const { createSession, deleteCase, renameCase } = useClientNavStore();

  // ✅ CRITICAL FIX — always safe array
  const sessions = caseData.sessions || [];

  return (
    <div className="space-y-1">

      {/* Case Row */}
      <div className="group flex items-center justify-between rounded-md hover:bg-sidebar-accent/50 transition-colors px-1 py-0.5">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-1 text-xs font-medium cursor-pointer text-foreground select-none"
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
              onSave={(newName) => renameCase(caseData.id, newName)}
            />
          </div>

          <span className="text-[10px] text-muted-foreground font-normal px-1 shrink-0">
            {sessions.length}
          </span>
        </div>

        {/* Actions */}
        <div
          className="hidden items-center gap-0.5 group-hover:flex group-focus-within:flex shrink-0 pr-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void createSession(caseData.id);
            }}
            aria-label="New session in case"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Delete this case and all sessions?")) {
                void deleteCase(caseData.id);
              }
            }}
            aria-label="Delete case"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring"
          >
            <Trash className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
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
