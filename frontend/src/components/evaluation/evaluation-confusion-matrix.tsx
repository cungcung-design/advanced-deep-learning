"use client";

import type { EvaluationResults } from "@/lib/api/types";
import { getConfusionMatrixMax } from "@/lib/evaluation";

interface EvaluationConfusionMatrixProps {
  results: EvaluationResults;
}

export function EvaluationConfusionMatrix({
  results,
}: EvaluationConfusionMatrixProps) {
  const { classes, confusion_matrix: matrix } = results;
  const maxVal = getConfusionMatrixMax(matrix);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Confusion Matrix
        </h3>
        <span className="text-[11px] text-zinc-500">
          Rows: true label · Columns: predicted label
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/[0.07] bg-[#141722] p-3">
        <table
          aria-label="Confusion matrix"
          className="w-full border-separate border-spacing-1 text-center font-mono text-xs"
        >
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                True \ Pred
              </th>
              {classes.map((col) => (
                <th
                  key={`pred-${col}`}
                  scope="col"
                  className="min-w-[44px] px-1.5 py-1.5 text-[11px] font-medium text-zinc-400"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => {
              const rowLabel = classes[rowIndex] ?? String(rowIndex);
              return (
                <tr key={`true-${rowLabel}`}>
                  <th
                    scope="row"
                    className="whitespace-nowrap px-2 py-1.5 text-left text-[11px] font-medium text-zinc-300"
                  >
                    {rowLabel}
                  </th>
                  {row.map((count, colIndex) => {
                    const colLabel = classes[colIndex] ?? String(colIndex);
                    const isDiag = rowIndex === colIndex;
                    const ratio = maxVal > 0 ? count / maxVal : 0;
                    const alpha =
                      count === 0 ? 0.03 : Math.max(0.14, ratio * 0.72);
                    const bgColor = isDiag
                      ? `rgba(99, 102, 241, ${alpha.toFixed(2)})`
                      : count > 0
                        ? `rgba(239, 68, 68, ${Math.min(0.6, alpha).toFixed(2)})`
                        : "rgba(255, 255, 255, 0.02)";

                    return (
                      <td
                        key={`cell-${rowIndex}-${colIndex}`}
                        title={`True ${rowLabel} / Predicted ${colLabel}: ${count}`}
                        style={{ backgroundColor: bgColor }}
                        className={`rounded-md px-2 py-2 tabular-nums ${
                          count === 0
                            ? "text-zinc-600"
                            : isDiag
                              ? "font-semibold text-white"
                              : "text-red-100"
                        }`}
                      >
                        {count}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
