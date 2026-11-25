import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative flex w-full items-start gap-3 rounded-xl border p-3.5 text-sm",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-white/[0.03] text-zinc-200",
        info: "border-indigo-400/20 bg-indigo-500/[0.08] text-indigo-100",
        warning: "border-amber-500/25 bg-amber-500/[0.08] text-amber-100",
        destructive: "border-red-500/25 bg-red-500/[0.08] text-red-100",
        success: "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"h5">) {
  return (
    <h5
      data-slot="alert-title"
      className={cn("font-medium leading-5 tracking-tight", className)}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("mt-1 text-xs leading-5 opacity-90", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
