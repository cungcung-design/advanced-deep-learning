"use client";

import { AlertTriangle, Boxes, CheckCircle2, HardDrive } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@/lib/evaluation";
import type { RegistrySummaryStats } from "@/lib/registry";

interface RegistrySummaryProps {
  stats: RegistrySummaryStats;
  isLoading?: boolean;
}

export function RegistrySummary({
  stats,
  isLoading = false,
}: RegistrySummaryProps) {
  const cards = [
    {
      label: "REGISTERED MODELS",
      value: String(stats.total),
      detail: `${stats.catalogCount} catalog · ${stats.trainedJobCount} trained jobs`,
      icon: Boxes,
      accent: "bg-indigo-500/10 text-indigo-300",
    },
    {
      label: "AVAILABLE CHECKPOINTS",
      value: String(stats.available),
      detail: "Verified local checkpoint files",
      icon: CheckCircle2,
      accent: "bg-emerald-500/10 text-emerald-300",
    },
    {
      label: "MISSING / INVALID",
      value: String(stats.unavailable),
      detail:
        stats.invalid > 0
          ? `${stats.missing} missing · ${stats.invalid} invalid`
          : "Unavailable local checkpoints",
      icon: AlertTriangle,
      accent: "bg-amber-500/10 text-amber-300",
    },
    {
      label: "CHECKPOINT STORAGE",
      value:
        stats.totalCheckpointBytes > 0
          ? formatBytes(stats.totalCheckpointBytes)
          : "0 B",
      detail: "Sum of reported local checkpoints",
      icon: HardDrive,
      accent: "bg-violet-500/10 text-violet-300",
    },
  ];

  return (
    <section
      aria-label="Model registry summary"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.label}
            className="min-w-0 border-white/[0.07] bg-[#11131A] shadow-none"
          >
            <CardContent className="flex items-start justify-between p-5">
              <div className="min-w-0">
                <p className="text-[11px] font-medium tracking-wider text-zinc-400">
                  {card.label}
                </p>
                {isLoading ? (
                  <Skeleton className="mt-2.5 h-8 w-20 bg-white/[0.06]" />
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
