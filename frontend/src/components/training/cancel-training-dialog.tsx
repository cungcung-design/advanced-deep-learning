"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TrainingJob } from "@/lib/api/types";
import { formatTrainingApiError } from "@/lib/training";

interface CancelTrainingDialogProps {
  job: TrainingJob | null;
  open: boolean;
  isPending: boolean;
  error: unknown;
  onOpenChange: (open: boolean) => void;
  onConfirm: (jobId: string) => void;
}

export function CancelTrainingDialog({
  job,
  open,
  isPending,
  error,
  onOpenChange,
  onConfirm,
}: CancelTrainingDialogProps) {
  const formattedError = error ? formatTrainingApiError(error) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-white/10 bg-[#151822] text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <AlertTriangle
              className="size-4 text-amber-400"
              aria-hidden="true"
            />
            Cancel training job?
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {job?.state === "QUEUED"
              ? "This queued job will be removed from the pending queue and marked as CANCELLED."
              : "This sends a cooperative cancellation request to the active worker. Running jobs stop after the next batch check, or may finish if already completing."}
          </DialogDescription>
        </DialogHeader>

        {job && (
          <div className="rounded-xl border border-white/[0.08] bg-[#10121A] p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-zinc-500">Job ID</span>
              <span className="font-mono text-zinc-200">{job.job_id}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-zinc-500">Model / Dataset</span>
              <span className="font-mono text-zinc-200">
                {job.model} · {job.dataset}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-zinc-500">Current State</span>
              <span className="font-mono text-zinc-200">{job.state}</span>
            </div>
          </div>
        )}

        {formattedError && (
          <Alert variant="destructive">
            <div className="min-w-0 flex-1">
              <AlertTitle>{formattedError.title}</AlertTitle>
              <AlertDescription>{formattedError.message}</AlertDescription>
            </div>
          </Alert>
        )}

        <DialogFooter className="border-white/[0.08] bg-[#10121A]/80">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
            className="border-white/10 bg-transparent text-zinc-200"
          >
            Keep running
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!job || isPending}
            onClick={() => {
              if (job) {
                onConfirm(job.job_id);
              }
            }}
          >
            {isPending ? "Cancelling..." : "Confirm cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
