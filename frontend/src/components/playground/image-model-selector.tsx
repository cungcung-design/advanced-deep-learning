"use client";

import { AlertCircle, CheckCircle2, Cpu, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { ImageModelInfo } from "@/lib/api/types";
import { MAX_TOP_K, MIN_TOP_K } from "@/lib/inference";
import { cn } from "@/lib/utils";

interface ImageModelSelectorProps {
  models: readonly ImageModelInfo[];
  selectedModelId: string | null;
  topK: number;
  isLoading: boolean;
  disabled?: boolean;
  onSelectModel: (modelId: string) => void;
  onChangeTopK: (value: number) => void;
}

export function ImageModelSelector({
  models,
  selectedModelId,
  topK,
  isLoading,
  disabled = false,
  onSelectModel,
  onChangeTopK,
}: ImageModelSelectorProps) {
  const selectedModel =
    models.find((m) => m.model_id === selectedModelId) ?? null;

  return (
    <Card className="border-white/[0.07] bg-[#11131A] shadow-none">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold text-zinc-100">
              1. Model & Top-K Configuration
            </CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              Choose an available local vision checkpoint and number of ranked
              predictions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="playground-top-k" className="text-xs text-zinc-400">
              Top-K
            </Label>
            <select
              id="playground-top-k"
              aria-label="Top-K predictions"
              value={topK}
              disabled={disabled}
              onChange={(event) => onChangeTopK(Number(event.target.value))}
              className="h-8 rounded-lg border border-white/10 bg-[#141722] px-2.5 font-mono text-xs text-zinc-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/25"
            >
              {Array.from(
                { length: MAX_TOP_K - MIN_TOP_K + 1 },
                (_, idx) => MIN_TOP_K + idx,
              ).map((k) => (
                <option key={k} value={k}>
                  Top {k}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="grid gap-2.5 sm:grid-cols-2" aria-label="Loading image models">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="h-20 w-full rounded-xl bg-white/[0.05]" />
            ))}
          </div>
        ) : models.length === 0 ? (
          <Alert variant="warning">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <AlertTitle>No image models available</AlertTitle>
              <AlertDescription>
                The backend did not report any registered image classification
                models.
              </AlertDescription>
            </div>
          </Alert>
        ) : (
          <div
            role="radiogroup"
            aria-label="Image inference models"
            className="grid gap-2.5 sm:grid-cols-2"
          >
            {models.map((model) => {
              const selected = model.model_id === selectedModelId;
              return (
                <button
                  key={model.model_id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => onSelectModel(model.model_id)}
                  className={cn(
                    "flex min-w-0 flex-col items-start rounded-xl border p-3 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    selected
                      ? "border-indigo-400/50 bg-indigo-500/[0.12] text-white"
                      : "border-white/[0.08] bg-[#141722] text-zinc-300 hover:border-white/20 hover:bg-white/[0.03]",
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold">
                      {model.display_name}
                    </span>
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
                        className="shrink-0 gap-1 border-red-500/25 bg-red-500/10 text-[10px] text-red-300"
                      >
                        <XCircle className="size-2.5" aria-hidden="true" />
                        Missing
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-zinc-500">
                    {model.architecture} · {model.dataset}
                    {model.image_size !== null ? ` · ${model.image_size}×${model.image_size}` : ""}
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {selectedModel && !selectedModel.available && (
          <Alert variant="warning">
            <AlertCircle
              className="mt-0.5 size-4 shrink-0 text-amber-300"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <AlertTitle>Selected model checkpoint is unavailable</AlertTitle>
              <AlertDescription>
                <code className="font-mono">{selectedModel.model_id}</code> does
                not have a local checkpoint file. Select a model marked{" "}
                <strong>Ready</strong> to run inference.
              </AlertDescription>
            </div>
          </Alert>
        )}

        <p className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <Cpu className="size-3.5 shrink-0 text-indigo-400" aria-hidden="true" />
          Inference runs locally on CPU against the selected registry checkpoint.
          Uploaded images are kept in browser memory only and never persisted to
          disk or browser storage.
        </p>
      </CardContent>
    </Card>
  );
}
