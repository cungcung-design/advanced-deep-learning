"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getDataset,
  getDatasetStatistics,
  listDatasets,
} from "../endpoints";
import { queryKeys } from "../query-keys";

export function useDatasets() {
  return useQuery({
    queryKey: queryKeys.datasets.list(),
    queryFn: listDatasets,
    staleTime: 60_000,
    retry: false,
  });
}

export function useDataset(datasetId: string | null) {
  return useQuery({
    queryKey: datasetId
      ? queryKeys.datasets.detail(datasetId)
      : ["datasets", "detail", null],
    queryFn: () => getDataset(datasetId!),
    enabled: Boolean(datasetId),
    staleTime: 60_000,
  });
}

export function useDatasetStatistics(datasetId: string | null) {
  return useQuery({
    queryKey: datasetId
      ? queryKeys.datasets.statistics(datasetId)
      : ["datasets", "statistics", null],
    queryFn: () => getDatasetStatistics(datasetId!),
    enabled: Boolean(datasetId),
    staleTime: 60_000,
  });
}
