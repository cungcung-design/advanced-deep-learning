"use client";

import { useQuery } from "@tanstack/react-query";
import { listImageModels } from "../endpoints";
import { queryKeys } from "../query-keys";

export function useImageModels() {
  return useQuery({
    queryKey: queryKeys.inference.imageModels(),
    queryFn: listImageModels,
    staleTime: 30_000,
    retry: false,
  });
}
