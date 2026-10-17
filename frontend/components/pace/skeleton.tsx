// Pace Skeleton. Visual/motion: oa vendor/oa/skills/oa-design/07-skeleton.md; amicro vendor/amicro/registry/ui/loading/fluid-skeleton.tsx (pulse sweep). Tokens: styles/pace.css.
import * as React from "react";
import { cn } from "./cn";

export interface SkeletonProps extends React.ComponentProps<"span"> {
  /** Opt in to the fluid sweep; static bars are the default. */
  pulse?: boolean;
}

export function Skeleton({ className, pulse = false, ...props }: SkeletonProps) {
  return (
    <span
      data-pace-component="skeleton"
      aria-hidden="true"
      className={cn(
        "pace-skeleton-bar block rounded",
        pulse && "pace-skeleton-pulse",
        className
      )}
      {...props}
    />
  );
}

/* A text-line slot: the bar centered in the same line-height as the text it
   stands for, so the swap moves nothing. */
export function SkeletonLine({
  slot = "h-6",
  bar = "h-3 w-2/3",
  pulse = false,
}: {
  slot?: string;
  bar?: string;
  pulse?: boolean;
}) {
  return (
    <span className={cn("flex items-center", slot)}>
      <Skeleton pulse={pulse} className={cn("max-w-full", bar)} />
    </span>
  );
}

/* Wrap arriving content: children mount with the one-shot blur reveal. */
export function Arrive({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("oa-arrive", className)}>{children}</div>;
}
