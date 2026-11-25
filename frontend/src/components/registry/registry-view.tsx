"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Boxes,
  RefreshCw,
  SearchX,
  WifiOff,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEvaluations } from "@/lib/api/queries/evaluations";
import {
  useRegistryModel,
  useRegistryModels,
} from "@/lib/api/queries/registry";
import {
  DEFAULT_REGISTRY_FILTERS,
  filterRegistryModels,
  formatRegistryApiError,
  getUniqueRegistryArchitectures,
  getUniqueRegistryTasks,
  summarizeRegistryModels,
  type RegistryFilterState,
} from "@/lib/registry";
import { cn } from "@/lib/utils";
import { RegistryCard } from "./registry-card";
import { RegistryDetail } from "./registry-detail";
import { RegistrySummary } from "./registry-summary";
import { RegistryTable } from "./registry-table";
import { RegistryToolbar } from "./registry-toolbar";

const EVALUATIONS_HISTORY_LIMIT = 50;

export function RegistryView() {
  const [filters, setFilters] = useState<RegistryFilterState>(
    DEFAULT_REGISTRY_FILTERS,
  );
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const modelsQuery = useRegistryModels();
  const detailQuery = useRegistryModel(selectedModelId);
  const evaluationsQuery = useEvaluations({ limit: EVALUATIONS_HISTORY_LIMIT });

  const models = useMemo(
    () => modelsQuery.data?.models ?? [],
    [modelsQuery.data],
  );
  const evaluations = useMemo(
    () => evaluationsQuery.data?.evaluations ?? [],
    [evaluationsQuery.data],
  );

  const selectedModel = useMemo(() => {
    if (!selectedModelId) {
      return null;
    }
    return (
      detailQuery.data ??
      models.find((m) => m.model_id === selectedModelId) ??
      null
    );
  }, [selectedModelId, detailQuery.data, models]);

  const summary = useMemo(() => summarizeRegistryModels(models), [models]);
  const architectures = useMemo(
    () => getUniqueRegistryArchitectures(models),
    [models],
  );
  const tasks = useMemo(() => getUniqueRegistryTasks(models), [models]);
  const filteredModels = useMemo(
    () => filterRegistryModels(models, filters),
    [models, filters],
  );

  const listError = modelsQuery.error
    ? formatRegistryApiError(modelsQuery.error)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Model Registry
            </h1>
            {!modelsQuery.isLoading && !listError && (
              <Badge
                variant="outline"
                className="border-white/10 bg-white/[0.04] font-mono text-[11px] text-zinc-300"
              >
                {summary.available} / {summary.total} available
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Inspect registered catalog models and completed training-job
            checkpoints, recorded metrics, and local artifact references.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => {
            void modelsQuery.refetch();
            void evaluationsQuery.refetch();
          }}
          disabled={modelsQuery.isFetching}
          className="border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]"
        >
          <RefreshCw
            className={cn("size-4", modelsQuery.isFetching && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </header>

      {/* Summary cards */}
      <RegistrySummary stats={summary} isLoading={modelsQuery.isLoading} />

      {/* Search & filters */}
      <RegistryToolbar
        filters={filters}
        onChange={setFilters}
        architectures={architectures}
        tasks={tasks}
        totalCount={models.length}
        filteredCount={filteredModels.length}
      />

      {/* Main list states */}
      {modelsQuery.isLoading ? (
        <div
          className="space-y-3 rounded-2xl border border-white/[0.07] bg-[#11131A] p-5"
          aria-label="Loading registry models"
        >
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-14 w-full bg-white/[0.05]" />
          ))}
        </div>
      ) : listError ? (
        listError.isOffline ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#11131A] px-6 py-14 text-center"
          >
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
              <WifiOff className="size-5" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">
              {listError.title}
            </h2>
            <p className="mt-1.5 max-w-md text-xs leading-5 text-zinc-400">
              {listError.message}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void modelsQuery.refetch()}
              className="mt-5 border-white/10 bg-transparent text-zinc-200"
            >
              Retry connection
            </Button>
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <AlertTitle>{listError.title}</AlertTitle>
              <AlertDescription>{listError.message}</AlertDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void modelsQuery.refetch()}
            >
              Retry
            </Button>
          </Alert>
        )
      ) : models.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#11131A] px-6 py-14 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300">
            <Boxes className="size-5" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-zinc-100">
            No registered models found
          </h2>
          <p className="mt-1.5 max-w-md text-xs leading-5 text-zinc-400">
            The local model registry returned zero entries. Train a model or
            restore catalog checkpoints to populate the registry.
          </p>
        </div>
      ) : filteredModels.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#11131A] px-6 py-14 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] text-zinc-400">
            <SearchX className="size-5" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-zinc-100">
            No matching models
          </h2>
          <p className="mt-1.5 max-w-md text-xs leading-5 text-zinc-400">
            Adjust or reset your search query and availability, architecture,
            task, or source filters.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFilters(DEFAULT_REGISTRY_FILTERS)}
            className="mt-5 border-white/10 bg-transparent text-zinc-200"
          >
            Reset filters
          </Button>
        </div>
      ) : (
        <>
          <RegistryTable
            models={filteredModels}
            selectedModelId={selectedModelId}
            onSelect={(model) => setSelectedModelId(model.model_id)}
          />

          <div
            className="grid gap-3 lg:hidden"
            aria-label="Registered model cards"
          >
            {filteredModels.map((model) => (
              <RegistryCard
                key={model.model_id}
                model={model}
                isSelected={model.model_id === selectedModelId}
                onSelect={(item) => setSelectedModelId(item.model_id)}
              />
            ))}
          </div>
        </>
      )}

      {/* Detail sheet */}
      <RegistryDetail
        open={Boolean(selectedModelId)}
        model={selectedModel}
        isLoading={detailQuery.isLoading}
        error={detailQuery.error}
        evaluations={evaluations}
        evaluationsLimit={EVALUATIONS_HISTORY_LIMIT}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedModelId(null);
          }
        }}
        onRetry={() => {
          void detailQuery.refetch();
        }}
      />
    </div>
  );
}
