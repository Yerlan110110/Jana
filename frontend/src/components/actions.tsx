import type { ComponentProps, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Link } from "react-router";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/components/pace/cn";
import { Button, buttonVariants } from "./upstream/button";

type ActionButtonProps = Omit<ComponentProps<typeof Button>, "render"> & {
  loading?: boolean;
  loadingLabel?: string;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
};

type ActionLinkProps = ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants> & {
    iconStart?: ReactNode;
    iconEnd?: ReactNode;
  };

export function ActionLink({
  variant,
  size,
  iconStart,
  iconEnd,
  children,
  className,
  ...props
}: ActionLinkProps) {
  return (
    <Link
      className={cn(
        buttonVariants({ variant, size }),
        "action-button",
        variant === "destructive" && "text-destructive-foreground",
        className,
      )}
      {...props}
    >
      <span className="button-label">
        {iconStart}
        {children}
        {iconEnd}
      </span>
    </Link>
  );
}

export function ActionButton({
  loading,
  loadingLabel = "Сохраняем",
  disabled,
  iconStart,
  iconEnd,
  variant,
  children,
  className = "",
  ...props
}: ActionButtonProps) {
  return (
    <Button
      className={cn(
        "action-button",
        variant === "destructive" && "text-destructive-foreground",
        className,
      )}
      variant={variant}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      <span
        className={
          loading ? "button-label button-label-pending" : "button-label"
        }
      >
        {iconStart}
        {children}
        {iconEnd}
      </span>
      {loading && (
        <span className="button-wait" role="status" aria-label={loadingLabel}>
          <LoaderCircle size={16} aria-hidden="true" />
        </span>
      )}
    </Button>
  );
}
