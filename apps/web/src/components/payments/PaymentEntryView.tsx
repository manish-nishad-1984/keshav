import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../../lib/utils';
import { formatDate } from '../../lib/date';
import type { Karigar } from '../karigars/karigar-constants';
import { NEW_PAYMENT_MODES, PAYMENT_MODE_LABELS } from './payment-constants';

type NewPaymentMode = (typeof NEW_PAYMENT_MODES)[number];

const emptyForm = () => ({
  karigarId: '',
  amount: '',
  paymentMode: 'CASH' as NewPaymentMode,
  presentDays: '',
  absentDays: '',
  overtimeHours: '',
  remarks: '',
  // Fixed karigar: UPAD = money taken during the month; SALARY = month-end payout.
  kind: 'SALARY' as 'SALARY' | 'UPAD',
  // Salary payout: what is handed over now; empty = all that is owed.
  paidNow: '',
});

interface KarigarAccount {
  pending: number;
  lastSalary: { date: string; salary: number; paid: number } | null;
  advances: { id: string; date: string; entryTime: string | null; amount: number; paymentMode: string; remarks: string | null }[];
  advanceTotal: number;
}

const money = (value: number) => value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const round2 = (n: number) => Math.round(n * 100) / 100;
// Working hours in one day's shift; an overtime hour is paid at per day ÷ this.
const SHIFT_HOURS = 12;
const isFixed = (k: Karigar | undefined) => k?.salaryType === 'FIXED';

// Ticks every 30 s so the shown date & time stay current; the server stamps the real time on save.
const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

interface PaymentEntryViewProps {
  onDone: () => void;
  onCancel: () => void;
}

export const PaymentEntryView = ({ onDone, onCancel }: PaymentEntryViewProps) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();
  const set = (patch: Partial<ReturnType<typeof emptyForm>>) => setForm((f) => ({ ...f, ...patch }));

  const { data: karigars } = useQuery({
    queryKey: ['karigars', 'options'],
    queryFn: () => apiClient.list<Karigar>('/karigars', { page: 1, pageSize: 100 }),
  });
  const activeKarigars = karigars?.items.filter((k) => k.isActive) ?? [];
  const karigar = activeKarigars.find((k) => k.id === form.karigarId);
  const fixed = isFixed(karigar);

  // Fixed karigar: per day = monthly ÷ 30; a shift is 12 hours, so overtime is per day ÷ 12 an hour (same as the server).
  const monthly = karigar?.monthlySalary ? Number(karigar.monthlySalary) : 0;
  const perDay = round2(monthly / 30);
  const present = Number(form.presentDays) || 0;
  const overtime = Number(form.overtimeHours) || 0;
  const presentPay = present * perDay;
  const overtimePay = (overtime * perDay) / SHIFT_HOURS;
  const salary = round2(presentPay + overtimePay);

  // What the karigar is owed right now and the upad taken since the last salary (Fixed karigar).
  const { data: account } = useQuery({
    queryKey: ['payments', 'account', form.karigarId],
    queryFn: () => apiClient.get<KarigarAccount>(`/payments/karigar/${form.karigarId}/account`),
    enabled: Boolean(form.karigarId),
  });
  const upad = fixed && form.kind === 'UPAD';
  // Owed after this salary = balance till now (negative after upad) + this salary.
  const owed = round2(Math.max((account?.pending ?? 0) + salary, 0));
  const paidNow = form.paidNow === '' ? owed : Number(form.paidNow) || 0;

  // Set when the server warns (advance / possible duplicate) and the user must confirm.
  const [warning, setWarning] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (confirmed: boolean) =>
      apiClient.post('/payments', {
        confirmed: confirmed || undefined,
        karigarId: form.karigarId,
        paymentMode: form.paymentMode,
        remarks: form.remarks || undefined,
        ...(upad
          ? { kind: 'ADVANCE', amount: Number(form.amount) }
          : fixed
            ? {
                kind: 'SALARY',
                presentDays: present,
                absentDays: Number(form.absentDays) || 0,
                overtimeHours: overtime,
                paidNow: form.paidNow === '' ? undefined : paidNow,
              }
            : { amount: Number(form.amount) }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      onDone();
    },
    onError: (err) => {
      if (err instanceof ApiRequestError && (err.code === 'ADVANCE_CONFIRM' || err.code === 'DUPLICATE_PAYMENT')) {
        setWarning(err.message);
        return;
      }
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');
    },
  });

  const isValid = Boolean(form.karigarId && (upad || !fixed ? Number(form.amount) > 0 : monthly > 0 && salary > 0));

  const dateText = now.toLocaleDateString('en-GB');
  const timeText = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            mutation.mutate(false);
          }}
        >
          {error ? <FormAlert tone="error">{error}</FormAlert> : null}

          <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)]">
            <FormField label="Date & Time" hint="Set automatically — cannot be changed">
              <div className="flex gap-2">
                <Input readOnly tabIndex={-1} aria-label="Date" className="numeric min-w-0 flex-1" value={dateText} />
                <Input readOnly tabIndex={-1} aria-label="Time" className="numeric w-24 shrink-0" value={timeText} />
              </div>
            </FormField>

            <FormField label="Karigar" required>
              <Select value={form.karigarId} onValueChange={(v) => set({ karigarId: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select karigar" />
                </SelectTrigger>
                <SelectContent>
                  {activeKarigars.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.fullName} ({k.code}){isFixed(k) ? ' · Fixed' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Payment Mode" required>
              <div role="radiogroup" aria-label="Payment mode" className="flex h-9 rounded-md border border-border bg-muted p-0.5 max-sm:h-11">
                {NEW_PAYMENT_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={form.paymentMode === mode}
                    onClick={() => set({ paymentMode: mode })}
                    className={cn(
                      'flex-1 rounded px-4 text-sm transition-colors',
                      form.paymentMode === mode ? 'bg-card font-semibold text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {PAYMENT_MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
            </FormField>
          </div>

          {fixed ? (
            <div className="space-y-2">
              <div role="radiogroup" aria-label="Payment type" className="inline-flex h-9 rounded-md border border-border bg-muted p-0.5 max-sm:h-11">
                {(
                  [
                    ['SALARY', 'Salary (month end)'],
                    ['UPAD', 'Upad (advance)'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={form.kind === key}
                    onClick={() => set({ kind: key })}
                    className={cn(
                      'rounded px-4 text-sm transition-colors',
                      form.kind === key ? 'bg-card font-semibold text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {account ? (
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-50">
                  <p className="font-medium">
                    Upad taken {account.lastSalary ? `since last salary (${formatDate(account.lastSalary.date)})` : 'so far'}:{' '}
                    <span className="numeric">₹ {money(account.advanceTotal)}</span> ({account.advances.length} times)
                  </p>
                  {account.advances.length ? (
                    <p className="mt-0.5 text-xs opacity-80">
                      {account.advances.map((a) => `${formatDate(a.date)} ₹${money(a.amount)}`).join(' · ')}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs">
                    Balance now:{' '}
                    <span className="numeric font-semibold">
                      {account.pending < 0 ? `₹ ${money(-account.pending)} taken in advance` : `₹ ${money(account.pending)} to pay`}
                    </span>
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {fixed && !upad ? (
            <section aria-labelledby="salary-heading" className="space-y-2.5 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id="salary-heading" className="text-sm font-semibold">
                  Salary by attendance
                </h3>
                <span className="text-xs text-muted-foreground">
                  Monthly <span className="numeric font-semibold text-foreground">₹ {money(monthly)}</span> ÷ 30 = per day{' '}
                  <span className="numeric font-semibold text-foreground">₹ {money(perDay)}</span>
                </span>
              </div>
              {!monthly ? (
                <FormAlert tone="error">
                  {karigar?.fullName} has no monthly salary yet. Set it in Karigar Master first.
                </FormAlert>
              ) : null}
              <div className="grid grid-cols-3 gap-x-3 gap-y-2.5">
                <FormField label="Present Days" required htmlFor="pay-present">
                  <Input
                    id="pay-present"
                    type="number"
                    min={0}
                    max={31}
                    step={1}
                    inputMode="numeric"
                    className="numeric text-right"
                    value={form.presentDays}
                    onChange={(e) => set({ presentDays: e.target.value })}
                  />
                </FormField>
                <FormField label="Absent Days" htmlFor="pay-absent">
                  <Input
                    id="pay-absent"
                    type="number"
                    min={0}
                    max={31}
                    step={1}
                    inputMode="numeric"
                    className="numeric text-right"
                    value={form.absentDays}
                    onChange={(e) => set({ absentDays: e.target.value })}
                  />
                </FormField>
                <FormField label="Overtime (hours)" htmlFor="pay-overtime">
                  <Input
                    id="pay-overtime"
                    type="number"
                    min={0}
                    step="0.5"
                    inputMode="decimal"
                    className="numeric text-right"
                    value={form.overtimeHours}
                    onChange={(e) => set({ overtimeHours: e.target.value })}
                  />
                </FormField>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 rounded-md bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  {present} days × ₹{money(perDay)} = <span className="numeric text-foreground">₹ {money(presentPay)}</span>
                </span>
                <span className="text-muted-foreground">
                  OT {overtime} h × ₹{money(perDay / SHIFT_HOURS)} = <span className="numeric text-foreground">₹ {money(overtimePay)}</span>
                </span>
                <span className="font-semibold">
                  Salary <output aria-live="polite" className="numeric text-base text-primary">₹ {money(salary)}</output>
                </span>
              </div>
              {salary > 0 && account ? (
                <div className="space-y-1 rounded-md border border-border px-3 py-2 text-sm">
                  <div className="flex justify-between">
                    <span>Salary</span>
                    <span className="numeric">₹ {money(salary)}</span>
                  </div>
                  {account.pending !== 0 ? (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{account.pending < 0 ? '− Upad / advance already taken' : '+ Earlier balance'}</span>
                      <span className="numeric">
                        {account.pending < 0 ? '−' : '+'} ₹ {money(Math.abs(account.pending))}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-border pt-1 font-semibold">
                    <span>Remaining to pay</span>
                    <span className="numeric text-primary">₹ {money(owed)}</span>
                  </div>
                  {(account.pending ?? 0) + salary < 0 ? (
                    <p className="text-xs text-muted-foreground">Upad is more than this salary: ₹ {money(-((account.pending ?? 0) + salary))} stays as advance for next month.</p>
                  ) : null}
                  <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
                    <FormField label="Paying now (₹)" htmlFor="pay-now" hint="Leave empty to pay the full remaining amount" className="w-56">
                      <Input
                        id="pay-now"
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        className="numeric text-right"
                        placeholder={money(owed)}
                        value={form.paidNow}
                        onChange={(e) => set({ paidNow: e.target.value })}
                      />
                    </FormField>
                    {paidNow < owed - 0.005 ? (
                      <span className="text-xs text-muted-foreground">₹ {money(owed - paidNow)} stays pending</span>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>
          ) : (
            <div className="grid gap-x-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label={upad ? 'Upad Amount (₹)' : 'Payment Amount (₹)'} required htmlFor="pay-amount">
                <Input
                  id="pay-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  className="numeric text-right"
                  value={form.amount}
                  onChange={(e) => set({ amount: e.target.value })}
                />
              </FormField>
            </div>
          )}

          <FormField label="Remarks">
            <Textarea rows={2} className="min-h-14 resize-y" value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} />
          </FormField>

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" loading={mutation.isPending} disabled={!isValid}>
              <Save />
              {upad ? 'Save Upad' : fixed && salary > 0 ? `Pay Salary ₹ ${money(paidNow)}` : 'Save Payment'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
      <ConfirmDialog
        open={warning !== null}
        onOpenChange={(open) => !open && setWarning(null)}
        title="Please confirm this payment"
        description={warning}
        confirmLabel="Yes, record payment"
        isSubmitting={mutation.isPending}
        onConfirm={() => {
          setWarning(null);
          mutation.mutate(true);
        }}
      />
    </Card>
  );
};
