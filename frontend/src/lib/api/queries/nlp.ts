"use client";

import { useQuery } from "@tanstack/react-query";
import { listNlpModels } from "../endpoints";
import { queryKeys } from "../query-keys";

export function useNlpModels() {
  return useQuery({
    queryKey: queryKeys.inference.nlpModels(),
    queryFn: listNlpModels,
    staleTime: 30_000,
    retry: false,
  });
}
