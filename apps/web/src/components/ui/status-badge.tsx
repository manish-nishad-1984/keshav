import { describeStatus, type StatusTone } from '@ckfast/shared';
import { Badge } from './badge';
import { cn } from '../../lib/utils';

const DOT_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-status-neutral',
  info: 'bg-status-info',
  progress: 'bg-status-progress',
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  danger: 'bg-status-danger',
  muted: 'bg-muted-foreground',
};

export const StatusBadge = ({ status, dot = true }: { status: string; dot?: boolean }) => {
  const { label, tone } = describeStatus(status);
  return (
    <Badge variant={tone}>
      {dot ? <span className={cn('size-1.5 rounded-full', DOT_CLASSES[tone])} /> : null}
      {label}
    </Badge>
  );
};
