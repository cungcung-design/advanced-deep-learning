"use client";

import { useMemo, useState } from "react";
import { GitCompare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "@/lib/evaluation";
import { formatDuration } from "@/lib/training";

interface EvaluationCompareDialogProps {
  open: boolean;
  evaluations: readonly Evaluation[];
  presets?: readonly EvaluationPreset[];
  onOpenChange: (open: boolean) => void;
}

const selectClasses =
  "h-9 w-full rounded-lg border border-white/10 bg-[#10121A] px-3 text-xs text-zinc-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/25";

export function EvaluationCompareDialog({
  open,
  evaluations,
  presets,
  onOpenChange,
}: EvaluationCompareDialogProps) {
  const succeeded = useMemo(
    () => evaluations.filter((item) => item.state === "SUCCEEDED"),
    [evaluations],
  );

  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");

  const effectiveLeft =
    succeeded.find((e) => e.evaluation_id === leftId) ?? succeeded[0] ?? null;
  const effectiveRight =
    succeeded.find((e) => e.evaluation_id === rightId) ??
    succeeded[1] ??
    succeeded[0] ??
    null;

  const formatDelta = (a: number | null | undefined, b: number | null | undefined) => {
    if (a === null || a === undefined || b === null || b === undefined) {
      return "—";
    }
    const diff = (b - a) * 100;
    const sign = diff > 0 ? "+" : "";
    return `${sign}${diff.toFixed(2)} pts`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border border-white/10 bg-[#141722] text-zinc-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-white">
            <GitCompare className="size-4 text-indigo-400" aria-hidden="true" />
            Compare Succeeded Evaluations
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Side-by-side comparison derived strictly from completed backend
            evaluation records.
          </DialogDescription>
        </DialogHeader>

        {succeeded.length < 2 ? (
          <p className="py-6 text-center text-sm text-zinc-400">
            At least two succeeded evaluations are needed for side-by-side
            comparison.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="compare-left"
                  className="text-xs font-medium text-zinc-400"
                >
                  Run A (Baseline)
                </label>
                <select
                  id="compare-left"
                  value={effectiveLeft?.evaluation_id ?? ""}
                  onChange={(e) => setLeftId(e.target.value)}
                  className={selectClasses}
                >
                  {succeeded.map((item) => (
                    <option key={item.evaluation_id} value={item.evaluation_id}>
                      {getEvaluationDisplayName(item.model, presets)} (
                      {item.evaluation_id.slice(0, 12)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="compare-right"
                  className="text-xs font-medium text-zinc-400"
                >
                  Run B (Comparison)
                </label>
                <select
                  id="compare-right"
                  value={effectiveRight?.evaluation_id ?? ""}
                  onChange={(e) => setRightId(e.target.value)}
                  className={selectClasses}
                >
                  {succeeded.map((item) => (
                    <option key={item.evaluation_id} value={item.evaluation_id}>
                      {getEvaluationDisplayName(item.model, presets)} (
                      {item.evaluation_id.slice(0, 12)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {effectiveLeft && effectiveRight && (
              <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#10121A]">
                <Table aria-label="Evaluation comparison">
                  <TableHeader>
                    <TableRow className="border-white/[0.07] hover:bg-transparent">
                      <TableHead className="px-3 text-xs text-zinc-400">
                        Metric
                      </TableHead>
                      <TableHead className="px-3 text-right text-xs text-zinc-400">
                        Run A
                      </TableHead>
                      <TableHead className="px-3 text-right text-xs text-zinc-400">
                        Run B
                      </TableHead>
                      <TableHead className="px-3 text-right text-xs text-zinc-400">
                        Delta (B - A)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="border-white/[0.06]">
                      <TableCell className="px-3 py-2 text-xs text-zinc-300">
                        Dataset
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs text-zinc-200">
                        {effectiveLeft.dataset}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs text-zinc-200">
                        {effectiveRight.dataset}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right text-xs text-zinc-500">
                        —
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-white/[0.06]">
                      <TableCell className="px-3 py-2 text-xs text-zinc-300">
                        Samples Evaluated
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums text-zinc-200">
                        {effectiveLeft.samples_evaluated.toLocaleString()}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums text-zinc-200">
                        {effectiveRight.samples_evaluated.toLocaleString()}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right text-xs text-zinc-500">
                        —
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-white/[0.06]">
                      <TableCell className="px-3 py-2 text-xs text-zinc-300">
                        Accuracy
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums text-zinc-100">
                        {formatMetricScore(effectiveLeft.metrics.accuracy)}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums text-zinc-100">
                        {formatMetricScore(effectiveRight.metrics.accuracy)}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums text-indigo-300">
                        {formatDelta(
                          effectiveLeft.metrics.accuracy,
                          effectiveRight.metrics.accuracy,
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-white/[0.06]">
                      <TableCell className="px-3 py-2 text-xs text-zinc-300">
                        Macro Precision
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums text-zinc-200">
                        {formatMetricScore(effectiveLeft.metrics.macro_precision)}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums text-zinc-200">
                        {formatMetricScore(effectiveRight.metrics.macro_precision)}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums text-indigo-300">
                        {formatDelta(
                          effectiveLeft.metrics.macro_precision,
                          effectiveRight.metrics.macro_precision,
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-white/[0.06]">
                      <TableCell className="px-3 py-2 text-xs text-zinc-300">
                        Macro Recall
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums text-zinc-200">
                        {formatMetricScore(effectiveLeft.metrics.macro_recall)}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums text-zinc-200">
                        {formatMetricScore(effectiveRight.metrics.macro_recall)}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums text-indigo-300">
                        {formatDelta(
                          effectiveLeft.metrics.macro_recall,
                          effectiveRight.metrics.macro_recall,
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-white/[0.06]">
                      <TableCell className="px-3 py-2 text-xs text-zinc-300">
                        Macro F1
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums text-zinc-200">
                        {formatMetricScore(effectiveLeft.metrics.macro_f1)}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums text-zinc-200">
                        {formatMetricScore(effectiveRight.metrics.macro_f1)}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums text-indigo-300">
                        {formatDelta(
                          effectiveLeft.metrics.macro_f1,
                          effectiveRight.metrics.macro_f1,
                        )}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-white/[0.06]">
                      <TableCell className="px-3 py-2 text-xs text-zinc-300">
                        Elapsed Time
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums text-zinc-300">
                        {formatDuration(effectiveLeft.elapsed_seconds)}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right font-mono text-xs tabular-nums text-zinc-300">
                        {formatDuration(effectiveRight.elapsed_seconds)}
                      </TableCell>
                      <TableCell className="px-3 py-2 text-right text-xs text-zinc-500">
                        —
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
