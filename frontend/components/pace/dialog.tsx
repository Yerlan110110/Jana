// Pace Dialog. Visual/motion: oa vendor/oa/components/modal/modal.tsx + skills/oa-design/05-modal.md (centered pop, never slides from an edge). Behavior: shadcn vendor/shadcn/ui/dialog.tsx (Base UI Dialog). Tokens: styles/pace.css.
"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "./cn";

type StyledProps<T> = Omit<T, "className"> & { className?: string };

function childRender(children: React.ReactNode) {
  // Flight can wrap a Server Component's element in a lazy value. Match
  // Base UI's render normalization before enforcing the single-element API.
  const elements = React.Children.toArray(children);
  const child = elements[0];
  if (elements.length !== 1 || !React.isValidElement(child) || child.type === React.Fragment) {
    throw new Error("Dialog asChild requires one element. Pass a single child that forwards props and ref, or use render.");
  }
  return child;
}

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ asChild, children, render, ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger> & { asChild?: boolean }) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" render={asChild ? childRender(children) : render} children={asChild ? undefined : children} {...props} />;
}

function DialogPortal({ forceMount, keepMounted, ...props }:
  React.ComponentProps<typeof DialogPrimitive.Portal> & { forceMount?: true }) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" keepMounted={keepMounted ?? forceMount} {...props} />;
}

function DialogClose({ asChild, children, render, ...props }: React.ComponentProps<typeof DialogPrimitive.Close> & { asChild?: boolean }) {
  return <DialogPrimitive.Close data-slot="dialog-close" render={asChild ? childRender(children) : render} children={asChild ? undefined : children} {...props} />;
}

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
const SELECTABLE_INPUT = new Set(["text", "search", "url", "tel", "password", "email", "number"]);

/** First tabbable element in DOM order; a text field gets its value selected on open. */
function focusFirstTabbable(popup: HTMLElement | null) {
  const first = Array.from(popup?.querySelectorAll<HTMLElement>(TABBABLE) ?? []).find(
    (el) => el.tabIndex >= 0 && !el.closest("[inert]") && el.getClientRects().length > 0
  );
  if (!first) return true;
  if (first instanceof HTMLTextAreaElement || (first instanceof HTMLInputElement && SELECTABLE_INPUT.has(first.type))) {
    first.focus({ preventScroll: true });
    first.select();
  }
  return first;
}

function DialogOverlay({
  className,
  ...props
}: StyledProps<React.ComponentProps<typeof DialogPrimitive.Backdrop>>) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/30 data-open:animate-[pace-fade-in_var(--motion-fast)_ease-out] data-closed:animate-[pace-fade-out_var(--motion-fast)_ease-out_forwards]",
        className
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  forceMount,
  keepMounted,
  children,
  showCloseButton = true,
  closeLabel = "Close",
  initialFocus,
  ref,
  ...props
}: StyledProps<React.ComponentProps<typeof DialogPrimitive.Popup>> & {
  forceMount?: true;
  keepMounted?: boolean;
  showCloseButton?: boolean;
  /** Accessible label for the close button (default "Close"). */
  closeLabel?: string;
}) {
  const popupRef = React.useRef<HTMLDivElement | null>(null);
  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      popupRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );
  return (
    <DialogPortal data-slot="dialog-portal" keepMounted={keepMounted ?? forceMount}>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-pace-component="dialog"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] gap-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-floating)] outline-none sm:max-w-[32rem]",
          "-translate-x-1/2 -translate-y-1/2",
          "data-open:animate-[pace-modal-in_var(--motion-spring-pop-duration)_var(--motion-spring-pop)] data-closed:animate-[pace-modal-out_var(--motion-spring-pop-exit-duration)_var(--motion-spring-pop-exit)_forwards]",
          className
        )}
        ref={setRef}
        initialFocus={initialFocus ?? ((openType) => openType === "touch" || focusFirstTabbable(popupRef.current))}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 end-4 rounded-full p-1 text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">{closeLabel}</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5 text-center sm:text-start", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  asChild, children, render, ...props
}: StyledProps<React.ComponentProps<typeof DialogPrimitive.Title>> & { asChild?: boolean }) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-base leading-snug font-medium tracking-tight", className)}
      render={asChild ? childRender(children) : render}
      children={asChild ? undefined : children}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  asChild, children, render, ...props
}: StyledProps<React.ComponentProps<typeof DialogPrimitive.Description>> & { asChild?: boolean }) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      render={asChild ? childRender(children) : render}
      children={asChild ? undefined : children}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
