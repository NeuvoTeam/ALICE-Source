"use client";

import { Trash, Copy, Check, ExternalLink } from "lucide-react";
import { useClientNavStore } from "@/stores/useClientNavStore";
import EditableName from "./EditableName";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { CLINICAL_AI_API_BASE as API_BASE } from "@/lib/clinical-ai-api";
import { apiFetch } from "@/lib/auth";

type Session = {
  id: string;
  name: string;
};

/**
 * Mints the signed, expiring homework link from the Worker. The Worker signs
 * `v1|sessionId|exp` with `CLIENT_LINK_SECRET`, so a raw session id alone no
 * longer opens the client's material. Only a signed-in clinician can mint one:
 * `apiFetch` attaches the bearer token and routes an expired session to /login.
 */
async function mintHomeworkLink(sessionId: string): Promise<string> {
  const res = await apiFetch(`${API_BASE}/client-link/${sessionId}`);
  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.homeworkUrl) {
    throw new Error(data?.error || "Could not create a client link");
  }

  return data.homeworkUrl as string;
}

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
  const [busy, setBusy] = useState<"copy" | "open" | null>(null);

  // ✅ COPY — mint a fresh signed link, then copy it
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;

    setBusy("copy");

    try {
      const url = await mintHomeworkLink(session.id);

      await navigator.clipboard.writeText(url);

      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("❌ COPY HOMEWORK LINK FAILED", err);
      alert(
        err instanceof Error ? err.message : "Could not create a client link"
      );
    } finally {
      setBusy(null);
    }
  };

  // ✅ OPEN — the tab is opened synchronously so the popup blocker still sees
  // the user gesture, then pointed at the signed URL once it resolves.
  const handleOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;

    setBusy("open");
    const tab = window.open("", "_blank");

    try {
      const url = await mintHomeworkLink(session.id);

      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      tab?.close();
      console.error("❌ OPEN HOMEWORK FAILED", err);
      alert(
        err instanceof Error ? err.message : "Could not create a client link"
      );
    } finally {
      setBusy(null);
    }
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
          type="button"
          onClick={handleCopy}
          disabled={busy !== null}
          title="Copy homework link"
          className={cn(
            "p-1 rounded transition disabled:opacity-50",
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
          type="button"
          onClick={handleOpen}
          disabled={busy !== null}
          title="Open homework"
          className="p-1 rounded hover:bg-gray-100 transition disabled:opacity-50"
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