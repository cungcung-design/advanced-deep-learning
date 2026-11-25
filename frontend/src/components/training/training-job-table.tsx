"use client";

import { Eye, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

interface TrainingJobTableProps {
  jobs: TrainingJob[];
  presets?: readonly TrainingPreset[];
  selectedJobId: string | null;
  highlightedJobId: string | null;
  cancellingJobId: string | null;
  onSelectJob: (job: TrainingJob) => void;
  onRequestCancel: (job: TrainingJob) => void;
}

export function TrainingJobTable({
  jobs,
  presets,
  selectedJobId,
  highlightedJobId,
  cancellingJobId,
  onSelectJob,
  onRequestCancel,
}: TrainingJobTableProps) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-white/[0.07] bg-[#11131A] lg:block">
      <Table aria-label="Training jobs">
        <TableHeader>
          <TableRow className="border-white/[0.07] hover:bg-transparent">
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Job / Model
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Dataset
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Status
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Progress
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Latest Val Acc
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Elapsed
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Created
            </TableHead>
            <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const isSelected = job.job_id === selectedJobId;
            const isHighlighted = job.job_id === highlightedJobId;
            const cancellable = isCancellableJob(job);
            const isCancelling = cancellingJobId === job.job_id;

            return (
              <TableRow
                key={job.job_id}
                data-state={isSelected ? "selected" : undefined}
                onClick={() => onSelectJob(job)}
                className={cn(
                  "cursor-pointer border-white/[0.06] transition-colors hover:bg-white/[0.03]",
                  isSelected && "bg-indigo-500/[0.08]",
                  isHighlighted && "ring-1 ring-inset ring-indigo-400/40",
                )}
              >
                <TableCell className="px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-100">
                      {getPresetDisplayName(job.model, presets)}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-zinc-500">
                      {job.job_id}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3.5 font-mono text-xs text-zinc-300">
                  {job.dataset}
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <TrainingStatusBadge
                    state={job.state}
                    cancelRequested={job.cancel_requested}
                  />
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <TrainingProgress job={job} compact />
                </TableCell>
                <TableCell className="px-4 py-3.5 font-mono text-xs tabular-nums text-zinc-300">
                  {formatAccuracy(job.metrics.val_acc)}
                </TableCell>
                <TableCell className="px-4 py-3.5 font-mono text-xs tabular-nums text-zinc-400">
                  {formatDuration(job.elapsed_seconds)}
                </TableCell>
                <TableCell className="px-4 py-3.5 text-xs text-zinc-400">
                  {formatTimestamp(job.created_at)}
                </TableCell>
                <TableCell
                  className="px-4 py-3.5 text-right"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => onSelectJob(job)}
                      aria-label={`Inspect job ${job.job_id}`}
                      className="border-white/10 bg-transparent text-zinc-200 hover:bg-white/[0.06]"
                    >
                      <Eye className="size-3" aria-hidden="true" />
                      Inspect
                    </Button>
                    {cancellable && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="xs"
                        disabled={isCancelling || job.cancel_requested}
                        onClick={() => onRequestCancel(job)}
                        aria-label={`Cancel job ${job.job_id}`}
                      >
                        <Square className="size-3" aria-hidden="true" />
                        {isCancelling ? "Cancelling..." : "Cancel"}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
