import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient, ApiRequestError } from '../lib/api-client';
import { PageLayout } from '../components/layout/PageLayout';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { FormField } from '../components/ui/form-field';
import { FormAlert } from '../components/ui/form-alert';
import { HelpTip } from '../components/ui/help-tip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DatePicker } from '../components/ui/date-picker';
import { PhotoUpload } from '../components/common/PhotoUpload';
import { cn } from '../lib/utils';
import type { Karigar, WorkType } from '../components/karigars/karigar-constants';
import type { Item } from '../components/items/item-constants';
import type { CuttingEntry } from '../components/cutting/cutting-constants';
import { localIsoDate } from '../lib/date';

const todayInputValue = () => localIsoDate();

const emptyForm = {
  date: todayInputValue(),
  lotNumber: '',
  designNumber: '',
  workTypeId: '',
  itemId: '',
  carrierId: '',
  carrierQuantity: '',
  carrierRate: '',
  overlockCarrierId: '',
  overlockRate: '',
  flatlockKarigarId: '',
  flatlockRate: '',
  photoUrl: null as string | null,
  remarks: '',
};

// Layout tokens for this dense daily-entry form: 44px tap targets on mobile, 36px on desktop,
// and a 4px label gap so the whole form fits a 1366×768 viewport without scrolling.
const ROW = 'grid gap-x-3 gap-y-2.5';
const FIELD = 'min-w-0 space-y-1';
const CONTROL = 'h-11 sm:h-9';
const ACTION = cn(CONTROL, 'px-2 sm:px-4');
const NUMERIC = cn(CONTROL, 'numeric text-right');
// Calculated totals are read-only rather than disabled so they keep full text contrast; they
// stay out of the tab order as before.
const TOTAL_PROPS = {
  readOnly: true,
  tabIndex: -1,
  className: cn(NUMERIC, 'cursor-default bg-muted/50 text-foreground focus-visible:ring-0'),
} as const;

// A short debounce keeps the lot lookup from firing a request on every keystroke.
const useDebouncedValue = <T,>(value: T, delayMs: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};

export const ProductionEntryPage = () => {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: karigars } = useQuery({
    queryKey: ['karigars', 'options'],
    queryFn: () => apiClient.list<Karigar>('/karigars', { page: 1, pageSize: 100 }),
  });
  const activeKarigars = karigars?.items.filter((k) => k.isActive) ?? [];

  const { data: workTypes } = useQuery({
    queryKey: ['work-types'],
    queryFn: () => apiClient.get<WorkType[]>('/karigars/work-types'),
  });
  const activeWorkTypes = workTypes?.filter((w) => w.isActive) ?? [];

  const { data: items } = useQuery({
    queryKey: ['items', 'options'],
    queryFn: () => apiClient.list<Item>('/items', { page: 1, pageSize: 100 }),
  });
  const activeItems = items?.items.filter((i) => i.isActive) ?? [];

  const debouncedLotNumber = useDebouncedValue(form.lotNumber.trim(), 400);
  const { data: matchedLot, isFetching: lotFetching } = useQuery({
    queryKey: ['cutting-entry-by-lot', debouncedLotNumber],
    queryFn: () => apiClient.get<CuttingEntry>(`/cutting/lot/${encodeURIComponent(debouncedLotNumber)}`),
    enabled: debouncedLotNumber.length > 0,
    retry: false,
  });
  // A lot number match is authoritative for the item — locked, not just pre-filled, so the
  // production entry can't drift from what was actually cut under that lot.
  const itemLocked = Boolean(matchedLot);
  const lotLookupPending = form.lotNumber.trim() !== debouncedLotNumber || lotFetching;

  useEffect(() => {
    if (matchedLot) setForm((f) => ({ ...f, itemId: matchedLot.itemId }));
  }, [matchedLot]);

  const selectedItem = activeItems.find((i) => i.id === form.itemId);
  const lockedItemName = selectedItem?.itemName ?? matchedLot?.item.itemName ?? '';

  const carrierTotal = useMemo(() => {
    const quantity = Number(form.carrierQuantity) || 0;
    const rate = Number(form.carrierRate) || 0;
    return quantity * rate;
  }, [form.carrierQuantity, form.carrierRate]);

  const overlockTotal = useMemo(() => {
    if (!form.overlockCarrierId || !form.overlockRate) return 0;
    return (Number(form.carrierQuantity) || 0) * (Number(form.overlockRate) || 0);
  }, [form.overlockCarrierId, form.overlockRate, form.carrierQuantity]);

  const flatlockTotal = useMemo(() => {
    if (!form.flatlockKarigarId || !form.flatlockRate) return 0;
    return (Number(form.carrierQuantity) || 0) * (Number(form.flatlockRate) || 0);
  }, [form.flatlockKarigarId, form.flatlockRate, form.carrierQuantity]);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post('/production-entries', {
        date: form.date,
        lotNumber: form.lotNumber || undefined,
        designNumber: form.designNumber || undefined,
        workTypeId: form.workTypeId,
        itemId: itemLocked ? undefined : form.itemId,
        carrierId: form.carrierId,
        carrierQuantity: Number(form.carrierQuantity),
        carrierRate: Number(form.carrierRate),
        overlockCarrierId: form.overlockCarrierId || undefined,
        overlockRate: form.overlockRate ? Number(form.overlockRate) : undefined,
        flatlockKarigarId: form.flatlockKarigarId || undefined,
        flatlockRate: form.flatlockRate ? Number(form.flatlockRate) : undefined,
        photoUrl: form.photoUrl ?? undefined,
        remarks: form.remarks || undefined,
      }),
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'),
  });

  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  const isValid = Boolean(
    form.date &&
      form.workTypeId &&
      (itemLocked || form.itemId) &&
      form.carrierId &&
      form.carrierQuantity &&
      form.carrierRate &&
      form.photoUrl,
  );

  const handleCarrierChange = (carrierId: string) => {
    const karigar = activeKarigars.find((k) => k.id === carrierId);
    setForm((f) => ({ ...f, carrierId, workTypeId: karigar ? karigar.workTypeId : f.workTypeId }));
  };

  const save = (resetMode: 'full' | 'keepDate') => {
    setError(null);
    mutation.mutate(undefined, {
      onSuccess: () => {
        setSaved(true);
        setForm(resetMode === 'keepDate' ? { ...emptyForm, date: form.date } : emptyForm);
      },
    });
  };

  // Shown only once a lot number is typed; the always-on explanation lives in the HelpTip.
  const lotStatus = !form.lotNumber.trim()
    ? null
    : lotLookupPending
      ? { className: 'text-muted-foreground', text: 'Checking lot…' }
      : matchedLot
        ? { className: 'font-medium text-status-success', text: 'Matched — item locked from this lot.' }
        : { className: 'text-status-warning', text: 'No matching cutting entry — select item manually.' };

  const karigarOptions = activeKarigars.map((karigar) => (
    <SelectItem key={karigar.id} value={karigar.id}>
      {karigar.fullName} ({karigar.code})
    </SelectItem>
  ));

  return (
    <PageLayout className="space-y-3" title="Daily Production Entry" description="Log today's production per karigar and item.">
      <Card>
        <CardContent className="p-3 sm:p-4">
          <form
            className="space-y-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              save('full');
            }}
          >
            {error ? <FormAlert tone="error">{error}</FormAlert> : null}
            {saved ? <FormAlert tone="success">Production entry saved.</FormAlert> : null}

            {/* Row 1 — entry header */}
            <div className={cn(ROW, 'grid-cols-2 lg:grid-cols-4')}>
              <FormField label="Date" required htmlFor="pe-date" className={FIELD}>
                <DatePicker
                  id="pe-date"
                  required
                  inputClassName={CONTROL}
                  value={form.date}
                  onChange={(date) => setForm((f) => ({ ...f, date }))}
                />
              </FormField>

              <FormField
                label="Lot Number"
                htmlFor="pe-lot"
                className={FIELD}
                labelAddon={<HelpTip label="About lot number" text="Optional. Matches a Cutting entry and locks its item." />}
              >
                <Input
                  id="pe-lot"
                  autoComplete="off"
                  aria-describedby={lotStatus ? 'pe-lot-status' : undefined}
                  className={CONTROL}
                  value={form.lotNumber}
                  onChange={(e) => setForm((f) => ({ ...f, lotNumber: e.target.value }))}
                />
                {lotStatus ? (
                  <p id="pe-lot-status" role="status" className={cn('text-2xs', lotStatus.className)}>
                    {lotStatus.text}
                  </p>
                ) : null}
              </FormField>

              <FormField label="Design Number" htmlFor="pe-design" className={FIELD}>
                <Input
                  id="pe-design"
                  className={CONTROL}
                  value={form.designNumber}
                  onChange={(e) => setForm((f) => ({ ...f, designNumber: e.target.value }))}
                />
              </FormField>

              <FormField label="Work Type" required htmlFor="pe-work-type" className={FIELD}>
                <Select value={form.workTypeId} onValueChange={(v) => setForm((f) => ({ ...f, workTypeId: v }))}>
                  <SelectTrigger id="pe-work-type" className={CONTROL}>
                    <SelectValue placeholder="Select work type" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeWorkTypes.map((workType) => (
                      <SelectItem key={workType.id} value={workType.id}>
                        {workType.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            {/* Row 2 — item and main karigar; this quantity drives all three totals */}
            <div
              className={cn(
                ROW,
                'grid-cols-2 sm:grid-cols-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]',
              )}
            >
              <FormField
                label="Item Name"
                required
                htmlFor="pe-item"
                className={cn(FIELD, 'col-span-2 sm:col-span-3 lg:col-span-1')}
              >
                {itemLocked ? (
                  <Input id="pe-item" disabled title={lockedItemName} className={CONTROL} value={lockedItemName} />
                ) : (
                  <Select value={form.itemId} onValueChange={(v) => setForm((f) => ({ ...f, itemId: v }))}>
                    <SelectTrigger id="pe-item" className={CONTROL}>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.itemName} ({item.styleNo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              <FormField
                label="Karigar"
                required
                htmlFor="pe-karigar"
                className={cn(FIELD, 'col-span-2 sm:col-span-3 lg:col-span-1')}
              >
                <Select value={form.carrierId} onValueChange={handleCarrierChange}>
                  <SelectTrigger id="pe-karigar" className={CONTROL}>
                    <SelectValue placeholder="Select karigar" />
                  </SelectTrigger>
                  <SelectContent>{karigarOptions}</SelectContent>
                </Select>
              </FormField>

              <FormField label="Quantity (PCS)" required htmlFor="pe-qty" className={cn(FIELD, 'sm:col-span-2 lg:col-span-1')}>
                <Input
                  id="pe-qty"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  required
                  className={NUMERIC}
                  value={form.carrierQuantity}
                  onChange={(e) => setForm((f) => ({ ...f, carrierQuantity: e.target.value }))}
                />
              </FormField>
              <FormField label="Rate (₹)" required htmlFor="pe-rate" className={cn(FIELD, 'sm:col-span-2 lg:col-span-1')}>
                <Input
                  id="pe-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  required
                  aria-label="Karigar Rate (₹)"
                  className={NUMERIC}
                  value={form.carrierRate}
                  onChange={(e) => setForm((f) => ({ ...f, carrierRate: e.target.value }))}
                />
              </FormField>
              <FormField label="Total (₹)" htmlFor="pe-total" className={cn(FIELD, 'col-span-2 lg:col-span-1')}>
                <Input id="pe-total" aria-label="Karigar Total (₹)" {...TOTAL_PROPS} value={carrierTotal.toFixed(2)} />
              </FormField>
            </div>

            {/* Row 3 — overlock and flatlock karigars (three fields each), sharing the quantity above */}
            <div
              className={cn(
                ROW,
                'grid-cols-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]',
              )}
            >
              <FormField label="Overlock Karigar" htmlFor="pe-overlock" className={cn(FIELD, 'col-span-2 sm:col-span-1')}>
                <Select value={form.overlockCarrierId} onValueChange={(v) => setForm((f) => ({ ...f, overlockCarrierId: v }))}>
                  <SelectTrigger id="pe-overlock" className={CONTROL}>
                    <SelectValue placeholder="Select karigar" />
                  </SelectTrigger>
                  <SelectContent>{karigarOptions}</SelectContent>
                </Select>
              </FormField>
              <FormField label="Rate (₹)" htmlFor="pe-overlock-rate" className={FIELD}>
                <Input
                  id="pe-overlock-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  aria-label="Overlock Karigar Rate (₹)"
                  className={NUMERIC}
                  value={form.overlockRate}
                  onChange={(e) => setForm((f) => ({ ...f, overlockRate: e.target.value }))}
                />
              </FormField>
              <FormField label="Total (₹)" htmlFor="pe-overlock-total" className={FIELD}>
                <Input
                  id="pe-overlock-total"
                  aria-label="Overlock Karigar Total (₹)"
                  {...TOTAL_PROPS}
                  value={overlockTotal.toFixed(2)}
                />
              </FormField>

              <FormField label="Flatlock Karigar" htmlFor="pe-flatlock" className={cn(FIELD, 'col-span-2 sm:col-span-1')}>
                <Select value={form.flatlockKarigarId} onValueChange={(v) => setForm((f) => ({ ...f, flatlockKarigarId: v }))}>
                  <SelectTrigger id="pe-flatlock" className={CONTROL}>
                    <SelectValue placeholder="Select karigar" />
                  </SelectTrigger>
                  <SelectContent>{karigarOptions}</SelectContent>
                </Select>
              </FormField>
              <FormField label="Rate (₹)" htmlFor="pe-flatlock-rate" className={FIELD}>
                <Input
                  id="pe-flatlock-rate"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  aria-label="Flatlock Karigar Rate (₹)"
                  className={NUMERIC}
                  value={form.flatlockRate}
                  onChange={(e) => setForm((f) => ({ ...f, flatlockRate: e.target.value }))}
                />
              </FormField>
              <FormField label="Total (₹)" htmlFor="pe-flatlock-total" className={FIELD}>
                <Input
                  id="pe-flatlock-total"
                  aria-label="Flatlock Karigar Total (₹)"
                  {...TOTAL_PROPS}
                  value={flatlockTotal.toFixed(2)}
                />
              </FormField>
            </div>

            {/* Row 4 — photo and remarks */}
            <div className={cn(ROW, 'grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)]')}>
              <FormField label="Photo Upload" required htmlFor="pe-photo" className={FIELD}>
                <PhotoUpload
                  id="pe-photo"
                  size="sm"
                  value={form.photoUrl}
                  onChange={(url) => setForm((f) => ({ ...f, photoUrl: url }))}
                />
              </FormField>

              <FormField label="Remarks" htmlFor="pe-remarks" className={FIELD}>
                <Textarea
                  id="pe-remarks"
                  rows={2}
                  className="min-h-14 resize-y"
                  value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                />
              </FormField>
            </div>

            {/* Row 5 — actions */}
            <div className="grid grid-cols-3 gap-2 pt-1.5 sm:flex sm:items-center">
              <Button type="submit" className={ACTION} loading={mutation.isPending} disabled={!isValid}>
                Save Entry
              </Button>
              <Button type="button" variant="outline" className={ACTION} onClick={() => setForm(emptyForm)}>
                Clear
              </Button>
              <Button
                type="button"
                variant="outline"
                className={ACTION}
                loading={mutation.isPending}
                disabled={!isValid}
                onClick={() => save('keepDate')}
              >
                Save & New
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageLayout>
  );
};
