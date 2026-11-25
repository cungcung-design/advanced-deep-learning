"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Database,
  RefreshCw,
  SearchX,
  WifiOff,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useValidateDataset } from "@/lib/api/mutations/datasets";
import {
  useDataset,
  useDatasets,
  useDatasetStatistics,
} from "@/lib/api/queries/datasets";
import type { ValidationResponse } from "@/lib/api/types";
import {
  DEFAULT_DATASET_FILTERS,
  filterDatasets,
  formatDatasetsApiError,
  getUniqueDatasetTasks,
  getUniqueDatasetTypes,
  summarizeDatasets,
  type DatasetFilterState,
} from "@/lib/datasets";
import { cn } from "@/lib/utils";
import { DatasetDetail } from "./dataset-detail";
import { DatasetsCard } from "./datasets-card";
import { DatasetsSummary } from "./datasets-summary";
import { DatasetsTable } from "./datasets-table";
import { DatasetsToolbar } from "./datasets-toolbar";

export function DatasetsView() {
  const [filters, setFilters] = useState<DatasetFilterState>(
    DEFAULT_DATASET_FILTERS,
  );
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    null,
  );
  const [validationResults, setValidationResults] = useState<
    Record<string, ValidationResponse>
  >({});

  const datasetsQuery = useDatasets();
  const detailQuery = useDataset(selectedDatasetId);
  const statsQuery = useDatasetStatistics(selectedDatasetId);
  const validateMutation = useValidateDataset();

  const datasets = useMemo(
    () => datasetsQuery.data?.datasets ?? [],
    [datasetsQuery.data],
  );

  const selectedDataset = useMemo(() => {
    if (!selectedDatasetId) {
      return null;
    }
    return (
      detailQuery.data ??
      datasets.find((d) => d.dataset_id === selectedDatasetId) ??
      null
    );
  }, [selectedDatasetId, detailQuery.data, datasets]);

  const summary = useMemo(() => summarizeDatasets(datasets), [datasets]);
  const types = useMemo(() => getUniqueDatasetTypes(datasets), [datasets]);
  const tasks = useMemo(() => getUniqueDatasetTasks(datasets), [datasets]);
  const filteredDatasets = useMemo(
    () => filterDatasets(datasets, filters),
    [datasets, filters],
  );

  const listError = datasetsQuery.error
    ? formatDatasetsApiError(datasetsQuery.error)
    : null;

  const handleSelectDataset = (datasetId: string) => {
    if (datasetId !== selectedDatasetId) {
      validateMutation.reset();
    }
    setSelectedDatasetId(datasetId);
  };

  const handleValidate = (datasetId: string) => {
    if (validateMutation.isPending) {
      return;
    }
    validateMutation.mutate(datasetId, {
      onSuccess: (result) => {
        setValidationResults((prev) => ({
          ...prev,
          [result.dataset_id]: result,
        }));
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Datasets
            </h1>
            {!datasetsQuery.isLoading && !listError && (
              <Badge
                variant="outline"
                className="border-white/10 bg-white/[0.04] font-mono text-[11px] text-zinc-300"
              >
                {summary.available} / {summary.total} available
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Inspect registered local vision and NLP datasets, split statistics,
            preprocessing metadata, and run live five-check validation.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => void datasetsQuery.refetch()}
          disabled={datasetsQuery.isFetching}
          className="border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]"
        >
          <RefreshCw
            className={cn("size-4", datasetsQuery.isFetching && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </header>

      {/* KPI summary */}
      <DatasetsSummary stats={summary} isLoading={datasetsQuery.isLoading} />

      {/* Search & filters */}
      <DatasetsToolbar
        filters={filters}
        onChange={setFilters}
        types={types}
        tasks={tasks}
        totalCount={datasets.length}
        filteredCount={filteredDatasets.length}
      />

      {/* Main list states */}
      {datasetsQuery.isLoading ? (
        <div
          className="space-y-3 rounded-2xl border border-white/[0.07] bg-[#11131A] p-5"
          aria-label="Loading datasets"
        >
          {[1, 2, 3].map((item) => (
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
              onClick={() => void datasetsQuery.refetch()}
              className="mt-5 border-white/10 bg-transparent text-zinc-200"
            >
              Retry connection
            </Button>
          </div>
        ) : (
          <Alert variant="destructive">
            <AlertCircle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <AlertTitle>{listError.title}</AlertTitle>
              <AlertDescription>{listError.message}</AlertDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => void datasetsQuery.refetch()}
            >
              Retry
            </Button>
          </Alert>
        )
      ) : datasets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#11131A] px-6 py-14 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-300">
            <Database className="size-5" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-zinc-100">
            No registered datasets found
          </h2>
          <p className="mt-1.5 max-w-md text-xs leading-5 text-zinc-400">
            The backend dataset registry returned zero entries.
          </p>
        </div>
      ) : filteredDatasets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#11131A] px-6 py-14 text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-white/[0.04] text-zinc-400">
            <SearchX className="size-5" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-zinc-100">
            No matching datasets
          </h2>
          <p className="mt-1.5 max-w-md text-xs leading-5 text-zinc-400">
            Adjust or reset your search query and availability, type, or task
            filters.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFilters(DEFAULT_DATASET_FILTERS)}
            className="mt-5 border-white/10 bg-transparent text-zinc-200"
          >
            Reset filters
          </Button>
        </div>
      ) : (
        <>
          <DatasetsTable
            datasets={filteredDatasets}
            selectedDatasetId={selectedDatasetId}
            onSelect={(ds) => handleSelectDataset(ds.dataset_id)}
          />

          <div
            className="grid gap-3 lg:hidden"
            aria-label="Registered dataset cards"
          >
            {filteredDatasets.map((ds) => (
              <DatasetsCard
                key={ds.dataset_id}
                dataset={ds}
                isSelected={ds.dataset_id === selectedDatasetId}
                onSelect={(item) => handleSelectDataset(item.dataset_id)}
              />
            ))}
          </div>
        </>
      )}

      {/* Detail & Validation Sheet */}
      <DatasetDetail
        open={Boolean(selectedDatasetId)}
        dataset={selectedDataset}
        statistics={statsQuery.data}
        isLoading={detailQuery.isLoading}
        isStatsLoading={statsQuery.isLoading}
        error={detailQuery.error}
        validationResult={
          selectedDatasetId
            ? (validationResults[selectedDatasetId] ?? null)
            : null
        }
        validationError={validateMutation.error}
        isValidating={validateMutation.isPending}
        onValidate={handleValidate}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedDatasetId(null);
            validateMutation.reset();
          }
        }}
        onRetry={() => {
          void detailQuery.refetch();
          void statsQuery.refetch();
        }}
      />
    </div>
  );
}
