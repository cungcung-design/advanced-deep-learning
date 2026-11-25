"use client";

import { Boxes, CheckCircle2, Play, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { EvaluationPreset, RegistryModelSummary } from "@/lib/api/types";
import { formatBytes } from "@/lib/evaluation";

interface EvaluationModelsStripProps {
  presets: readonly EvaluationPreset[];
  registryModels?: readonly RegistryModelSummary[];
  isLoading?: boolean;
  onQuickEvaluate: (preset: EvaluationPreset) => void;
}

export function EvaluationModelsStrip({
  presets,
  registryModels,
  isLoading = false,
  onQuickEvaluate,
}: EvaluationModelsStripProps) {
  if (isLoading) {
    return (
      <section aria-label="Available evaluation models" className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <Boxes className="size-3.5 text-indigo-400" aria-hidden="true" />
          Evaluatable Models & Checkpoints
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-24 w-full rounded-xl bg-white/[0.05]" />
          ))}
        </div>
      </section>
    );
  }

  if (presets.length === 0) {
    return null;
  }

  return (
    <section aria-label="Available evaluation models" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <Boxes className="size-3.5 text-indigo-400" aria-hidden="true" />
          Evaluatable Models & Checkpoints
        </div>
        <span className="text-xs text-zinc-500">
          Fixed catalog evaluated on held-out test splits
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {presets.map((preset) => {
          const reg = registryModels?.find((m) => m.model_id === preset.model);
          const available = reg ? reg.available : null;

          return (
            <Card
              key={preset.model}
              className="border-white/[0.07] bg-[#11131A] shadow-none"
            >
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {preset.display_name}
                    </p>
                    {available === true ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-emerald-500/25 bg-emerald-500/10 text-[10px] text-emerald-300"
                      >
                        <CheckCircle2 className="size-2.5" aria-hidden="true" />
                        Ready
                      </Badge>
                    ) : available === false ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-red-500/25 bg-red-500/10 text-[10px] text-red-300"
                      >
                        <XCircle className="size-2.5" aria-hidden="true" />
                        Missing
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-zinc-500">
                    {preset.model} · {preset.dataset} · {preset.architecture}
                  </p>
                  <p className="mt-1.5 text-[11px] text-zinc-500">
                    {reg?.checkpoint_size_bytes
                      ? `Checkpoint: ${formatBytes(reg.checkpoint_size_bytes)}`
                      : available === false
                        ? "Checkpoint file not found locally"
                        : preset.task.replace(/_/g, " ")}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => onQuickEvaluate(preset)}
                  aria-label={`Evaluate ${preset.display_name}`}
                  className="shrink-0 border-white/10 bg-transparent text-zinc-200 hover:bg-white/[0.06]"
                >
                  <Play className="size-3" aria-hidden="true" />
                  Evaluate
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
