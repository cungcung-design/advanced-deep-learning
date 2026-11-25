"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EvaluationResults } from "@/lib/api/types";
import { formatMetricScore } from "@/lib/evaluation";

interface EvaluationPerClassTableProps {
  results: EvaluationResults;
}

export function EvaluationPerClassTable({
  results,
}: EvaluationPerClassTableProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Per-Class Classification Metrics
        </h3>
        <span className="font-mono text-xs tabular-nums text-zinc-500">
          {results.sample_count.toLocaleString()} evaluated samples
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#141722]">
        <Table aria-label="Per-class classification metrics">
          <TableHeader>
            <TableRow className="border-white/[0.07] hover:bg-transparent">
              <TableHead className="px-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Class
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Precision
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Recall
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
                F1 Score
              </TableHead>
              <TableHead className="px-3 text-right text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Support
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.classes.map((className) => {
              const row = results.per_class[className];
              return (
                <TableRow
                  key={className}
                  className="border-white/[0.06] hover:bg-white/[0.02]"
                >
                  <TableCell className="px-3 py-2.5 font-mono text-xs font-medium text-zinc-200">
                    {className}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-300">
                    {formatMetricScore(row?.precision)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-300">
                    {formatMetricScore(row?.recall)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-200">
                    {formatMetricScore(row?.f1)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-400">
                    {row ? row.support.toLocaleString() : "0"}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="border-t border-white/10 bg-white/[0.03] font-semibold hover:bg-white/[0.03]">
              <TableCell className="px-3 py-2.5 text-xs text-indigo-300">
                Macro Average
              </TableCell>
              <TableCell className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-indigo-200">
                {formatMetricScore(results.macro.precision)}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-indigo-200">
                {formatMetricScore(results.macro.recall)}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-indigo-200">
                {formatMetricScore(results.macro.f1)}
              </TableCell>
              <TableCell className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-300">
                {results.sample_count.toLocaleString()}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
