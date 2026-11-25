"use client";

import { Lock, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  DIAGNOSTICS_POLL_INTERVAL_MS,
  type LocalSettingsPreferences,
} from "@/lib/settings";
import { cn } from "@/lib/utils";

interface SettingsPreferencesCardProps {
  preferences: LocalSettingsPreferences;
  onToggleAutoRefresh: (enabled: boolean) => void;
  onResetPreferences: () => void;
}

export function SettingsPreferencesCard({
  preferences,
  onToggleAutoRefresh,
  onResetPreferences,
}: SettingsPreferencesCardProps) {
  const intervalSeconds = Math.round(DIAGNOSTICS_POLL_INTERVAL_MS / 1000);

  return (
    <Card className="min-w-0 border-white/[0.07] bg-[#11131A] shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-300">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-zinc-100">
              Local Preferences & Configuration Scope
            </CardTitle>
            <p className="text-xs text-zinc-500">
              Browser-local diagnostics toggle and read-only backend policy
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="border-indigo-400/25 bg-indigo-500/10 text-[11px] text-indigo-300"
        >
          Browser-local
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Browser-local diagnostics auto-refresh */}
        <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3.5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p
                  id="auto-refresh-label"
                  className="text-xs font-semibold text-zinc-100"
                >
                  Auto-refresh diagnostics ({intervalSeconds}s)
                </p>
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/[0.04] text-[10px] text-zinc-400"
                >
                  {preferences.autoRefreshDiagnostics ? "Enabled" : "Off by default"}
                </Badge>
              </div>
              <p
                id="auto-refresh-description"
                className="mt-1 text-xs leading-5 text-zinc-400"
              >
                Stored only in this browser&apos;s localStorage. Does not modify
                backend configuration. When enabled, this page polls{" "}
                <code className="font-mono text-[11px] text-zinc-300">
                  /health
                </code>
                ,{" "}
                <code className="font-mono text-[11px] text-zinc-300">
                  /health/ready
                </code>{" "}
                (which writes and deletes a temporary{" "}
                <code className="font-mono text-[11px] text-zinc-300">
                  .write_probe
                </code>{" "}
                file), and{" "}
                <code className="font-mono text-[11px] text-zinc-300">
                  /settings
                </code>{" "}
                every {intervalSeconds} seconds while open.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={preferences.autoRefreshDiagnostics}
              aria-labelledby="auto-refresh-label"
              aria-describedby="auto-refresh-description"
              onClick={() =>
                onToggleAutoRefresh(!preferences.autoRefreshDiagnostics)
              }
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141722]",
                preferences.autoRefreshDiagnostics
                  ? "bg-indigo-500"
                  : "bg-white/15",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block size-4 rounded-full bg-white shadow-sm transition-transform",
                  preferences.autoRefreshDiagnostics
                    ? "translate-x-5"
                    : "translate-x-1",
                )}
              />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
            <span className="text-[11px] text-zinc-500">
              Polling stops automatically when disabled or when leaving this
              page.
            </span>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onResetPreferences}
              disabled={!preferences.autoRefreshDiagnostics}
              className="shrink-0 border-white/10 bg-transparent text-zinc-300 hover:bg-white/[0.06]"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              Reset local preferences
            </Button>
          </div>
        </div>

        <Separator className="bg-white/[0.07]" />

        {/* Environment-managed configuration & fixed dark theme */}
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center gap-2 text-zinc-300">
            <Lock className="size-3.5 text-zinc-500" aria-hidden="true" />
            <h3 className="font-semibold">
              Environment-Managed Backend Configuration
            </h3>
          </div>
          <p className="leading-5 text-zinc-400">
            Backend settings are read-only at runtime. Paths, database location,
            and CORS origins are loaded from environment variables (
            <code className="font-mono text-[11px] text-zinc-300">
              DEEPVISION_DATABASE_URL
            </code>
            ,{" "}
            <code className="font-mono text-[11px] text-zinc-300">
              DEEPVISION_ARTIFACT_ROOT
            </code>
            ,{" "}
            <code className="font-mono text-[11px] text-zinc-300">
              DEEPVISION_DATA_ROOT
            </code>
            ,{" "}
            <code className="font-mono text-[11px] text-zinc-300">
              DEEPVISION_CORS_ORIGINS
            </code>
            ) and require restarting the FastAPI server to take effect.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-[#141722] px-3.5 py-2.5">
            <span className="text-zinc-400">Interface Theme</span>
            <Badge
              variant="outline"
              className="border-white/10 bg-white/[0.04] text-[11px] text-zinc-300"
            >
              Dark (fixed)
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
