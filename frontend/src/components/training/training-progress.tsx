"use client";

import { Progress } from "@/components/ui/progress";
import type { TrainingJob } from "@/lib/api/types";
import {
  clampProgressPercent,
  formatProgressPercent,
  isActiveJobState,
} from "@/lib/training";

interface TrainingProgressProps {
  job: Pick<
    TrainingJob,
    | "state"
    | "progress"
    | "current_epoch"
    | "total_epochs"
    | "current_batch"
    | "total_batches"
    | "queue_position"
    | "cancel_requested"
  >;
  compact?: boolean;
}

export function TrainingProgress({
  job,
  compact = false,
}: TrainingProgressProps) {
  const percent = clampProgressPercent(job.progress);
  const active = isActiveJobState(job.state);

  const epochText =
    job.total_epochs > 0
      ? `Epoch ${job.current_epoch}/${job.total_epochs}`
      : "Epochs not reported";

  const batchText =
    job.total_batches > 0
      ? `Batch ${job.current_batch}/${job.total_batches}`
      : null;

  if (compact) {
    return (
      <div className="min-w-[130px] space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="tabular-nums text-zinc-300">
            {formatProgressPercent(job.progress)}
          </span>
          <span className="truncate text-[11px] text-zinc-500">
            {job.state === "QUEUED" && job.queue_position !== null
              ? `Queue #${job.queue_position}`
              : epochText}
          </span>
        </div>
        <Progress
          value={percent}
          aria-label={`Training progress ${formatProgressPercent(job.progress)}`}
          className="h-1.5"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/[0.07] bg-[#141722] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-zinc-300">
            {active ? "Live progress" : "Final recorded progress"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {job.state === "QUEUED" && job.queue_position !== null
              ? `Queued at position #${job.queue_position}`
              : batchText
                ? `${epochText} · ${batchText}`
                : epochText}
          </p>
        </div>
        <span className="font-mono text-sm font-semibold tabular-nums text-zinc-100">
          {formatProgressPercent(job.progress)}
        </span>
      </div>

      <Progress
        value={percent}
        aria-label={`Training progress ${formatProgressPercent(job.progress)}`}
        className="h-2"
      />

      {job.cancel_requested && active && (
        <p className="text-xs text-amber-300">
          Cancellation requested. Running jobs stop cooperatively after the
          current batch check.
        </p>
      )}
    </div>
  );
}
