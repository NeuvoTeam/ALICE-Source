"use client";

import {
  FileText,
  ScrollText,
  Sparkles,
  User,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientNode } from "@/components/sidebar/ClientNode";

type ViewMode = "clinician" | "client";
type ClinicianTab = "vignette" | "summaries";

interface DashboardSidebarProps {
  viewMode: ViewMode;
  activeTab: ClinicianTab;
  onViewModeChange: (mode: ViewMode) => void;
  onTabChange: (tab: ClinicianTab) => void;
}

export function DashboardSidebar({
  viewMode,
  activeTab,
  onViewModeChange,
  onTabChange,
}: DashboardSidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col border-r bg-white">

      {/* HEADER */}
      <div className="flex items-center gap-3 border-b px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-semibold">ALICE</p>
        </div>
      </div>

      {/* VIEW SWITCH */}
      <div className="border-b px-3 py-3">
        <p className="text-xs text-gray-400 px-2 mb-2">View</p>

        <div className="flex gap-2">
          <button
            onClick={() => onViewModeChange("clinician")}
            className={cn(
              "flex-1 text-sm px-3 py-2 rounded",
              viewMode === "clinician"
                ? "bg-gray-200"
                : "bg-gray-50 hover:bg-gray-100"
            )}
          >
            <Stethoscope className="inline h-4 w-4 mr-1" />
            Clinician
          </button>

          <button
            onClick={() => onViewModeChange("client")}
            className={cn(
              "flex-1 text-sm px-3 py-2 rounded",
              viewMode === "client"
                ? "bg-gray-200"
                : "bg-gray-50 hover:bg-gray-100"
            )}
          >
            <User className="inline h-4 w-4 mr-1" />
            Client
          </button>
        </div>
      </div>

      {/* CLINICIAN MODE */}
      {viewMode === "clinician" && (
        <div className="flex-1 overflow-y-auto">

          {/* CLIENT / CASE / SESSION TREE */}
          <div className="px-3 py-3">
            <p className="text-xs text-gray-400 mb-2">Clients</p>

            {/* ✅ IMPORTANT: this must NOT handle routing */}
            <ClientNode />
          </div>

          {/* TOOLS */}
          <div className="px-3 py-3">
            <p className="text-xs text-gray-400 mb-2">Tools</p>

            <button
              onClick={() => onTabChange("vignette")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm rounded",
                activeTab === "vignette"
                  ? "bg-gray-200"
                  : "hover:bg-gray-100"
              )}
            >
              <FileText className="h-4 w-4" />
              Vignette Generator
            </button>

            <button
              onClick={() => onTabChange("summaries")}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm rounded",
                activeTab === "summaries"
                  ? "bg-gray-200"
                  : "hover:bg-gray-100"
              )}
            >
              <ScrollText className="h-4 w-4" />
              Session Summaries
            </button>
          </div>
        </div>
      )}

      {/* CLIENT MODE */}
      {viewMode === "client" && (
        <div className="flex-1 px-3 py-3">
          <p className="text-xs text-gray-400 mb-2">My Materials</p>

          <div className="px-3 py-2 bg-gray-200 rounded text-sm">
            Assigned Vignettes
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div className="border-t p-3 text-xs text-gray-500">
        {viewMode === "clinician"
          ? "AI-assisted clinical workflow"
          : "Client learning materials"}
      </div>

    </aside>
  );
}
