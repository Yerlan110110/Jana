// Pace Card. Anatomy: shadcn vendor/shadcn/ui/card.tsx (compound slots incl. CardAction). Visual/motion: oa vendor/oa/skills/oa-design/01-squircle-card.md + components/squircle-card/squircle-card.tsx (squircle plate, inset well). Stage: amicro vendor/amicro/.agents/skills/amicro-design-system/SKILL.md. Tokens: styles/pace.css.
"use client";

import * as React from "react";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "./cn";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      data-pace-component="card"
      className={cn(
        // Hairline via inset shadow, not `border`: the squircle clip-path cuts
        // a rect border unevenly at the corners, leaving jagged dark edges.
        "pace-squircle relative flex min-w-0 flex-col bg-card p-1 text-card-foreground shadow-[var(--shadow-resting),inset_0_0_0_1px_var(--border)]",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid auto-rows-min grid-rows-[auto_auto] items-start gap-x-2 pb-2 ps-3.5 pe-2 pt-1.5 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className
      )}
      {...props}
    />
  );
}

function CardTitle({
  className,
  asChild = false,
  render,
  children,
  ...props
}: useRender.ComponentProps<"h2"> & { asChild?: boolean }) {
  if (asChild && !React.isValidElement(children)) {
    throw new Error("CardTitle asChild needs one React element. Pass a heading element as its child or use render.");
  }
  return useRender({
    defaultTagName: "h2",
    render: asChild && React.isValidElement(children) ? children : render,
    props: {
      "data-slot": "card-title",
      className: cn(
        "flex min-w-0 items-center gap-2 text-sm font-medium text-foreground/80 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        className
      ),
      ...props,
      ...(asChild ? {} : { children }),
    },
  });
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 flex shrink-0 items-center gap-1 self-center justify-self-end", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-xs leading-5 text-muted-foreground", className)}
      {...props}
    />
  );
}

/* The recessed stage-grey inset: fixed `h-44` (five 32px rows) — cards never
   grow with their data; longer lists scroll inside. Rows supply the
   horizontal padding this leaves free. */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn(
        "pace-squircle pace-squircle-inset h-44 min-w-0 overflow-auto bg-background py-2 shadow-[var(--shadow-resting),inset_0_0_0_1px_var(--border)]",
        className
      )}
      {...props}
    />
  );
}

/* The standard inset row (OA SquircleCardRow): 32px, full-bleed hover wash,
   tabular numbers — it owns the inset's horizontal padding. */
function CardRow({
  className,
  label,
  value,
  ...props
}: React.ComponentProps<"div"> & {
  label: React.ReactNode;
  value?: React.ReactNode;
}) {
  return (
    <div
      data-slot="card-row"
      className={cn(
        "flex h-8 items-center justify-between gap-3 px-3.5 text-sm transition-colors hover:bg-accent",
        className
      )}
      {...props}
    >
      <span className="min-w-0 truncate">{label}</span>
      {value !== undefined ? (
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {value}
        </span>
      ) : null}
    </div>
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center justify-between gap-2 px-3 pb-1.5 pt-2", className)}
      {...props}
    />
  );
}

/* Amicro's inset preview canvas: a centered stage inside the card frame. */
function CardStage({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-stage"
      data-pace-component="card-stage"
      className={cn(
        "relative flex min-h-32 items-center justify-center overflow-hidden rounded-xl bg-background shadow-[inset_0_0_0_1px_var(--border)]",
        className
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  CardRow,
  CardFooter,
  CardStage,
};
