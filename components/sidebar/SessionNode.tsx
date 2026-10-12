"use client";

import { Trash, Copy, Check, ExternalLink, FileText, MoreHorizontal, Pencil } from "lucide-react";
import { useClientNavStore } from "@/stores/useClientNavStore";
import EditableName from "./EditableName";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { CLINICAL_AI_API_BASE as API_BASE } from "@/lib/clinical-ai-api";
import { apiFetch } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [isEditing, setIsEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (e.target !== e.currentTarget) return;
          if (e.key === " ") e.preventDefault();
          void selectSession(caseId, session.id);
        }
      }}
      className={cn(
        "group flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer select-none pointer-coarse:min-h-11",
        "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        isSelected
          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-2xs border border-border/40"
          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
      )}
    >
      {/* LEFT */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <FileText className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
        <div className="min-w-0 flex-1">
          <EditableName
            value={session.name}
            showPencilOnCoarse={false}
            isEditing={isEditing}
            onEditChange={setIsEditing}
            onSave={async (newName) => {
              useClientNavStore.setState({ error: null });
              await renameSession(caseId, session.id, newName);
              const { error } = useClientNavStore.getState();
              if (error) throw new Error(error);
            }}
          />
        </div>
      </div>

      {/* RIGHT ACTIONS - COMPACT & NO TOOLTIP OCCLUSION */}
      <div
        className={cn(
          "flex items-center gap-0.5 shrink-0 ml-1 opacity-0 pointer-events-none transition-opacity",
          "group-hover:opacity-100 group-hover:pointer-events-auto",
          "group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
          "pointer-coarse:opacity-100 pointer-coarse:pointer-events-auto",
          menuOpen && "opacity-100 pointer-events-auto"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* QUICK COPY LINK */}
        <button
          type="button"
          onClick={handleCopy}
          disabled={busy !== null}
          aria-label="Copy client link"
          className={cn(
            "rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring disabled:opacity-50 pointer-coarse:size-11 pointer-coarse:inline-flex pointer-coarse:items-center pointer-coarse:justify-center",
            copied
              ? "text-primary font-bold bg-primary/10"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>

        {/* MORE OPTIONS DROPDOWN */}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="More session actions"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring pointer-coarse:size-11 pointer-coarse:inline-flex pointer-coarse:items-center pointer-coarse:justify-center"
            >
              <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 text-xs">
            <DropdownMenuItem onClick={handleOpen} disabled={busy !== null} className="pointer-coarse:min-h-11">
              <ExternalLink className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <span>Open in new tab</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsEditing(true)} className="pointer-coarse:min-h-11">
              <Pencil className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <span>Rename session</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="pointer-coarse:min-h-11"
              onClick={() => {
                if (confirm("Delete this session?")) {
                  deleteSession(caseId, session.id);
                }
              }}
            >
              <Trash className="mr-2 h-3.5 w-3.5" />
              <span>Delete session</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}