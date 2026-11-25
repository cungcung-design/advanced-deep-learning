"use client";

import type { TrainingMetrics } from "@/lib/api/types";
import { formatAccuracy, formatLoss } from "@/lib/training";

interface TrainingMetricsProps {
  metrics: TrainingMetrics;
}

export function TrainingMetricsPanel({ metrics }: TrainingMetricsProps) {
  const items = [
    {
      label: "Latest Train Loss",
      value: formatLoss(metrics.train_loss),
      hasValue: metrics.train_loss !== null && metrics.train_loss !== undefined,
    },
    {
      label: "Latest Train Accuracy",
      value: formatAccuracy(metrics.train_acc),
      hasValue: metrics.train_acc !== null && metrics.train_acc !== undefined,
    },
    {
      label: "Latest Val Loss",
      value: formatLoss(metrics.val_loss),
      hasValue: metrics.val_loss !== null && metrics.val_loss !== undefined,
    },
    {
      label: "Latest Val Accuracy",
      value: formatAccuracy(metrics.val_acc),
      hasValue: metrics.val_acc !== null && metrics.val_acc !== undefined,
    },
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Latest Reported Metrics
        </h3>
        <span className="text-[11px] text-zinc-500">
          Updated at epoch completion
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-white/[0.07] bg-[#141722] p-3.5"
          >
            <p className="text-[11px] text-zinc-400">{item.label}</p>
            <p
              className={`mt-1.5 font-mono text-base font-semibold tabular-nums ${
                item.hasValue ? "text-zinc-100" : "text-xs font-normal text-zinc-500"
              }`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
