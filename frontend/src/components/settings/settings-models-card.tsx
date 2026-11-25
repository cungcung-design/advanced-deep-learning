"use client";

import Link from "next/link";
import { ArrowUpRight, Boxes } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ModelCapability } from "@/lib/api/types";

interface SettingsModelsCardProps {
  models: readonly ModelCapability[] | undefined;
  isLoading: boolean;
}

export function SettingsModelsCard({
  models,
  isLoading,
}: SettingsModelsCardProps) {
  const list = models ?? [];

  return (
    <Card className="min-w-0 border-white/[0.07] bg-[#11131A] shadow-none">
      <CardHeader className="flex flex-col justify-between gap-3 pb-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300">
            <Boxes className="size-4" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-zinc-100">
              Registered Model Capabilities ({list.length})
            </CardTitle>
            <p className="text-xs text-zinc-500">
              Task capability metadata reported by /settings. For live
              checkpoint availability and file paths, inspect the Model
              Registry.
            </p>
          </div>
        </div>
        <Link
          href="/registry"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.07]"
        >
          Open Model Registry
          <ArrowUpRight className="size-3.5 text-zinc-400" aria-hidden="true" />
        </Link>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-12 w-full bg-white/[0.05]" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 bg-[#141722]/60 px-4 py-8 text-center text-xs text-zinc-500">
            No model capability records were returned by the backend settings
            endpoint.
          </p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-xl border border-white/[0.06] bg-[#141722] lg:block">
              <Table aria-label="Registered model capabilities">
                <TableHeader>
                  <TableRow className="border-white/[0.06] hover:bg-transparent">
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Model / ID
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Task
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Capabilities
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((model) => (
                    <TableRow
                      key={model.model_id}
                      className="border-white/[0.05] hover:bg-white/[0.02]"
                    >
                      <TableCell className="px-4 py-3">
                        <p className="font-medium text-zinc-100">
                          {model.display_name}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-zinc-500">
                          {model.model_id}
                        </p>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-zinc-300">
                        {model.task.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {model.capabilities.map((cap) => (
                            <Badge
                              key={cap}
                              variant="outline"
                              className="border-white/10 bg-white/[0.04] font-mono text-[11px] text-zinc-300"
                            >
                              {cap}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Tablet / Mobile cards */}
            <div
              className="grid gap-3 lg:hidden"
              aria-label="Registered model capability cards"
            >
              {list.map((model) => (
                <div
                  key={model.model_id}
                  className="min-w-0 rounded-xl border border-white/[0.06] bg-[#141722] p-3.5"
                >
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {model.display_name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-zinc-500">
                    {model.model_id} · {model.task.replace(/_/g, " ")}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {model.capabilities.map((cap) => (
                      <Badge
                        key={cap}
                        variant="outline"
                        className="border-white/10 bg-white/[0.04] font-mono text-[11px] text-zinc-300"
                      >
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
