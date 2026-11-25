"use client";

import { Eye, Square } from "lucide-react";
import { TrainingStatusBadge } from "@/components/training/training-status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Evaluation, EvaluationPreset } from "@/lib/api/types";
import {
  formatMetricScore,
  getEvaluationDisplayName,
  isCancellableEvaluation,
} from "@/lib/evaluation";
import { formatDuration, formatTimestamp } from "@/lib/training";
import { cn } from "@/lib/utils";
import { EvaluationProgress } from "./evaluation-progress";

interface EvaluationTableProps {
  evaluations: Evaluation[];
  presets?: readonly EvaluationPreset[];
  selectedId: string | null;
  highlightedId: string | null;
  cancellingId: string | null;
  onSelect: (item: Evaluation) => void;
  onRequestCancel: (item: Evaluation) => void;
}

export function EvaluationTable({
  evaluations,
  presets,
  selectedId,
  highlightedId,
  cancellingId,
  onSelect,
  onRequestCancel,
}: EvaluationTableProps) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-white/[0.07] bg-[#11131A] lg:block">
      <Table aria-label="Evaluation history">
        <TableHeader>
          <TableRow className="border-white/[0.07] hover:bg-transparent">
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Evaluation / Model
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
              Accuracy
            </TableHead>
            <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Macro F1
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
          {evaluations.map((item) => {
            const isSelected = item.evaluation_id === selectedId;
            const isHighlighted = item.evaluation_id === highlightedId;
            const cancellable = isCancellableEvaluation(item);
            const isCancelling = cancellingId === item.evaluation_id;

            return (
              <TableRow
                key={item.evaluation_id}
                data-state={isSelected ? "selected" : undefined}
                onClick={() => onSelect(item)}
                className={cn(
                  "cursor-pointer border-white/[0.06] transition-colors hover:bg-white/[0.03]",
                  isSelected && "bg-indigo-500/[0.08]",
                  isHighlighted && "ring-1 ring-inset ring-indigo-400/40",
                )}
              >
                <TableCell className="px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-100">
                      {getEvaluationDisplayName(item.model, presets)}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-zinc-500">
                      {item.evaluation_id}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3.5 font-mono text-xs text-zinc-300">
                  {item.dataset}
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <TrainingStatusBadge
                    state={item.state}
                    cancelRequested={item.cancel_requested}
                  />
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <EvaluationProgress evaluation={item} compact />
                </TableCell>
                <TableCell className="px-4 py-3.5 font-mono text-xs tabular-nums text-zinc-200">
                  {formatMetricScore(item.metrics.accuracy)}
                </TableCell>
                <TableCell className="px-4 py-3.5 font-mono text-xs tabular-nums text-zinc-300">
                  {formatMetricScore(item.metrics.macro_f1)}
                </TableCell>
                <TableCell className="px-4 py-3.5 font-mono text-xs tabular-nums text-zinc-400">
                  {formatDuration(item.elapsed_seconds)}
                </TableCell>
                <TableCell className="px-4 py-3.5 text-xs text-zinc-400">
                  {formatTimestamp(item.created_at)}
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
                      onClick={() => onSelect(item)}
                      aria-label={`Inspect evaluation ${item.evaluation_id}`}
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
                        disabled={isCancelling || item.cancel_requested}
                        onClick={() => onRequestCancel(item)}
                        aria-label={`Cancel evaluation ${item.evaluation_id}`}
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
