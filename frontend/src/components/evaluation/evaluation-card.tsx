"use client";

import { Eye, Square } from "lucide-react";
import { TrainingStatusBadge } from "@/components/training/training-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Evaluation, EvaluationPreset } from "@/lib/api/types";
import {
  formatMetricScore,
  getEvaluationDisplayName,
  isCancellableEvaluation,
} from "@/lib/evaluation";
import { formatDuration, formatTimestamp } from "@/lib/training";
import { cn } from "@/lib/utils";
import { EvaluationProgress } from "./evaluation-progress";

interface EvaluationCardProps {
  evaluation: Evaluation;
  presets?: readonly EvaluationPreset[];
  isSelected: boolean;
  isHighlighted: boolean;
  isCancelling: boolean;
  onSelect: (item: Evaluation) => void;
  onRequestCancel: (item: Evaluation) => void;
}

export function EvaluationCard({
  evaluation,
  presets,
  isSelected,
  isHighlighted,
  isCancelling,
  onSelect,
  onRequestCancel,
}: EvaluationCardProps) {
  const cancellable = isCancellableEvaluation(evaluation);

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
              {getEvaluationDisplayName(evaluation.model, presets)}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
              {evaluation.evaluation_id} · {evaluation.dataset}
            </p>
          </div>
          <TrainingStatusBadge
            state={evaluation.state}
            cancelRequested={evaluation.cancel_requested}
          />
        </div>

        <EvaluationProgress evaluation={evaluation} compact />

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/[0.06] bg-[#141722] p-3 text-xs">
          <div>
            <p className="text-[11px] text-zinc-500">Accuracy</p>
            <p className="mt-0.5 font-mono tabular-nums text-zinc-200">
              {formatMetricScore(evaluation.metrics.accuracy)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">Macro F1</p>
            <p className="mt-0.5 font-mono tabular-nums text-zinc-200">
              {formatMetricScore(evaluation.metrics.macro_f1)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">Elapsed</p>
            <p className="mt-0.5 font-mono tabular-nums text-zinc-200">
              {formatDuration(evaluation.elapsed_seconds)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">Created</p>
            <p className="mt-0.5 text-zinc-300">
              {formatTimestamp(evaluation.created_at)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelect(evaluation)}
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
              disabled={isCancelling || evaluation.cancel_requested}
              onClick={() => onRequestCancel(evaluation)}
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
