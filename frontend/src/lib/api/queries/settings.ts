"use client";

import { useQuery } from "@tanstack/react-query";
import { DIAGNOSTICS_POLL_INTERVAL_MS } from "@/lib/settings";
import { getHealth, getReadiness, getSettings } from "../endpoints";
import { queryKeys } from "../query-keys";

export interface DiagnosticsQueryOptions {
  autoRefresh?: boolean;
}

export function useHealth(options?: DiagnosticsQueryOptions) {
  return useQuery({
    queryKey: queryKeys.system.health(),
    queryFn: getHealth,
    refetchInterval: options?.autoRefresh ? DIAGNOSTICS_POLL_INTERVAL_MS : false,
  });
}

export function useReadiness(options?: DiagnosticsQueryOptions) {
  return useQuery({
    queryKey: queryKeys.system.readiness(),
    queryFn: getReadiness,
    refetchInterval: options?.autoRefresh ? DIAGNOSTICS_POLL_INTERVAL_MS : false,
  });
}

export function useSettings(options?: DiagnosticsQueryOptions) {
  return useQuery({
    queryKey: queryKeys.system.settings(),
    queryFn: getSettings,
    refetchInterval: options?.autoRefresh ? DIAGNOSTICS_POLL_INTERVAL_MS : false,
  });
}
