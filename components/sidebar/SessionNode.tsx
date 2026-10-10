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
 * Mints the signed, expiring client link from the Worker. The Worker signs
 * `v1|sessionId|exp` with `CLIENT_LINK_SECRET`, so a raw session id alone no
 * longer opens the client's material. Only a signed-in clinician can mint one:
 * `apiFetch` attaches the bearer token and routes an expired session to /login.
 *
 * There is a single client link: `practiceUrl`. The Worker still returns
 * `homeworkUrl` for compatibility, but `/homework/:id` forwards to
 * `/practice/:id`, so the interactive view is the one canonical destination.
 */
async function mintClientLink(sessionId: string): Promise<string> {
  const res = await apiFetch(`${API_BASE}/client-link/${sessionId}`);
  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.practiceUrl) {
    throw new Error(data?.error || "Could not create a client link");
  }

  return data.practiceUrl as string;
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
      const url = await mintClientLink(session.id);

      await navigator.clipboard.writeText(url);

      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("❌ COPY CLIENT LINK FAILED", err);
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
      const url = await mintClientLink(session.id);

      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      tab?.close();
      console.error("❌ OPEN CLIENT LINK FAILED", err);
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
        "transition-all duration-150 hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
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
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-all duration-150">

        {/* COPY CLIENT LINK */}
        <button
          type="button"
          onClick={handleCopy}
          disabled={busy !== null}
          title="Copy client link"
          className={cn(
            "rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:opacity-50",
            copied ? "text-emerald-600" : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* OPEN CLIENT LINK */}
        <button
          type="button"
          onClick={handleOpen}
          disabled={busy !== null}
          title="Open client link"
          className="rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring hover:bg-sidebar-accent disabled:opacity-50"
        >
          <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-sidebar-accent-foreground" aria-hidden="true" />
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
          className="rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring hover:bg-destructive/10"
        >
          <Trash className="h-4 w-4 text-muted-foreground group-hover:text-destructive" aria-hidden="true" />
        </button>

      </div>
    </div>
  );
}