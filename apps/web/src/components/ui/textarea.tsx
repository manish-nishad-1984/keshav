import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { fieldBase, invalidField, readOnlyField } from './field-styles';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[5rem] w-full px-3 py-2',
      fieldBase,
      readOnlyField,
      invalid && invalidField,
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
