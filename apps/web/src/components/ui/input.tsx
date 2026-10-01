import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { fieldBase, invalidField, readOnlyField } from './field-styles';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-9 w-full px-3 py-1 max-sm:h-11',
        fieldBase,
        readOnlyField,
        invalid && invalidField,
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
