import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { LoadingState } from '../ui/loading-state';
import { formatDateTime } from '../../lib/date';
import { formatMoney } from '../../lib/format';
import { PAYMENT_MODE_LABELS, type PaymentMode } from './payment-constants';

interface Change {
  id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changedFields: string[];
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  actorEmail: string | null;
  createdAt: string;
}

const FIELD_LABELS: Record<string, string> = {
  amount: 'Amount',
  paymentMode: 'Mode',
  remarks: 'Remarks',
  presentDays: 'Present days',
  absentDays: 'Absent days',
  overtimeHours: 'Overtime (h)',
  salaryAmount: 'Salary',
  referenceNo: 'Reference',
};
const MONEY = new Set(['amount', 'salaryAmount']);
const HIDDEN = new Set(['updatedAt', 'updatedById', 'deletedAt', 'karigar']);

const show = (field: string, value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (MONEY.has(field)) return formatMoney(value as string);
  if (field === 'paymentMode') return PAYMENT_MODE_LABELS[value as PaymentMode] ?? String(value);
  return String(value);
};

const ACTION: Record<Change['action'], { label: string; variant: 'success' | 'info' | 'danger' }> = {
  CREATE: { label: 'Added', variant: 'success' },
  UPDATE: { label: 'Edited', variant: 'info' },
  DELETE: { label: 'Deleted', variant: 'danger' },
};

// The saved history of one payment: when it was added, every edit (old → new) and the delete, with who did it.
export const PaymentChangesDialog = ({ paymentId, onOpenChange }: { paymentId: string | null; onOpenChange: (open: boolean) => void }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['payments', 'changes', paymentId],
    queryFn: () => apiClient.get<Change[]>(`/payments/${paymentId}/history`),
    enabled: Boolean(paymentId),
  });

  return (
    <Dialog open={Boolean(paymentId)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Payment history</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-2">
          {isLoading ? <LoadingState /> : null}
          {data && !data.length ? <p className="text-sm text-muted-foreground">No changes recorded for this payment.</p> : null}
          {data?.map((c) => {
            const fields = c.changedFields.filter((f) => !HIDDEN.has(f));
            return (
              <div key={c.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={ACTION[c.action].variant}>{ACTION[c.action].label}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(c.createdAt)}
                    {c.actorEmail ? ` · ${c.actorEmail}` : ''}
                  </span>
                </div>
                {c.action === 'UPDATE' && fields.length ? (
                  <ul className="mt-1.5 space-y-0.5 text-xs">
                    {fields.map((f) => (
                      <li key={f}>
                        <span className="text-muted-foreground">{FIELD_LABELS[f] ?? f}:</span>{' '}
                        <span className="line-through opacity-70">{show(f, c.oldValues?.[f])}</span> → <span className="font-medium">{show(f, c.newValues?.[f])}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {c.action === 'CREATE' && c.newValues ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {show('amount', c.newValues.amount)} · {show('paymentMode', c.newValues.paymentMode)}
                  </p>
                ) : null}
              </div>
            );
          })}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
