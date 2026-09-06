import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface LoadingStateProps {
  variant?: 'inline' | 'page';
  label?: string;
  className?: string;
}

export const LoadingState = ({ variant = 'inline', label = 'Loading…', className }: LoadingStateProps) => (
  <div
    className={cn(
      'flex items-center justify-center gap-2 text-sm text-muted-foreground',
      variant === 'page' && 'py-16',
      className,
    )}
  >
    <Loader2 className="size-4 animate-spin" />
    <span>{label}</span>
  </div>
);
