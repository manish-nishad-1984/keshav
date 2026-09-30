import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePicker } from '../ui/date-picker';
import type { Karigar } from '../karigars/karigar-constants';
import { PAYMENT_MODES, PAYMENT_MODE_LABELS, type LedgerRow } from './payment-constants';
import { localIsoDate } from '../../lib/date';

const todayInputValue = () => localIsoDate();

const emptyForm = {
  date: todayInputValue(),
  karigarId: '',
  amount: '',
  paymentMode: 'CASH' as (typeof PAYMENT_MODES)[number],
  referenceNo: '',
  remarks: '',
};

interface PaymentEntryViewProps {
  onDone: () => void;
  onCancel: () => void;
}

export const PaymentEntryView = ({ onDone, onCancel }: PaymentEntryViewProps) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: karigars } = useQuery({
    queryKey: ['karigars', 'options'],
    queryFn: () => apiClient.list<Karigar>('/karigars', { page: 1, pageSize: 100 }),
  });
  const activeKarigars = karigars?.items.filter((k) => k.isActive) ?? [];

  const { data: ledger } = useQuery({
    queryKey: ['payments', 'ledger'],
    queryFn: () => apiClient.get<LedgerRow[]>('/payments/ledger'),
  });
  const selectedLedgerRow = ledger?.find((row) => row.karigarId === form.karigarId);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post('/payments', {
        date: form.date,
        karigarId: form.karigarId,
        amount: Number(form.amount),
        paymentMode: form.paymentMode,
        referenceNo: form.referenceNo || undefined,
        remarks: form.remarks || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      onDone();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'),
  });

  const isValid = Boolean(form.date && form.karigarId && form.amount && Number(form.amount) > 0);

  return (
    <Card>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {error ? <FormAlert tone="error">{error}</FormAlert> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Date" required>
              <DatePicker required value={form.date} onChange={(date) => setForm((f) => ({ ...f, date }))} />
            </FormField>

            <FormField label="Karigar" required>
              <Select value={form.karigarId} onValueChange={(v) => setForm((f) => ({ ...f, karigarId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select karigar" />
                </SelectTrigger>
                <SelectContent>
                  {activeKarigars.map((karigar) => (
                    <SelectItem key={karigar.id} value={karigar.id}>
                      {karigar.fullName} ({karigar.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Total Due Amount (₹)">
              <Input disabled className="numeric" value={(selectedLedgerRow?.pending ?? 0).toFixed(2)} />
            </FormField>

            <FormField label="Payment Amount (₹)" required>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                required
                className="numeric"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </FormField>

            <FormField label="Payment Mode" required>
              <Select
                value={form.paymentMode}
                onValueChange={(v) => setForm((f) => ({ ...f, paymentMode: v as (typeof PAYMENT_MODES)[number] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {PAYMENT_MODE_LABELS[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Reference No.">
              <Input
                value={form.referenceNo}
                onChange={(e) => setForm((f) => ({ ...f, referenceNo: e.target.value }))}
              />
            </FormField>
          </div>

          <FormField label="Remarks">
            <Textarea value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
          </FormField>

          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Button type="submit" loading={mutation.isPending} disabled={!isValid}>
              Save Payment
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
