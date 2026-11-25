"use client";

import { BrainCircuit, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { NlpModelInfo } from "@/lib/api/types";

interface NlpModelsStripProps {
  models: readonly NlpModelInfo[];
  isLoading: boolean;
}

export function NlpModelsStrip({ models, isLoading }: NlpModelsStripProps) {
  if (isLoading) {
    return (
      <section aria-label="NLP model availability" className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <BrainCircuit className="size-3.5 text-indigo-400" aria-hidden="true" />
          Local NLP Models
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-20 w-full rounded-xl bg-white/[0.05]" />
          ))}
        </div>
      </section>
    );
  }

  if (models.length === 0) {
    return null;
  }

  return (
    <section aria-label="NLP model availability" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <BrainCircuit className="size-3.5 text-indigo-400" aria-hidden="true" />
          Local NLP Models
        </div>
        <span className="text-xs text-zinc-500">
          CPU inference · local cache only (no automatic downloads)
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {models.map((model) => (
          <Card
            key={model.model_id}
            className="min-w-0 border-white/[0.07] bg-[#11131A] shadow-none"
          >
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-semibold text-zinc-100">
                  {model.display_name}
                </p>
                {model.available ? (
                  <Badge
                    variant="outline"
                    className="shrink-0 gap-1 border-emerald-500/25 bg-emerald-500/10 text-[10px] text-emerald-300"
                  >
                    <CheckCircle2 className="size-2.5" aria-hidden="true" />
                    Ready
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="shrink-0 gap-1 border-amber-500/25 bg-amber-500/10 text-[10px] text-amber-300"
                  >
                    <XCircle className="size-2.5" aria-hidden="true" />
                    Not Cached
                  </Badge>
                )}
              </div>
              <p className="truncate font-mono text-[11px] text-zinc-500">
                {model.task} · {model.kind}
              </p>
              <p className="truncate font-mono text-[10px] text-zinc-600">
                {model.model_id}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
