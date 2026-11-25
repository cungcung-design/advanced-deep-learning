"use client";

import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { RegistryModelSummary } from "@/lib/api/types";
import { formatBytes, formatMetricScore } from "@/lib/evaluation";
import { getRegistryModelSource } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { RegistryStatusBadge } from "./registry-table";

interface RegistryCardProps {
  model: RegistryModelSummary;
  isSelected: boolean;
  onSelect: (model: RegistryModelSummary) => void;
}

export function RegistryCard({
  model,
  isSelected,
  onSelect,
}: RegistryCardProps) {
  const source = getRegistryModelSource(model);

  return (
    <Card
      className={cn(
        "min-w-0 border-white/[0.07] bg-[#11131A] shadow-none transition-colors",
        isSelected && "border-indigo-400/35 bg-indigo-500/[0.05]",
      )}
    >
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-100">
              {model.display_name}
            </p>
            <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
              {model.model_id} · {model.architecture}
            </p>
          </div>
          <RegistryStatusBadge
            available={model.available}
            status={model.status}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={
              source === "trained_job"
                ? "border-indigo-400/25 bg-indigo-500/10 text-[10px] text-indigo-300"
                : "border-white/10 bg-white/[0.04] text-[10px] text-zinc-300"
            }
          >
            {source === "trained_job" ? "Trained Job" : "Catalog"}
          </Badge>
          <Badge
            variant="outline"
            className="border-white/10 bg-white/[0.03] text-[10px] text-zinc-400"
          >
            {model.task.replace(/_/g, " ")}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/[0.06] bg-[#141722] p-3 text-xs">
          <div>
            <p className="text-[11px] text-zinc-500">Accuracy</p>
            <p className="mt-0.5 font-mono tabular-nums text-zinc-200">
              {formatMetricScore(model.metrics?.accuracy ?? null)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">Macro F1</p>
            <p className="mt-0.5 font-mono tabular-nums text-zinc-200">
              {formatMetricScore(model.metrics?.macro_f1 ?? null)}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[11px] text-zinc-500">Checkpoint Size</p>
            <p className="mt-0.5 font-mono tabular-nums text-zinc-300">
              {formatBytes(model.checkpoint_size_bytes)}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSelect(model)}
          className="w-full border-white/10 bg-transparent text-zinc-200 hover:bg-white/[0.06]"
        >
          <Eye className="size-3.5" aria-hidden="true" />
          Inspect details
        </Button>
      </CardContent>
    </Card>
  );
}
