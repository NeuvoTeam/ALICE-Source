"use client";

import { Trash, Copy, Check, ExternalLink } from "lucide-react";
import { useClientNavStore } from "@/stores/useClientNavStore";
import EditableName from "./EditableName";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Session = {
  id: string;
  name: string;
};

export function SessionNode({
  session,
  caseId,
}: {
  session: Session;
  caseId: string;
}) {
  const {
    deleteSession,
    renameSession,
    selectSession,
    selectedSessionId,
  } = useClientNavStore();

  const isSelected = selectedSessionId === session.id;
  const [copied, setCopied] = useState(false);

  // ✅ COPY
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const link = `${window.location.origin}/homework/${session.id}`;
    await navigator.clipboard.writeText(link);

    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // ✅ OPEN
  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/homework/${session.id}`, "_blank");
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => void selectSession(caseId, session.id)}
      className={cn(
        "group flex items-center justify-between px-3 py-1.5 rounded-md text-sm cursor-pointer",
        "transition-all duration-150 hover:bg-sidebar-accent/50",
        isSelected && "bg-sidebar-accent font-medium"
      )}
    >
      {/* LEFT */}
      <div className="min-w-0 flex-1">
        <EditableName
          value={session.name}
          onSave={(newName) =>
            renameSession(caseId, session.id, newName)
          }
        />
      </div>

      {/* RIGHT ACTIONS */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150">

        {/* COPY */}
        <button
          onClick={handleCopy}
          title="Copy homework link"
          className={cn(
            "p-1 rounded transition",
            copied ? "bg-green-100" : "hover:bg-blue-100"
          )}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4 text-blue-500 group-hover:text-blue-700" />
          )}
        </button>

        {/* OPEN */}
        <button
          onClick={handleOpen}
          title="Open homework"
          className="p-1 rounded hover:bg-gray-100 transition"
        >
          <ExternalLink className="h-4 w-4 text-gray-500 group-hover:text-gray-700" />
        </button>

        {/* DELETE */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Delete this session?")) {
              deleteSession(caseId, session.id);
            }
          }}
          title="Delete session"
          className="p-1 rounded hover:bg-red-100 transition"
        >
          <Trash className="h-4 w-4 text-red-400 group-hover:text-red-600" />
        </button>

      </div>
    </div>
  );
}