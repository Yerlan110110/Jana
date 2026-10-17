// Pace Textarea. Visual/motion: amicro vendor/amicro/src/components/forms/AnimatedFormElement.tsx (frm11 auto-grow). Behavior: shadcn vendor/shadcn/ui/textarea.tsx. Tokens: styles/pace.css.
"use client";

import * as React from "react";
import { cn } from "./cn";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  autoGrow?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, autoGrow = false, onInput, rows = 2, ...props },
  ref
) {
  const grow: NonNullable<TextareaProps["onInput"]> = (event) => {
    if (autoGrow) {
      const target = event.currentTarget;
      target.style.height = "auto";
      target.style.height = `${target.scrollHeight}px`;
    }
    onInput?.(event);
  };

  return (
    <textarea
      ref={ref}
      data-pace-component="textarea"
      rows={rows}
      onInput={grow}
      className={cn(
        "w-full rounded-lg border border-input bg-card px-3 py-2 text-base sm:text-sm leading-6 text-foreground shadow-[var(--shadow-inset)] outline-none transition-[border-color,box-shadow] duration-150",
        "placeholder:text-muted-foreground",
        "hover:border-[color-mix(in_srgb,var(--ink)_20%,transparent)]",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive",
        autoGrow && "resize-none",
        className
      )}
      {...props}
    />
  );
});
