"use client";

import { Eye, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TrainingJob, TrainingPreset } from "@/lib/api/types";
import {
  formatAccuracy,
  formatDuration,
  formatTimestamp,
  getPresetDisplayName,
  isCancellableJob,
} from "@/lib/training";
import { cn } from "@/lib/utils";
import { TrainingProgress } from "./training-progress";
import { TrainingStatusBadge } from "./training-status-badge";

interface TrainingJobCardProps {
  job: TrainingJob;
  presets?: readonly TrainingPreset[];
  isSelected: boolean;
  isHighlighted: boolean;
  isCancelling: boolean;
  onSelect: (job: TrainingJob) => void;
  onRequestCancel: (job: TrainingJob) => void;
}

export function TrainingJobCard({
  job,
  presets,
  isSelected,
  isHighlighted,
  isCancelling,
  onSelect,
  onRequestCancel,
}: TrainingJobCardProps) {
  const cancellable = isCancellableJob(job);

  return (
    <Card
      className={cn(
        "border-white/[0.07] bg-[#11131A] shadow-none transition-colors",
        isSelected && "border-indigo-400/35 bg-indigo-500/[0.05]",
        isHighlighted && "ring-1 ring-indigo-400/40",
      )}
    >
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-100">
              {getPresetDisplayName(job.model, presets)}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
              {job.job_id} · {job.dataset}
            </p>
          </div>
          <TrainingStatusBadge
            state={job.state}
            cancelRequested={job.cancel_requested}
          />
        </div>

        <TrainingProgress job={job} compact />

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/[0.06] bg-[#141722] p-3 text-xs">
          <div>
            <p className="text-[11px] text-zinc-500">Latest Val Acc</p>
            <p className="mt-0.5 font-mono tabular-nums text-zinc-200">
              {formatAccuracy(job.metrics.val_acc)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">Elapsed</p>
            <p className="mt-0.5 font-mono tabular-nums text-zinc-200">
              {formatDuration(job.elapsed_seconds)}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[11px] text-zinc-500">Created</p>
            <p className="mt-0.5 text-zinc-300">
              {formatTimestamp(job.created_at)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelect(job)}
            className="flex-1 border-white/10 bg-transparent text-zinc-200 hover:bg-white/[0.06]"
          >
            <Eye className="size-3.5" aria-hidden="true" />
            Inspect details
          </Button>
          {cancellable && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isCancelling || job.cancel_requested}
              onClick={() => onRequestCancel(job)}
            >
              <Square className="size-3.5" aria-hidden="true" />
              {isCancelling ? "Cancelling..." : "Cancel"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
