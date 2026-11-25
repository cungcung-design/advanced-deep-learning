"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  Cpu,
  Database,
  FlaskConical,
  Gauge,
  HardDrive,
  Layers3,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useDatasets } from "@/lib/api/queries/datasets";
import { useEvaluations } from "@/lib/api/queries/evaluations";
import { useRegistryModels } from "@/lib/api/queries/registry";
import {
  useHealth,
  useReadiness,
  useSettings,
} from "@/lib/api/queries/settings";
import { useTrainingJobs } from "@/lib/api/queries/training";
import {
  deriveReadinessDisplay,
  formatTrainingProgressPercent,
  normalizeTrainingProgressPercent,
} from "@/lib/dashboard";
import { formatBytes } from "@/lib/evaluation";
import { isActiveJobState } from "@/lib/training";

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <Card className="min-w-0 border-white/[0.07] bg-[#11131A] shadow-none">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular-nums text-zinc-100">
            {value}
          </p>
          <p className="mt-1 truncate text-[11px] text-zinc-600">{detail}</p>
        </div>
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${accent}`}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
        </div>
      </CardContent>
    </Card>
  );
}

function StateBadge({ state }: { state: string }) {
  const tone =
    state === "SUCCEEDED"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
      : state === "FAILED"
        ? "border-red-500/20 bg-red-500/10 text-red-400"
        : state === "RUNNING"
          ? "border-indigo-500/20 bg-indigo-500/10 text-indigo-300"
          : "border-white/10 bg-white/5 text-zinc-400";
  return (
    <Badge variant="outline" className={tone}>
      {state}
    </Badge>
  );
}

export default function DashboardPage() {
  const health = useHealth();
  const readiness = useReadiness();
  const settings = useSettings();
  const datasets = useDatasets();
  const models = useRegistryModels();
  const jobs = useTrainingJobs({ limit: 8 });
  const evaluations = useEvaluations({ limit: 8 });

  const connected = health.isSuccess && health.data.status === "ok";
  const readinessDisplay = deriveReadinessDisplay({
    readiness: readiness.data,
    isLoading: readiness.isLoading,
    isError: readiness.isError,
  });

  const activeJobs = jobs.data?.jobs.filter((job) =>
    isActiveJobState(job.state),
  ).length;
  const latestJobs = jobs.data?.jobs.slice(0, 5) ?? [];

  const readinessBadgeClass =
    readinessDisplay.tone === "ok"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
      : readinessDisplay.tone === "warning"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-300"
        : readinessDisplay.tone === "error"
          ? "border-red-500/20 bg-red-500/10 text-red-400"
          : "border-white/10 bg-white/5 text-zinc-400";

  const storageStatusText = readiness.isLoading
    ? "Checking"
    : readiness.isError
      ? "Unavailable"
      : readiness.data
        ? readiness.data.artifact_root && readiness.data.artifact_root_writable
          ? settings.data
            ? `Writable · ${formatBytes(settings.data.storage.artifact_bytes)}`
            : "Writable"
          : "Not writable"
        : "Unknown";

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-indigo-400/15 bg-gradient-to-br from-[#17182B] via-[#151624] to-[#11131A] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-28 size-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 top-20 size-48 rounded-full bg-violet-500/[0.07] blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <Badge className="mb-4 border-indigo-400/20 bg-indigo-400/10 text-indigo-300 hover:bg-indigo-400/10">
              <Sparkles className="mr-1.5 size-3" aria-hidden="true" /> DEEP
              LEARNING WORKSPACE
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Build. Train. Evaluate.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
              Your local AI laboratory for deep learning experiments, model
              evaluation, and intelligent inference.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/training"
              className="inline-flex h-9 items-center justify-center rounded-md bg-indigo-500 px-4 text-sm font-medium text-white transition hover:bg-indigo-400"
            >
              <FlaskConical className="mr-2 size-4" aria-hidden="true" /> New
              training run
            </Link>
            <Link
              href="/playground"
              className="inline-flex h-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.07]"
            >
              <Sparkles className="mr-2 size-4" aria-hidden="true" /> Open
              playground
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="API STATUS"
          value={health.isLoading ? "…" : connected ? "Online" : "Offline"}
          detail={
            connected
              ? `Version ${health.data.version} · Readiness: ${readinessDisplay.label}`
              : health.isError
                ? "Unable to reach backend"
                : "Checking connection"
          }
          icon={Activity}
          accent="bg-emerald-500/10 text-emerald-400"
        />
        <MetricCard
          label="DATASETS"
          value={
            datasets.isLoading
              ? "…"
              : datasets.isError
                ? "Unavailable"
                : datasets.data
                  ? String(datasets.data.count)
                  : "—"
          }
          detail={
            datasets.isError
              ? "Failed to load datasets"
              : datasets.data
                ? `${datasets.data.datasets.filter((d) => d.available).length} available locally`
                : "Registered datasets"
          }
          icon={Database}
          accent="bg-sky-500/10 text-sky-400"
        />
        <MetricCard
          label="REGISTERED MODELS"
          value={
            models.isLoading
              ? "…"
              : models.isError
                ? "Unavailable"
                : models.data
                  ? String(models.data.count)
                  : "—"
          }
          detail={
            models.isError
              ? "Failed to load registry"
              : models.data
                ? `${models.data.models.filter((m) => m.available).length} checkpoints ready`
                : "Available model records"
          }
          icon={BrainCircuit}
          accent="bg-violet-500/10 text-violet-400"
        />
        <MetricCard
          label="ACTIVE TRAINING"
          value={
            jobs.isLoading
              ? "…"
              : jobs.isError
                ? "Unavailable"
                : activeJobs === undefined
                  ? "—"
                  : String(activeJobs)
          }
          detail={
            jobs.isError
              ? "Failed to load training jobs"
              : "Queued or running jobs"
          }
          icon={Zap}
          accent="bg-amber-500/10 text-amber-400"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card className="min-w-0 border-white/[0.07] bg-[#11131A] shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm font-semibold text-zinc-100">
                Recent training activity
              </CardTitle>
              <p className="mt-1 text-xs text-zinc-600">
                Latest jobs from your local training service
              </p>
            </div>
            <Link
              href="/training"
              className="inline-flex items-center text-xs text-zinc-400 transition hover:text-white"
            >
              View all <ArrowRight className="ml-1 size-3" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent>
            {jobs.isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <Skeleton key={n} className="h-14 w-full bg-white/[0.05]" />
                ))}
              </div>
            ) : jobs.isError ? (
              <div
                role="alert"
                className="rounded-xl border border-red-500/15 bg-red-500/[0.04] p-5 text-sm text-red-300"
              >
                Could not load training jobs. Check that the backend is running.
              </div>
            ) : latestJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-12 text-center">
                <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-white/[0.04] text-zinc-500">
                  <FlaskConical className="size-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-zinc-300">
                  No training runs yet
                </p>
                <p className="mt-1 text-xs text-zinc-600">
                  Start your first experiment to see activity here.
                </p>
                <Link
                  href="/training"
                  className="mt-4 inline-flex h-8 items-center rounded-md bg-indigo-500 px-3 text-xs font-medium text-white transition hover:bg-indigo-400"
                >
                  Create training run
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {latestJobs.map((job) => {
                  const progressPct = normalizeTrainingProgressPercent(
                    job.progress,
                  );
                  const progressLabel = formatTrainingProgressPercent(
                    job.progress,
                  );

                  return (
                    <div
                      key={job.job_id}
                      className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-200">
                          {job.model}
                        </p>
                        <p className="mt-1 truncate text-xs text-zinc-600">
                          {job.dataset} <span className="mx-1">·</span>{" "}
                          {job.job_id.slice(0, 12)}
                        </p>
                        {isActiveJobState(job.state) && (
                          <div className="mt-2 flex items-center gap-2">
                            <Progress
                              value={progressPct}
                              aria-label={`Training progress for ${job.model}`}
                              className="h-1 w-32 bg-white/10"
                            />
                            <span className="text-[10px] tabular-nums text-zinc-400">
                              {progressLabel}
                            </span>
                          </div>
                        )}
                      </div>
                      <StateBadge state={job.state} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card className="border-white/[0.07] bg-[#11131A] shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-zinc-100">
                Workspace health
              </CardTitle>
              <p className="text-xs text-zinc-600">
                Live local environment and readiness probes
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Activity className="size-4" aria-hidden="true" />
                  </div>
                  <span className="text-xs text-zinc-400">Backend API</span>
                </div>
                <Badge
                  variant="outline"
                  className={
                    connected
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : "border-red-500/20 bg-red-500/10 text-red-400"
                  }
                >
                  {connected
                    ? "Connected"
                    : health.isLoading
                      ? "Checking"
                      : "Offline"}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-300">
                    <ShieldCheck className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-xs text-zinc-400">
                      Readiness
                    </span>
                    <span className="block truncate text-[10px] text-zinc-600">
                      {readinessDisplay.detail}
                    </span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={`shrink-0 ${readinessBadgeClass}`}
                >
                  {readinessDisplay.label}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                    <Cpu className="size-4" aria-hidden="true" />
                  </div>
                  <span className="text-xs text-zinc-400">Runtime</span>
                </div>
                <span className="text-xs font-mono text-zinc-400">
                  {settings.data
                    ? `${settings.data.runtime.device.toUpperCase()} · PyTorch ${settings.data.runtime.torch_version ?? "unknown"}`
                    : settings.isLoading
                      ? "Checking"
                      : "Unavailable"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                    <HardDrive className="size-4" aria-hidden="true" />
                  </div>
                  <span className="text-xs text-zinc-400">
                    Artifact storage
                  </span>
                </div>
                <span className="text-xs tabular-nums text-zinc-400">
                  {storageStatusText}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                    <Layers3 className="size-4" aria-hidden="true" />
                  </div>
                  <span className="text-xs text-zinc-400">Evaluations</span>
                </div>
                <span className="text-xs tabular-nums text-zinc-400">
                  {evaluations.data
                    ? `${evaluations.data.count} records`
                    : evaluations.isLoading
                      ? "Checking"
                      : "Unavailable"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/[0.07] bg-[#11131A] shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-zinc-100">
                Quick access
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {[
                { label: "Datasets", href: "/datasets", icon: Database },
                { label: "Evaluation", href: "/evaluation", icon: Gauge },
                { label: "AI Playground", href: "/playground", icon: Sparkles },
                { label: "NLP Tools", href: "/nlp", icon: BrainCircuit },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-zinc-400 transition hover:border-indigo-400/20 hover:bg-indigo-500/[0.06] hover:text-zinc-200"
                  >
                    <Icon
                      className="size-4 shrink-0 text-indigo-400"
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="flex items-center justify-between text-[11px] text-zinc-700">
        <span>
          Active training and evaluation runs refresh automatically while open.
        </span>
        <span className="flex items-center gap-1">
          <RefreshCw className="size-3" aria-hidden="true" /> Local API
          connection
        </span>
      </div>
    </div>
  );
}
