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

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  date: todayInputValue(),
  karigarId: '',
  workTypeId: '',
  itemId: '',
  quantity: '',
  rate: '',
  photoUrl: null as string | null,
  remarks: '',
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

  const selectedItem = activeItems.find((i) => i.id === form.itemId);

  const total = useMemo(() => {
    const quantity = Number(form.quantity) || 0;
    const rate = Number(form.rate) || 0;
    return quantity * rate;
  }, [form.quantity, form.rate]);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.post('/production-entries', {
        date: form.date,
        karigarId: form.karigarId,
        workTypeId: form.workTypeId,
        itemId: form.itemId,
        quantity: Number(form.quantity),
        rate: Number(form.rate),
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
    form.date && form.karigarId && form.workTypeId && form.itemId && form.quantity && form.rate && form.photoUrl,
  );

  const handleKarigarChange = (karigarId: string) => {
    const karigar = activeKarigars.find((k) => k.id === karigarId);
    setForm((f) => ({ ...f, karigarId, workTypeId: karigar ? karigar.workTypeId : f.workTypeId }));
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

              <FormField label="Karigar" required>
                <Select value={form.karigarId} onValueChange={handleKarigarChange}>
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

              <FormField label="Style / Design No." required>
                <Select value={form.itemId} onValueChange={(v) => setForm((f) => ({ ...f, itemId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select style / design no." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.styleNo} — {item.itemName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Item Name">
                <Input disabled value={selectedItem?.itemName ?? ''} />
              </FormField>

              <FormField label="Quantity (PCS)" required>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  required
                  className="numeric"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </FormField>

              <FormField label="Rate (₹)" required>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className="numeric"
                  value={form.rate}
                  onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                />
              </FormField>

              <FormField label="Total Amount (₹)">
                <Input disabled className="numeric" value={total.toFixed(2)} />
              </FormField>
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
