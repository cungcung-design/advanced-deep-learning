"use client";

import { Activity, CheckCircle2, Gauge, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatMetricScore,
  type EvaluationSummaryStats,
} from "@/lib/evaluation";

interface EvaluationSummaryProps {
  stats: EvaluationSummaryStats;
  isLoading?: boolean;
}

export function EvaluationSummary({
  stats,
  isLoading = false,
}: EvaluationSummaryProps) {
  const cards = [
    {
      label: "TOTAL EVALUATIONS",
      value: String(stats.total),
      detail: "Loaded recent evaluation runs",
      icon: Layers,
      accent: "bg-indigo-500/10 text-indigo-300",
    },
    {
      label: "ACTIVE RUNS",
      value: String(stats.active),
      detail: `${stats.queued} queued · ${stats.running} running`,
      icon: Activity,
      accent: "bg-sky-500/10 text-sky-300",
    },
    {
      label: "SUCCEEDED / FAILED",
      value: `${stats.succeeded} / ${stats.failed}`,
      detail:
        stats.cancelled > 0
          ? `${stats.cancelled} cancelled in recent list`
          : "Completed vs failed runs",
      icon: CheckCircle2,
      accent: "bg-emerald-500/10 text-emerald-300",
    },
    {
      label: "HIGHEST ACCURACY",
      value:
        stats.highestAccuracy !== null
          ? formatMetricScore(stats.highestAccuracy)
          : "Not reported",
      detail: "Across loaded succeeded runs",
      icon: Gauge,
      accent: "bg-violet-500/10 text-violet-300",
    },
  ];

  return (
    <section
      aria-label="Evaluation summary"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.label}
            className="border-white/[0.07] bg-[#11131A] shadow-none"
          >
            <CardContent className="flex items-start justify-between p-5">
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-wider text-zinc-400">
                  {card.label}
                </p>
                {isLoading ? (
                  <Skeleton className="mt-2.5 h-8 w-24 bg-white/[0.06]" />
                ) : (
                  <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-zinc-100">
                    {card.value}
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-500">{card.detail}</p>
              </div>
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${card.accent}`}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
