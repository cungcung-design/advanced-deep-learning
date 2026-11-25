"use client";

import { Progress } from "@/components/ui/progress";
import type { Evaluation } from "@/lib/api/types";
import { isActiveEvaluationState } from "@/lib/evaluation";
import { clampProgressPercent, formatProgressPercent } from "@/lib/training";

interface EvaluationProgressProps {
  evaluation: Pick<
    Evaluation,
    | "state"
    | "progress"
    | "samples_evaluated"
    | "total_samples"
    | "queue_position"
    | "cancel_requested"
  >;
  compact?: boolean;
}

export function EvaluationProgress({
  evaluation,
  compact = false,
}: EvaluationProgressProps) {
  const percent = clampProgressPercent(evaluation.progress);
  const active = isActiveEvaluationState(evaluation.state);

  const sampleText =
    evaluation.total_samples > 0
      ? `${evaluation.samples_evaluated.toLocaleString()} / ${evaluation.total_samples.toLocaleString()} samples`
      : "Samples not reported";

  if (compact) {
    return (
      <div className="min-w-[130px] space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="tabular-nums text-zinc-300">
            {formatProgressPercent(evaluation.progress)}
          </span>
          <span className="truncate text-[11px] text-zinc-500">
            {evaluation.state === "QUEUED" && evaluation.queue_position !== null
              ? `Queue #${evaluation.queue_position}`
              : evaluation.total_samples > 0
                ? `${evaluation.samples_evaluated}/${evaluation.total_samples}`
                : "Pending"}
          </span>
        </div>
        <Progress
          value={percent}
          aria-label={`Evaluation progress ${formatProgressPercent(evaluation.progress)}`}
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
            {active ? "Live evaluation progress" : "Final recorded progress"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {evaluation.state === "QUEUED" && evaluation.queue_position !== null
              ? `Queued at position #${evaluation.queue_position}`
              : sampleText}
          </p>
        </div>
        <span className="font-mono text-sm font-semibold tabular-nums text-zinc-100">
          {formatProgressPercent(evaluation.progress)}
        </span>
      </div>

      <Progress
        value={percent}
        aria-label={`Evaluation progress ${formatProgressPercent(evaluation.progress)}`}
        className="h-2"
      />

      {evaluation.cancel_requested && active && (
        <p className="text-xs text-amber-300">
          Cancellation requested. Running evaluations stop cooperatively between
          batches.
        </p>
      )}
    </div>
  );
}
