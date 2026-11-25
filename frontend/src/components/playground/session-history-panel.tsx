"use client";

import { History, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatConfidencePercent,
  formatLatencyMs,
  type SessionInferenceEntry,
} from "@/lib/inference";
import { cn } from "@/lib/utils";

interface SessionHistoryPanelProps {
  entries: readonly SessionInferenceEntry[];
  activeEntryId: string | null;
  onSelectEntry: (entry: SessionInferenceEntry) => void;
  onClearHistory: () => void;
}

export function SessionHistoryPanel({
  entries,
  activeEntryId,
  onSelectEntry,
  onClearHistory,
}: SessionHistoryPanelProps) {
  return (
    <Card className="border-white/[0.07] bg-[#11131A] shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
              <History className="size-4 text-indigo-400" aria-hidden="true" />
              Session Prediction History
            </CardTitle>
            <p className="mt-1 text-xs text-zinc-500">
              In-memory history for this browser session only (not saved to disk
              or local storage).
            </p>
          </div>
          {entries.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onClearHistory}
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
            Completed predictions from this session will appear here so you can
            compare outputs across models.
          </p>
        ) : (
          <ul
            aria-label="Session prediction history"
            className="divide-y divide-white/[0.06]"
          >
            {entries.map((entry) => {
              const isSelected = entry.id === activeEntryId;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEntry(entry)}
                    className={cn(
                      "flex w-full flex-col gap-1.5 rounded-lg px-3 py-3 text-left transition hover:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between",
                      isSelected && "bg-indigo-500/[0.08]",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-zinc-100">
                          {entry.result.predicted_class}
                        </span>
                        <Badge
                          variant="outline"
                          className="border-indigo-400/20 bg-indigo-500/10 font-mono text-[10px] text-indigo-300"
                        >
                          {formatConfidencePercent(entry.result.confidence)}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">
                        {entry.modelDisplayName} · {entry.fileName}
                      </p>
                    </div>
                    <div className="shrink-0 text-left font-mono text-[11px] tabular-nums text-zinc-500 sm:text-right">
                      <p>{formatLatencyMs(entry.result.inference_ms)}</p>
                      <p>{entry.timestamp}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
