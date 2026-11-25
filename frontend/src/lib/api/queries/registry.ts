"use client";

import { useQuery } from "@tanstack/react-query";
import { getRegistryModel } from "../endpoints";
import { queryKeys } from "../query-keys";
export { useRegistryModels } from "./evaluations";

export function useRegistryModel(modelId: string | null) {
  return useQuery({
    queryKey: modelId
      ? queryKeys.registry.detail(modelId)
      : ["registry", "detail", null],
    queryFn: () => getRegistryModel(modelId!),
    enabled: Boolean(modelId),
    staleTime: 30_000,
    retry: false,
  });
}
