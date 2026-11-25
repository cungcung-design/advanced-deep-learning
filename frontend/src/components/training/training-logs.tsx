"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, RefreshCw, Terminal } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatTrainingApiError,
  parseLogLine,
  type LogSeverity,
} from "@/lib/training";
import { cn } from "@/lib/utils";

interface TrainingLogsProps {
  lines: string[];
  totalLines: number;
  complete: boolean;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  onRefresh: () => void;
}

const SEVERITY_STYLES: Record<LogSeverity, string> = {
  info: "text-zinc-200",
  warning: "text-amber-300 bg-amber-500/[0.06]",
  error: "text-red-300 bg-red-500/[0.08]",
};

const SEVERITY_LABELS: Record<LogSeverity, string> = {
  info: "INFO",
  warning: "WARN",
  error: "ERR",
};

export function TrainingLogs({
  lines,
  totalLines,
  complete,
  isLoading,
  isFetching,
  error,
  onRefresh,
}: TrainingLogsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines.length, autoScroll]);

  const handleCopy = async () => {
    if (lines.length === 0) {
      return;
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard may be unavailable in restricted contexts
    }
  };

  const formattedError = error ? formatTrainingApiError(error) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              complete
                ? "border-white/15 bg-white/[0.05] text-zinc-300"
                : "border-indigo-400/25 bg-indigo-500/10 text-indigo-300"
            }
          >
            {complete ? "Stream complete" : "Polling live"}
          </Badge>
          <span className="text-xs tabular-nums text-zinc-500">
            {lines.length}
            {totalLines > lines.length ? ` / ${totalLines}` : ""}{" "}
            {lines.length === 1 ? "line" : "lines"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setAutoScroll((prev) => !prev)}
            className="text-zinc-400 hover:text-zinc-100"
          >
            Auto-scroll: {autoScroll ? "On" : "Off"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleCopy}
            disabled={lines.length === 0}
            className="border-white/10 bg-transparent text-zinc-300"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-400" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-3" aria-hidden="true" />
                Copy
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onRefresh}
            disabled={isFetching}
            className="border-white/10 bg-transparent text-zinc-300"
          >
            <RefreshCw
              className={cn("size-3", isFetching && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>
      </div>

      {formattedError && (
        <Alert variant="destructive">
          <div className="min-w-0 flex-1">
            <AlertTitle>{formattedError.title}</AlertTitle>
            <AlertDescription>{formattedError.message}</AlertDescription>
          </div>
          <Button type="button" variant="outline" size="xs" onClick={onRefresh}>
            Retry
          </Button>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-2 rounded-xl border border-white/[0.07] bg-[#0C0E14] p-4">
          <Skeleton className="h-4 w-3/4 bg-white/[0.06]" />
          <Skeleton className="h-4 w-5/6 bg-white/[0.06]" />
          <Skeleton className="h-4 w-2/3 bg-white/[0.06]" />
        </div>
      ) : lines.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#0C0E14] px-4 py-10 text-center">
          <Terminal className="mb-2 size-5 text-zinc-500" aria-hidden="true" />
          <p className="text-sm font-medium text-zinc-300">
            No log entries reported yet
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {complete
              ? "This job finished without producing any log lines."
              : "Log lines will appear here in chronological order as the backend writes them."}
          </p>
        </div>
      ) : (
        <div
          ref={containerRef}
          role="log"
          aria-label="Training job logs"
          aria-live={complete ? "off" : "polite"}
          className="max-h-[420px] overflow-auto rounded-xl border border-white/[0.07] bg-[#0B0D13] p-3 font-mono text-xs leading-5"
        >
          <ol className="space-y-1">
            {lines.map((line, index) => {
              const parsed = parseLogLine(line);
              return (
                <li
                  key={`${index}-${line.slice(0, 32)}`}
                  data-severity={parsed.severity}
                  className={cn(
                    "flex items-start gap-2 rounded px-2 py-0.5 break-words",
                    SEVERITY_STYLES[parsed.severity],
                  )}
                >
                  <span className="w-7 shrink-0 select-none text-right text-[10px] tabular-nums text-zinc-600">
                    {index + 1}
                  </span>
                  {parsed.severity !== "info" && (
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded px-1 text-[10px] font-semibold",
                        parsed.severity === "error"
                          ? "bg-red-500/20 text-red-300"
                          : "bg-amber-500/20 text-amber-300",
                      )}
                    >
                      {SEVERITY_LABELS[parsed.severity]}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 whitespace-pre-wrap break-all sm:break-words">
                    {parsed.timestamp && (
                      <span className="mr-2 text-zinc-500">
                        [{parsed.timestamp}]
                      </span>
                    )}
                    <span>{parsed.message}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
