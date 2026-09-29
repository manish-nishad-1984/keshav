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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { PhotoUpload } from '../components/common/PhotoUpload';
import type { Karigar, WorkType } from '../components/karigars/karigar-constants';
import type { Item } from '../components/items/item-constants';
import type { CuttingEntry } from '../components/cutting/cutting-constants';

const todayInputValue = () => new Date().toISOString().slice(0, 10);

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
  const { data: matchedLot } = useQuery({
    queryKey: ['cutting-entry-by-lot', debouncedLotNumber],
    queryFn: () => apiClient.get<CuttingEntry>(`/cutting/lot/${encodeURIComponent(debouncedLotNumber)}`),
    enabled: debouncedLotNumber.length > 0,
    retry: false,
  });
  // A lot number match is authoritative for the item — locked, not just pre-filled, so the
  // production entry can't drift from what was actually cut under that lot.
  const itemLocked = Boolean(matchedLot);

  useEffect(() => {
    if (matchedLot) setForm((f) => ({ ...f, itemId: matchedLot.itemId }));
  }, [matchedLot]);

  const selectedItem = activeItems.find((i) => i.id === form.itemId);

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

  return (
    <PageLayout title="Daily Production Entry" description="Log today's production per karigar and item.">
      <Card>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              save('full');
            }}
          >
            {error ? <FormAlert tone="error">{error}</FormAlert> : null}
            {saved ? <FormAlert tone="success">Production entry saved.</FormAlert> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Date" required>
                <Input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </FormField>

              <FormField
                label="Lot Number"
                hint={
                  form.lotNumber && !matchedLot
                    ? 'No matching cutting entry — item must be selected manually.'
                    : matchedLot
                      ? 'Matched — item is locked from this lot.'
                      : 'Optional. Matches a Cutting entry and locks its item.'
                }
              >
                <Input value={form.lotNumber} onChange={(e) => setForm((f) => ({ ...f, lotNumber: e.target.value }))} />
              </FormField>

              <FormField label="Design Number">
                <Input
                  value={form.designNumber}
                  onChange={(e) => setForm((f) => ({ ...f, designNumber: e.target.value }))}
                />
              </FormField>

              <FormField label="Work Type" required>
                <Select value={form.workTypeId} onValueChange={(v) => setForm((f) => ({ ...f, workTypeId: v }))}>
                  <SelectTrigger>
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

              <FormField label="Item Name" required>
                {itemLocked ? (
                  <Input disabled value={selectedItem?.itemName ?? matchedLot?.item.itemName ?? ''} />
                ) : (
                  <Select value={form.itemId} onValueChange={(v) => setForm((f) => ({ ...f, itemId: v }))}>
                    <SelectTrigger>
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
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="mb-3 text-sm font-semibold">Carrier</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FormField label="Carrier" required>
                  <Select value={form.carrierId} onValueChange={handleCarrierChange}>
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
                <FormField label="Quantity (PCS)" required>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    required
                    className="numeric"
                    value={form.carrierQuantity}
                    onChange={(e) => setForm((f) => ({ ...f, carrierQuantity: e.target.value }))}
                  />
                </FormField>
                <FormField label="Rate (₹)" required>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="numeric"
                    value={form.carrierRate}
                    onChange={(e) => setForm((f) => ({ ...f, carrierRate: e.target.value }))}
                  />
                </FormField>
                <FormField label="Total (₹)">
                  <Input disabled className="numeric" value={carrierTotal.toFixed(2)} />
                </FormField>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="mb-3 text-sm font-semibold">Overlock Carrier</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Overlock Carrier">
                  <Select
                    value={form.overlockCarrierId}
                    onValueChange={(v) => setForm((f) => ({ ...f, overlockCarrierId: v }))}
                  >
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
                <FormField label="Rate (₹)">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="numeric"
                    value={form.overlockRate}
                    onChange={(e) => setForm((f) => ({ ...f, overlockRate: e.target.value }))}
                  />
                </FormField>
                <FormField label="Total (₹)">
                  <Input disabled className="numeric" value={overlockTotal.toFixed(2)} />
                </FormField>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="mb-3 text-sm font-semibold">Flatlock Karigar</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Flatlock Karigar">
                  <Select
                    value={form.flatlockKarigarId}
                    onValueChange={(v) => setForm((f) => ({ ...f, flatlockKarigarId: v }))}
                  >
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
                <FormField label="Rate (₹)">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="numeric"
                    value={form.flatlockRate}
                    onChange={(e) => setForm((f) => ({ ...f, flatlockRate: e.target.value }))}
                  />
                </FormField>
                <FormField label="Total (₹)">
                  <Input disabled className="numeric" value={flatlockTotal.toFixed(2)} />
                </FormField>
              </div>
            </div>

            <FormField label="Photo Upload" required>
              <PhotoUpload value={form.photoUrl} onChange={(url) => setForm((f) => ({ ...f, photoUrl: url }))} />
            </FormField>

            <FormField label="Remarks">
              <Textarea value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
            </FormField>

            <div className="flex items-center gap-2 border-t border-border pt-4">
              <Button type="submit" loading={mutation.isPending} disabled={!isValid}>
                Save Entry
              </Button>
              <Button type="button" variant="outline" onClick={() => setForm(emptyForm)}>
                Clear
              </Button>
              <Button
                type="button"
                variant="outline"
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
