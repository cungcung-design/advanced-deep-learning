"use client";

import { Badge } from "@/components/ui/badge";
import type { TrainingJobState } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const STATE_STYLES: Record<TrainingJobState, string> = {
  QUEUED: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  RUNNING: "border-indigo-400/30 bg-indigo-500/15 text-indigo-200",
  SUCCEEDED: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  FAILED: "border-red-500/25 bg-red-500/10 text-red-300",
  CANCELLED: "border-white/15 bg-white/[0.06] text-zinc-300",
};

interface TrainingStatusBadgeProps {
  state: TrainingJobState;
  cancelRequested?: boolean;
  className?: string;
}

export function TrainingStatusBadge({
  state,
  cancelRequested = false,
  className,
}: TrainingStatusBadgeProps) {
  const isRunning = state === "RUNNING";
  const showCancelling =
    cancelRequested && (state === "RUNNING" || state === "QUEUED");

  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge
        variant="outline"
        className={cn("gap-1.5 font-mono text-[11px]", STATE_STYLES[state], className)}
      >
        {isRunning && (
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-indigo-400"
          />
        )}
        {state}
      </Badge>
      {showCancelling && (
        <span className="text-[11px] font-medium text-amber-300">
          Cancel requested
        </span>
      )}
    </span>
  );
}
