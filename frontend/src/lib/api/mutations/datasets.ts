"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { validateDataset } from "../endpoints";
import { queryKeys } from "../query-keys";

export function useValidateDataset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (datasetId: string) =>
      validateDataset({ dataset_id: datasetId }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.datasets.all });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.datasets.detail(data.dataset_id),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.datasets.statistics(data.dataset_id),
      });
    },
  });
}
