"use client";

import { useSyncExternalStore } from "react";
import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useHealth,
  useReadiness,
  useSettings,
} from "@/lib/api/queries/settings";
import {
  DEFAULT_LOCAL_SETTINGS_PREFERENCES,
  formatSettingsApiError,
  isReadinessHealthy,
  loadLocalSettingsPreferences,
  resetLocalSettingsPreferences,
  saveLocalSettingsPreferences,
  subscribeLocalSettingsPreferences,
  type LocalSettingsPreferences,
} from "@/lib/settings";
import { cn } from "@/lib/utils";
import { SettingsConnectionCard } from "./settings-connection-card";
import { SettingsModelsCard } from "./settings-models-card";
import { SettingsPreferencesCard } from "./settings-preferences-card";
import { SettingsRuntimeCard } from "./settings-runtime-card";
import { SettingsStorageCard } from "./settings-storage-card";
import { SettingsSummary } from "./settings-summary";

function getAutoRefreshSnapshot(): boolean {
  return loadLocalSettingsPreferences().autoRefreshDiagnostics;
}

function getAutoRefreshServerSnapshot(): boolean {
  return DEFAULT_LOCAL_SETTINGS_PREFERENCES.autoRefreshDiagnostics;
}

export function SettingsView() {
  const autoRefreshDiagnostics = useSyncExternalStore(
    subscribeLocalSettingsPreferences,
    getAutoRefreshSnapshot,
    getAutoRefreshServerSnapshot,
  );
  const preferences: LocalSettingsPreferences = { autoRefreshDiagnostics };

  const queryOptions = { autoRefresh: preferences.autoRefreshDiagnostics };
  const healthQuery = useHealth(queryOptions);
  const readinessQuery = useReadiness(queryOptions);
  const settingsQuery = useSettings(queryOptions);

  const isLoading =
    healthQuery.isLoading || readinessQuery.isLoading || settingsQuery.isLoading;
  const isFetching =
    healthQuery.isFetching ||
    readinessQuery.isFetching ||
    settingsQuery.isFetching;

  const primaryErrorRaw =
    settingsQuery.error ?? healthQuery.error ?? readinessQuery.error ?? null;
  const formattedError = primaryErrorRaw
    ? formatSettingsApiError(primaryErrorRaw)
    : null;

  const allFailed =
    Boolean(healthQuery.error) &&
    Boolean(readinessQuery.error) &&
    Boolean(settingsQuery.error);

  const handleRefreshAll = () => {
    void healthQuery.refetch();
    void readinessQuery.refetch();
    void settingsQuery.refetch();
  };

  const handleToggleAutoRefresh = (enabled: boolean) => {
    saveLocalSettingsPreferences({ autoRefreshDiagnostics: enabled });
  };

  const handleResetPreferences = () => {
    resetLocalSettingsPreferences();
  };

  const readinessHealthy = isReadinessHealthy(readinessQuery.data);
  const statusBadge = healthQuery.data
    ? readinessQuery.data
      ? readinessHealthy
        ? {
            label: `Online · v${healthQuery.data.version}`,
            tone: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
          }
        : {
            label: "Degraded (503)",
            tone: "border-amber-500/30 bg-amber-500/10 text-amber-300",
          }
      : {
          label: `Online · v${healthQuery.data.version}`,
          tone: "border-white/10 bg-white/[0.04] text-zinc-300",
        }
    : formattedError?.isOffline
      ? {
          label: "Offline",
          tone: "border-red-500/25 bg-red-500/10 text-red-300",
        }
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Settings
            </h1>
            {!isLoading && statusBadge && (
              <Badge
                variant="outline"
                className={cn("font-mono text-[11px]", statusBadge.tone)}
              >
                {statusBadge.label}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Inspect live backend health, readiness probes, local compute
            runtime, storage paths, and browser-local diagnostics preferences.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleRefreshAll}
          disabled={isFetching}
          className="border-white/10 bg-white/[0.03] text-zinc-200 hover:bg-white/[0.07]"
        >
          <RefreshCw
            className={cn("size-4", isFetching && "animate-spin")}
            aria-hidden="true"
          />
          Refresh diagnostics
        </Button>
      </header>

      {/* Offline / global error banner */}
      {formattedError && allFailed ? (
        formattedError.isOffline ? (
          <div
            role="alert"
            className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#11131A] px-6 py-14 text-center"
          >
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
              <WifiOff className="size-5" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">
              {formattedError.title}
            </h2>
            <p className="mt-1.5 max-w-md text-xs leading-5 text-zinc-400">
              {formattedError.message}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
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
              <AlertTitle>{formattedError.title}</AlertTitle>
              <AlertDescription>{formattedError.message}</AlertDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleRefreshAll}
            >
              Retry
            </Button>
          </Alert>
        )
      ) : (
        <>
          {formattedError && (
            <Alert variant="destructive">
              <AlertCircle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <AlertTitle>{formattedError.title}</AlertTitle>
                <AlertDescription>{formattedError.message}</AlertDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleRefreshAll}
              >
                Retry
              </Button>
            </Alert>
          )}

          {/* Top KPI Summary */}
          <SettingsSummary
            health={healthQuery.data}
            readiness={readinessQuery.data}
            settings={settingsQuery.data}
            isLoading={isLoading}
          />

          {/* Two-column detail grid */}
          <div className="grid gap-6 xl:grid-cols-2">
            <SettingsConnectionCard
              health={healthQuery.data}
              readiness={readinessQuery.data}
              isLoading={healthQuery.isLoading || readinessQuery.isLoading}
            />
            <SettingsRuntimeCard
              runtime={settingsQuery.data?.runtime}
              memory={settingsQuery.data?.memory}
              isLoading={settingsQuery.isLoading}
            />
            <SettingsStorageCard
              storage={settingsQuery.data?.storage}
              isLoading={settingsQuery.isLoading}
            />
            <SettingsPreferencesCard
              preferences={preferences}
              onToggleAutoRefresh={handleToggleAutoRefresh}
              onResetPreferences={handleResetPreferences}
            />
          </div>

          {/* Model capabilities matrix */}
          <SettingsModelsCard
            models={settingsQuery.data?.models}
            isLoading={settingsQuery.isLoading}
          />
        </>
      )}
    </div>
  );
}
