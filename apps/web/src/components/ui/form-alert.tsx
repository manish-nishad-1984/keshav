import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/utils';

type FormAlertTone = 'error' | 'warning' | 'success' | 'info';

const TONE_CLASSES: Record<FormAlertTone, string> = {
  error: 'border-destructive/30 bg-destructive/5 text-destructive',
  warning: 'border-status-warning/30 bg-status-warning/5 text-status-warning',
  success: 'border-status-success/30 bg-status-success/5 text-status-success',
  info: 'border-border bg-muted/40 text-foreground',
};

const TONE_ICONS: Record<FormAlertTone, typeof AlertCircle> = {
  error: AlertCircle,
  warning: TriangleAlert,
  success: CheckCircle2,
  info: Info,
};

export const FormAlert = ({ tone, children }: { tone: FormAlertTone; children: ReactNode }) => {
  const Icon = TONE_ICONS[tone];
  return (
    <div className={cn('flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm', TONE_CLASSES[tone])}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
};
