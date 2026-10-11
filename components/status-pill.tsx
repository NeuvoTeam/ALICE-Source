import * as React from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/tasks";
import { STATUS_CONFIG } from "@/lib/task-status";

export { STATUS_CONFIG };

export function StatusPill({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        cfg.cls,
        className
      )}
    >
      {status === "approved" && <Lock className="h-3 w-3" />}
      {cfg.label}
    </span>
  );
}

// Re-export for compatibility with gateway page
export { StatusPill as StatusBadge };
