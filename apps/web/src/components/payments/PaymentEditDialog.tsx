import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { formatDate } from '../../lib/date';
import { formatMoney } from '../../lib/format';
import { NEW_PAYMENT_MODES, PAYMENT_MODE_LABELS, type Payment, type PaymentMode } from './payment-constants';

interface PaymentEditDialogProps {
  payment: Payment | null;
  onOpenChange: (open: boolean) => void;
}

// Corrects a saved payment. A salary payment is changed through its attendance (the amount follows);
// any other payment through its amount. Every change is kept in the payment's history (audit log).
export const PaymentEditDialog = ({ payment, onOpenChange }: PaymentEditDialogProps) => {
  const queryClient = useQueryClient();
  const isSalary = Boolean(payment?.perDayRate);
  const [form, setForm] = useState({ amount: '', presentDays: '', absentDays: '', overtimeHours: '', paymentMode: 'CASH' as PaymentMode, remarks: '' });
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!payment) return;
    setForm({
      amount: String(Number(payment.amount)),
      presentDays: String(payment.presentDays ?? 0),
      absentDays: String(payment.absentDays ?? 0),
      overtimeHours: String(Number(payment.overtimeHours ?? 0)),
      paymentMode: payment.paymentMode,
      remarks: payment.remarks ?? '',
    });
    setError(null);
    setWarning(null);
  }, [payment]);

  const saveMutation = useMutation({
    mutationFn: (confirmed: boolean) =>
      apiClient.patch(`/payments/${payment!.id}`, {
        ...(isSalary
          ? { presentDays: Number(form.presentDays || 0), absentDays: Number(form.absentDays || 0), overtimeHours: Number(form.overtimeHours || 0) }
          : { amount: Number(form.amount) }),
        paymentMode: form.paymentMode,
        remarks: form.remarks,
        confirmed,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      onOpenChange(false);
    },
    onError: (err) => {
      if (err instanceof ApiRequestError && err.code === 'ADVANCE_CONFIRM') {
        setWarning(err.message);
        return;
      }
      setError(err instanceof ApiRequestError ? err.message : 'Could not save. Please try again.');
    },
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setWarning(null);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };
  const modes: PaymentMode[] = payment && !NEW_PAYMENT_MODES.includes(payment.paymentMode as never) ? [...NEW_PAYMENT_MODES, payment.paymentMode] : [...NEW_PAYMENT_MODES];
  const invalid = isSalary ? form.presentDays === '' : !(Number(form.amount) > 0);

  return (
    <Dialog open={Boolean(payment)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit payment</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {payment ? (
            <p className="text-xs text-muted-foreground">
              {formatDate(payment.date)}
              {payment.entryTime ? ` ${payment.entryTime}` : ''} · now {formatMoney(payment.amount)}
              {isSalary ? ` · salary at ${formatMoney(payment.perDayRate)} per day` : ''}
            </p>
          ) : null}
          {error ? <FormAlert tone="error">{error}</FormAlert> : null}

          {isSalary ? (
            <div className="grid grid-cols-3 gap-2">
              <FormField label="Present days" htmlFor="pe-present">
                <Input id="pe-present" inputMode="numeric" value={form.presentDays} onChange={set('presentDays')} />
              </FormField>
              <FormField label="Absent days" htmlFor="pe-absent">
                <Input id="pe-absent" inputMode="numeric" value={form.absentDays} onChange={set('absentDays')} />
              </FormField>
              <FormField label="Overtime (h)" htmlFor="pe-ot">
                <Input id="pe-ot" inputMode="decimal" value={form.overtimeHours} onChange={set('overtimeHours')} />
              </FormField>
            </div>
          ) : (
            <FormField label="Amount (₹)" htmlFor="pe-amount">
              <Input id="pe-amount" inputMode="decimal" value={form.amount} onChange={set('amount')} />
            </FormField>
          )}

          <FormField label="Mode" htmlFor="pe-mode">
            <Select value={form.paymentMode} onValueChange={(v) => setForm((f) => ({ ...f, paymentMode: v as PaymentMode }))}>
              <SelectTrigger id="pe-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modes.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Remarks" htmlFor="pe-remarks">
            <Input id="pe-remarks" value={form.remarks} onChange={set('remarks')} />
          </FormField>

          {warning ? <FormAlert tone="warning">{warning}</FormAlert> : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate(Boolean(warning))} loading={saveMutation.isPending} disabled={invalid}>
            <Save />
            {warning ? 'Save as advance' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
