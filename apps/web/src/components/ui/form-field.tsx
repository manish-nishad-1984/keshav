import type { ReactNode } from 'react';
import { Label } from './label';
import { cn } from '../../lib/utils';

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

export const FormField = ({ label, required, hint, error, htmlFor, children, className }: FormFieldProps) => (
  <div className={cn('space-y-1.5', className)}>
    <Label htmlFor={htmlFor} required={required}>
      {label}
    </Label>
    {children}
    {error ? (
      <p className="text-2xs font-medium text-destructive">{error}</p>
    ) : hint ? (
      <p className="text-2xs text-muted-foreground">{hint}</p>
    ) : null}
  </div>
);
