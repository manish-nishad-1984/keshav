import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-primary/45 bg-card text-primary hover:border-primary hover:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'text-foreground-soft hover:bg-accent hover:text-primary',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 max-sm:h-11',
        sm: 'h-8 px-3 text-xs max-sm:h-10',
        lg: 'h-10 px-6 max-sm:h-11',
        icon: 'size-9 max-sm:size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const commonProps = {
      className: cn(buttonVariants({ variant, size, className })),
      ref,
      disabled: disabled || loading,
      ...props,
    };

    // Slot (asChild) requires exactly one element child — React.Children.count still counts a
    // `null` sibling, so the spinner can't be a second child alongside `children` in this branch.
    if (asChild) {
      return <Slot {...commonProps}>{children}</Slot>;
    }

    return (
      <button {...commonProps}>
        {loading ? <Loader2 className="animate-spin" /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
