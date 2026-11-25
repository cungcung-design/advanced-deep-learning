"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Server,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { API_BASE } from "@/lib/api/client";
import type { HealthResponse, ReadinessResponse } from "@/lib/api/types";
import { getReadinessChecks, isReadinessHealthy } from "@/lib/settings";

interface SettingsConnectionCardProps {
  health: HealthResponse | undefined;
  readiness: ReadinessResponse | undefined;
  isLoading: boolean;
}

export function SettingsConnectionCard({
  health,
  readiness,
  isLoading,
}: SettingsConnectionCardProps) {
  const [copiedApiUrl, setCopiedApiUrl] = useState(false);

  const handleCopyApiUrl = async () => {
    try {
      await navigator.clipboard.writeText(API_BASE);
      setCopiedApiUrl(true);
      window.setTimeout(() => setCopiedApiUrl(false), 1600);
    } catch {
      // Clipboard may be unavailable
    }
  };

  const healthy = isReadinessHealthy(readiness);
  const checks = readiness ? getReadinessChecks(readiness) : [];

  return (
    <Card className="min-w-0 border-white/[0.07] bg-[#11131A] shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <Server className="size-4" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-zinc-100">
              Backend Connection & Readiness
            </CardTitle>
            <p className="text-xs text-zinc-500">
              Live liveness and local infrastructure checks
            </p>
          </div>
        </div>
        {readiness && (
          <Badge
            variant="outline"
            className={
              healthy
                ? "border-emerald-500/25 bg-emerald-500/10 text-[11px] text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-300"
            }
          >
            {healthy ? "ready" : readiness.status}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Configured Frontend API Base URL */}
        <div className="flex items-start justify-between gap-2 rounded-xl border border-white/[0.06] bg-[#141722] px-3.5 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-zinc-400">
              Configured API Base URL
            </p>
            <p className="mt-0.5 break-all font-mono text-xs text-zinc-200">
              {API_BASE}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleCopyApiUrl}
            aria-label="Copy API Base URL"
            className="shrink-0 text-zinc-400 hover:text-zinc-100"
          >
            {copiedApiUrl ? (
              <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
          </Button>
        </div>

        {/* Application identity */}
        {isLoading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-12 w-full bg-white/[0.05]" />
            <Skeleton className="h-12 w-full bg-white/[0.05]" />
          </div>
        ) : (
          <>
            {health && (
              <dl className="grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                  <dt className="text-zinc-500">Application</dt>
                  <dd className="mt-1 font-medium text-zinc-200">
                    {health.app}
                  </dd>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                  <dt className="text-zinc-500">API Version</dt>
                  <dd className="mt-1 font-mono text-zinc-200">
                    v{health.version}
                  </dd>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-[#141722] p-3">
                  <dt className="text-zinc-500">Liveness</dt>
                  <dd className="mt-1 font-mono text-emerald-300">
                    {health.status}
                  </dd>
                </div>
              </dl>
            )}

            {readiness && !healthy && (
              <Alert variant="warning">
                <AlertTriangle
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <AlertTitle>Service readiness degraded (HTTP 503)</AlertTitle>
                  <AlertDescription>
                    One or more local readiness checks reported a failure. Review
                    the individual probes below before running training or
                    evaluation jobs.
                  </AlertDescription>
                </div>
              </Alert>
            )}

            {checks.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Readiness Probes
                </p>
                <ul className="space-y-2" aria-label="Service readiness checks">
                  {checks.map((check) => (
                    <li
                      key={check.key}
                      className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#141722] px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-zinc-200">
                          {check.label}
                        </p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          {check.description}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          check.ok
                            ? "shrink-0 border-emerald-500/25 bg-emerald-500/10 text-[11px] text-emerald-300"
                            : "shrink-0 border-red-500/25 bg-red-500/10 text-[11px] text-red-300"
                        }
                      >
                        {check.ok ? (
                          <CheckCircle2
                            className="mr-1 size-3"
                            aria-hidden="true"
                          />
                        ) : (
                          <XCircle className="mr-1 size-3" aria-hidden="true" />
                        )}
                        {check.ok ? "Pass" : "Fail"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
