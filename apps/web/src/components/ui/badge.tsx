import { type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'border-status-neutral/25 bg-status-neutral/10 text-status-neutral',
        info: 'border-status-info/25 bg-status-info/10 text-status-info',
        progress: 'border-status-progress/25 bg-status-progress/10 text-status-progress',
        success: 'border-status-success/20 bg-status-success-soft text-status-success',
        warning: 'border-status-warning/25 bg-status-warning/10 text-status-warning',
        danger: 'border-status-danger/20 bg-status-danger-soft text-status-danger',
        muted: 'border-border bg-muted text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant, className }))} {...props} />
);
