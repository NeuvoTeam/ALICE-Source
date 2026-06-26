"use client";

import * as React from "react";
import { ChevronRight, Plus, Trash } from "lucide-react";
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
      <div className="group flex items-center justify-between">

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-sidebar-accent/50"
        >
          <ChevronRight
            className={`h-4 w-4 transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />

          <div
            onClick={(e) => e.stopPropagation()}
            className="flex-1"
          >
            <EditableName
              value={caseData.name}
              onSave={(newName) => renameCase(caseData.id, newName)}
            />
          </div>
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1 mr-2 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={(e) => {
              e.stopPropagation();
              createSession(caseData.id);
            }}
          >
            <Plus className="h-4 w-4" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Delete this case and all sessions?")) {
                deleteCase(caseData.id);
              }
            }}
          >
            <Trash className="h-4 w-4 hover:text-red-500" />
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
``