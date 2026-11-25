"use client";

import { History, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatConfidencePercent, formatLatencyMs } from "@/lib/inference";
import type { NlpSessionEntry } from "@/lib/nlp";

interface NlpSessionHistoryProps {
  entries: readonly NlpSessionEntry[];
  onClear: () => void;
}

export function NlpSessionHistory({
  entries,
  onClear,
}: NlpSessionHistoryProps) {
  return (
    <Card className="min-w-0 border-white/[0.07] bg-[#11131A] shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <History className="size-4 text-indigo-400" aria-hidden="true" />
              Session NLP History
            </CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              In-memory history for this browser session only (never persisted
              to disk or browser storage).
            </p>
          </div>
          {entries.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onClear}
              aria-label="Clear NLP session history"
              className="text-zinc-400 hover:text-zinc-100"
            >
              <Trash2 className="size-3" aria-hidden="true" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-zinc-500">
            Completed NLP predictions from this session will appear here.
          </p>
        ) : (
          <ul
            aria-label="NLP session history"
            className="divide-y divide-white/[0.06]"
          >
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-white/10 bg-white/[0.04] font-mono text-[10px] uppercase text-zinc-300"
                    >
                      {entry.task}
                    </Badge>
                    {entry.task === "sentiment" && (
                      <span className="text-xs font-medium text-zinc-100">
                        {entry.result.label} (
                        {formatConfidencePercent(entry.result.score)})
                      </span>
                    )}
                    {entry.task === "embeddings" && (
                      <span className="text-xs font-medium text-zinc-100">
                        {entry.result.count} vectors × {entry.result.dimension}d
                      </span>
                    )}
                    {entry.task === "ner" && (
                      <span className="text-xs font-medium text-zinc-100">
                        {entry.result.entities.length} entities
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-zinc-500">
                    {entry.preview}
                  </p>
                </div>
                <div className="shrink-0 font-mono text-[11px] tabular-nums text-zinc-500 sm:text-right">
                  <p>{formatLatencyMs(entry.result.inference_ms)}</p>
                  <p>{entry.timestamp}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
