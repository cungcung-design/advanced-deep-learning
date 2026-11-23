"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, ArrowRight, BrainCircuit, Cpu, Database, FlaskConical,
  Gauge, HardDrive, Layers3, RefreshCw, Sparkles, Zap,
} from "lucide-react";
import { api, apiPaths, type Health, type TrainingJob } from "@/lib/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

function MetricCard({ label, value, detail, icon: Icon, accent }: {
  label: string; value: string; detail: string; icon: React.ElementType; accent: string;
}) {
  return (
    <Card className="border-white/[0.07] bg-[#11131A] shadow-none">
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">{value}</p>
          <p className="mt-1 text-[11px] text-zinc-600">{detail}</p>
        </div>
        <div className={`flex size-10 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="size-[18px]" />
        </div>
      </CardContent>
    </Card>
  );
}

function StateBadge({ state }: { state: string }) {
  const tone = state === "SUCCEEDED" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
    : state === "FAILED" ? "border-red-500/20 bg-red-500/10 text-red-400"
    : state === "RUNNING" ? "border-indigo-500/20 bg-indigo-500/10 text-indigo-300"
    : "border-white/10 bg-white/5 text-zinc-400";
  return <Badge variant="outline" className={tone}>{state}</Badge>;
}

export default function DashboardPage() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => api<Health>(apiPaths.health),
    refetchInterval: 20_000,
  });
  const datasets = useQuery({
    queryKey: ["datasets"],
    queryFn: () => api<{ datasets: unknown[]; count: number }>(apiPaths.datasets),
  });
  const models = useQuery({
    queryKey: ["registry"],
    queryFn: () => api<{ models: unknown[]; count: number }>(apiPaths.models),
  });
  const jobs = useQuery({
    queryKey: ["training-jobs"],
    queryFn: () => api<{ jobs: TrainingJob[]; count: number }>(`${apiPaths.trainingJobs}?limit=8`),
    refetchInterval: 5_000,
  });
  const evaluations = useQuery({
    queryKey: ["evaluations"],
    queryFn: () => api<{ evaluations: unknown[]; count: number }>(`${apiPaths.evaluations}?limit=8`),
    refetchInterval: 10_000,
  });
  const runtime = useQuery({
    queryKey: ["runtime"],
    queryFn: () => api<Record<string, unknown>>(apiPaths.runtime),
  });

  const connected = health.isSuccess && health.data.status === "ok";
  const activeJobs = jobs.data?.jobs.filter((job) => ["QUEUED", "RUNNING"].includes(job.state)).length;
  const latestJobs = jobs.data?.jobs.slice(0, 5) ?? [];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-2xl border border-indigo-400/15 bg-gradient-to-br from-[#17182B] via-[#151624] to-[#11131A] p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-28 size-80 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 top-20 size-48 rounded-full bg-violet-500/[0.07] blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <Badge className="mb-4 border-indigo-400/20 bg-indigo-400/10 text-indigo-300 hover:bg-indigo-400/10">
              <Sparkles className="mr-1.5 size-3" /> DEEP LEARNING WORKSPACE
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Build. Train. Evaluate.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
              Your local AI laboratory for deep learning experiments, model evaluation, and intelligent inference.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/training" className="inline-flex h-9 items-center justify-center rounded-md bg-indigo-500 px-4 text-sm font-medium text-white transition hover:bg-indigo-400"><FlaskConical className="mr-2 size-4" /> New training run</Link>
            <Link href="/playground" className="inline-flex h-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.07]"><Sparkles className="mr-2 size-4" /> Open playground</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="API STATUS" value={health.isLoading ? "…" : connected ? "Online" : "Offline"} detail={connected ? `Version ${health.data.version}` : health.isError ? "Unable to reach backend" : "Checking connection"} icon={Activity} accent="bg-emerald-500/10 text-emerald-400" />
        <MetricCard label="DATASETS" value={datasets.isLoading ? "…" : datasets.data ? String(datasets.data.count) : "—"} detail="Registered datasets" icon={Database} accent="bg-sky-500/10 text-sky-400" />
        <MetricCard label="REGISTERED MODELS" value={models.isLoading ? "…" : models.data ? String(models.data.count) : "—"} detail="Available model records" icon={BrainCircuit} accent="bg-violet-500/10 text-violet-400" />
        <MetricCard label="ACTIVE TRAINING" value={jobs.isLoading ? "…" : activeJobs === undefined ? "—" : String(activeJobs)} detail="Queued or running jobs" icon={Zap} accent="bg-amber-500/10 text-amber-400" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card className="border-white/[0.07] bg-[#11131A] shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm font-semibold text-zinc-100">Recent training activity</CardTitle>
              <p className="mt-1 text-xs text-zinc-600">Latest jobs from your local training service</p>
            </div>
            <Link href="/training" className="inline-flex items-center text-xs text-zinc-400 transition hover:text-white">View all <ArrowRight className="ml-1 size-3" /></Link>
          </CardHeader>
          <CardContent>
            {jobs.isLoading ? (
              <div className="space-y-4">{[1, 2, 3].map((n) => <Skeleton key={n} className="h-14 w-full bg-white/[0.05]" />)}</div>
            ) : jobs.isError ? (
              <div className="rounded-xl border border-red-500/15 bg-red-500/[0.04] p-5 text-sm text-red-300">Could not load training jobs. Check that the backend is running.</div>
            ) : latestJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-12 text-center">
                <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-white/[0.04] text-zinc-500"><FlaskConical className="size-5" /></div>
                <p className="text-sm font-medium text-zinc-300">No training runs yet</p>
                <p className="mt-1 text-xs text-zinc-600">Start your first experiment to see activity here.</p>
                <Link href="/training" className="mt-4 inline-flex h-8 items-center rounded-md bg-indigo-500 px-3 text-xs font-medium text-white transition hover:bg-indigo-400">Create training run</Link>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {latestJobs.map((job) => (
                  <div key={job.job_id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-200">{job.model}</p>
                      <p className="mt-1 truncate text-xs text-zinc-600">{job.dataset} <span className="mx-1">·</span> {job.job_id.slice(0, 12)}</p>
                      {["RUNNING", "QUEUED"].includes(job.state) && (
                        <div className="mt-2 flex items-center gap-2">
                          <Progress value={job.progress} className="h-1 w-32 bg-white/10" />
                          <span className="text-[10px] tabular-nums text-zinc-500">{job.progress.toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                    <StateBadge state={job.state} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-white/[0.07] bg-[#11131A] shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-zinc-100">Workspace health</CardTitle>
              <p className="text-xs text-zinc-600">Live local environment status</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400"><Activity className="size-4" /></div><span className="text-xs text-zinc-400">Backend API</span></div>
                <Badge variant="outline" className={connected ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border-red-500/20 bg-red-500/10 text-red-400"}>{connected ? "Connected" : health.isLoading ? "Checking" : "Offline"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="flex size-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400"><Cpu className="size-4" /></div><span className="text-xs text-zinc-400">Runtime</span></div>
                <span className="text-xs text-zinc-500">{runtime.data ? "Available" : runtime.isLoading ? "Checking" : "Unavailable"}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400"><HardDrive className="size-4" /></div><span className="text-xs text-zinc-400">Storage service</span></div>
                <span className="text-xs text-zinc-500">{health.isSuccess ? "API reachable" : "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400"><Layers3 className="size-4" /></div><span className="text-xs text-zinc-400">Evaluations</span></div>
                <span className="text-xs tabular-nums text-zinc-500">{evaluations.data ? `${evaluations.data.count} records` : evaluations.isLoading ? "Checking" : "Unavailable"}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/[0.07] bg-[#11131A] shadow-none">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold text-zinc-100">Quick access</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {[
                { label: "Datasets", href: "/datasets", icon: Database },
                { label: "Evaluation", href: "/evaluation", icon: Gauge },
                { label: "AI Playground", href: "/playground", icon: Sparkles },
                { label: "NLP Tools", href: "/nlp", icon: BrainCircuit },
              ].map((item) => {
                const Icon = item.icon;
                return <Link key={item.href} href={item.href} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-zinc-400 transition hover:border-indigo-400/20 hover:bg-indigo-500/[0.06] hover:text-zinc-200"><Icon className="size-4 text-indigo-400" />{item.label}</Link>;
              })}
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="flex items-center justify-between text-[11px] text-zinc-700">
        <span>Data refreshes automatically while this dashboard is open.</span>
        <span className="flex items-center gap-1"><RefreshCw className="size-3" /> Local API connection</span>
      </div>
    </div>
  );
}
