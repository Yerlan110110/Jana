import type { ComponentProps, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from './upstream/button';

type ActionButtonProps = ComponentProps<typeof Button> & {
  loading?: boolean;
  loadingLabel?: string;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
};

export function ActionButton({ loading, loadingLabel = 'Сохраняем', disabled, iconStart, iconEnd, children, className = '', ...props }: ActionButtonProps) {
  return <Button className={`action-button ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    <span className={loading ? 'button-label button-label-pending' : 'button-label'}>{iconStart}{children}{iconEnd}</span>
    {loading && <span className="button-wait" role="status" aria-label={loadingLabel}><LoaderCircle size={16} aria-hidden="true" /></span>}
  </Button>;
}
