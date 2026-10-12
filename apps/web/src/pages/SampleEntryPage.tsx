import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageOff, Pencil, RotateCcw, Save, Search, Trash2, X } from 'lucide-react';
import { apiClient, ApiRequestError, resolvePhotoUrl } from '../lib/api-client';
import { PageLayout } from '../components/layout/PageLayout';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { FormField } from '../components/ui/form-field';
import { FormAlert } from '../components/ui/form-alert';
import { LoadingState } from '../components/ui/loading-state';
import { Pagination } from '../components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DatePicker } from '../components/ui/date-picker';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { usePermissions } from '../hooks/use-permissions';
import { formatDate, localIsoDate } from '../lib/date';
import { cn } from '../lib/utils';
import type { PaginationMeta } from '@ckfast/types';
import type { Karigar, WorkType } from '../components/karigars/karigar-constants';
import type { Item } from '../components/items/item-constants';

interface SampleEntry {
  id: string;
  karigarId: string;
  workTypeId: string;
  itemId: string;
  date: string;
  entryTime: string | null;
  quantity: number;
  rate: string;
  total: string;
  remarks: string | null;
  karigar: { id: string; code: string; fullName: string };
  workType: { id: string; name: string };
  item: { id: string; itemName: string; photoUrl: string | null };
}

interface SampleEntryList {
  items: SampleEntry[];
  totals: { quantity: number; amount: number };
  pagination: PaginationMeta;
}

const QUERY_KEY = ['sample-entries'] as const;

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const emptyForm = () => ({
  workTypeId: '',
  karigarId: '',
  itemId: '',
  date: localIsoDate(),
  entryTime: nowTime(),
  quantity: '' as number | '',
  rate: '' as number | '',
  remarks: '',
});

const money = (value: number) => value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Sample work: a karigar of a work type makes sample pieces of a design at a rate. The total goes
// into the karigar's ledger like any other earning.
export const SampleEntryPage = () => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canCreate = isSuperAdmin || hasPermission('sample_entries:create');
  const canUpdate = isSuperAdmin || hasPermission('sample_entries:update');
  const canDelete = isSuperAdmin || hasPermission('sample_entries:delete');

  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<SampleEntry | null>(null);
  const [toDelete, setToDelete] = useState<SampleEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const set = (patch: Partial<ReturnType<typeof emptyForm>>) => setForm((f) => ({ ...f, ...patch }));

  const { data: workTypes } = useQuery({
    queryKey: ['work-types'],
    queryFn: () => apiClient.get<WorkType[]>('/karigars/work-types'),
  });
  const { data: karigars } = useQuery({
    queryKey: ['karigars', 'options'],
    queryFn: () => apiClient.list<Karigar>('/karigars', { page: 1, pageSize: 100 }),
  });
  const { data: items } = useQuery({
    queryKey: ['items', 'options'],
    queryFn: () => apiClient.list<Item>('/items', { page: 1, pageSize: 100 }),
  });
  const { data: list, isLoading } = useQuery({
    queryKey: [...QUERY_KEY, { page, search }],
    queryFn: () => apiClient.get<SampleEntryList>('/sample-entries', { page, pageSize: 10, search: search || undefined }),
  });

  const workTypeOptions = workTypes?.filter((w) => w.isActive || w.id === editing?.workTypeId) ?? [];
  const karigarOptions =
    karigars?.items.filter((k) => k.workTypeId === form.workTypeId && (k.isActive || k.id === editing?.karigarId)) ?? [];
  const itemOptions = items?.items.filter((i) => i.isActive || i.id === editing?.itemId) ?? [];
  const selectedItem = itemOptions.find((i) => i.id === form.itemId);
  const itemPhoto = resolvePhotoUrl(selectedItem?.photoUrl ?? editing?.item.photoUrl ?? null);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  const total = (Number(form.quantity) || 0) * (Number(form.rate) || 0);

  const startEdit = (entry: SampleEntry) => {
    setError(null);
    setEditing(entry);
    setForm({
      workTypeId: entry.workTypeId,
      karigarId: entry.karigarId,
      itemId: entry.itemId,
      date: entry.date.slice(0, 10),
      entryTime: entry.entryTime ?? '',
      quantity: entry.quantity,
      rate: Number(entry.rate),
      remarks: entry.remarks ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const reset = () => {
    setEditing(null);
    setForm(emptyForm());
  };

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        karigarId: form.karigarId,
        workTypeId: form.workTypeId,
        itemId: form.itemId,
        date: form.date,
        entryTime: form.entryTime || null,
        quantity: Number(form.quantity),
        rate: Number(form.rate),
        remarks: form.remarks.trim() || null,
      };
      return editing ? apiClient.patch(`/sample-entries/${editing.id}`, payload) : apiClient.post('/sample-entries', payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSaved(true);
      setError(null);
      // Keep the date and work type for the next entry.
      setEditing(null);
      setForm({ ...emptyForm(), date: form.date, workTypeId: form.workTypeId });
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/sample-entries/${id}`),
    onSuccess: () => {
      if (editing?.id === toDelete?.id) reset();
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => {
      setToDelete(null);
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');
    },
  });

  const isValid = Boolean(
    form.workTypeId && form.karigarId && form.itemId && form.date && Number(form.quantity) > 0 && Number(form.rate) > 0,
  );
  const canSave = editing ? canUpdate : canCreate;

  return (
    <PageLayout title="Sample Work" description="Sample work done by karigars — design, quantity and rate. The total is added to the karigar's ledger.">
      {canSave || editing ? (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                mutation.mutate();
              }}
            >
              {error ? <FormAlert tone="error">{error}</FormAlert> : null}
              {saved ? <FormAlert tone="success">Sample entry saved.</FormAlert> : null}
              {editing ? (
                <div className="flex items-center justify-between rounded-md bg-accent px-3 py-1.5 text-sm">
                  <span>
                    Editing sample of <span className="font-medium">{editing.karigar.fullName}</span> · {formatDate(editing.date)}
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={reset}>
                    <X />
                    Cancel edit
                  </Button>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
                <FormField label="Date & Time" required htmlFor="sample-date">
                  <div className="flex gap-2">
                    <DatePicker id="sample-date" required className="min-w-0 flex-1" value={form.date} onChange={(date) => set({ date })} />
                    <Input
                      type="time"
                      aria-label="Time"
                      className="w-[7.25rem] shrink-0"
                      value={form.entryTime}
                      onChange={(e) => set({ entryTime: e.target.value })}
                    />
                  </div>
                </FormField>

                <FormField label="Work Type" required htmlFor="sample-work-type">
                  <Select value={form.workTypeId} onValueChange={(v) => set({ workTypeId: v, karigarId: '' })}>
                    <SelectTrigger id="sample-work-type">
                      <SelectValue placeholder="Select work type" />
                    </SelectTrigger>
                    <SelectContent>
                      {workTypeOptions.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField
                  label="Karigar"
                  required
                  htmlFor="sample-karigar"
                  hint={form.workTypeId && !karigarOptions.length ? 'No karigar of this work type' : undefined}
                >
                  <Select value={form.karigarId} onValueChange={(v) => set({ karigarId: v })} disabled={!form.workTypeId}>
                    <SelectTrigger id="sample-karigar">
                      <SelectValue placeholder={form.workTypeId ? 'Select karigar' : 'Select work type first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {karigarOptions.map((k) => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.fullName} ({k.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Design Name" required htmlFor="sample-item">
                  <Select value={form.itemId} onValueChange={(v) => set({ itemId: v })}>
                    <SelectTrigger id="sample-item">
                      <SelectValue placeholder="Select design" />
                    </SelectTrigger>
                    <SelectContent>
                      {itemOptions.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.itemName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              <div className="flex flex-wrap items-end gap-x-3 gap-y-2.5">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground">
                  {itemPhoto ? <img src={itemPhoto} alt="Design" className="size-full object-cover" /> : <ImageOff className="size-5" />}
                </div>
                <FormField label="Qty" required htmlFor="sample-qty" className="w-28">
                  <Input
                    id="sample-qty"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    className="numeric text-right text-base font-semibold"
                    value={form.quantity}
                    onChange={(e) => set({ quantity: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </FormField>
                <FormField label="Rate ₹" required htmlFor="sample-rate" className="w-32">
                  <Input
                    id="sample-rate"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    className="numeric text-right"
                    value={form.rate}
                    onChange={(e) => set({ rate: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </FormField>
                <FormField label="Total ₹" htmlFor="sample-total" className="w-36">
                  <output
                    id="sample-total"
                    aria-live="polite"
                    className="numeric flex h-9 items-center justify-end rounded-md bg-primary/10 px-3 text-base font-semibold text-primary max-sm:h-11"
                  >
                    {money(total)}
                  </output>
                </FormField>
                <FormField label="Remarks" htmlFor="sample-remarks" className="min-w-[12rem] flex-1">
                  <Input id="sample-remarks" maxLength={500} placeholder="Optional" value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} />
                </FormField>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border pt-3 sm:justify-end">
                <Button type="button" variant="outline" onClick={reset}>
                  <RotateCcw />
                  Clear
                </Button>
                <Button type="submit" className="sm:min-w-28" loading={mutation.isPending} disabled={!isValid || !canSave}>
                  <Save />
                  {editing ? 'Save Changes' : 'Save Entry'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search karigar or design…"
              className="pl-8"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
        </div>
        {isLoading ? (
          <LoadingState variant="page" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left text-sm">
              <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Karigar</th>
                  <th className="px-4 py-2 font-medium">Work Type</th>
                  <th className="px-4 py-2 font-medium">Design</th>
                  <th className="px-4 py-2 text-right font-medium">Qty</th>
                  <th className="px-4 py-2 text-right font-medium">Rate ₹</th>
                  <th className="px-4 py-2 text-right font-medium">Total ₹</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {list?.items.map((entry) => (
                  <tr key={entry.id} className={cn('border-b border-border last:border-0', editing?.id === entry.id && 'bg-accent/60')}>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {formatDate(entry.date)}
                      {entry.entryTime ? <span className="ml-1.5 text-2xs">{entry.entryTime}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{entry.karigar.fullName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{entry.workType.name}</td>
                    <td className="px-4 py-2.5">{entry.item.itemName}</td>
                    <td className="numeric px-4 py-2.5 text-right">{entry.quantity.toLocaleString('en-IN')}</td>
                    <td className="numeric px-4 py-2.5 text-right text-muted-foreground">{money(Number(entry.rate))}</td>
                    <td className="numeric px-4 py-2.5 text-right font-semibold">{money(Number(entry.total))}</td>
                    <td className="whitespace-nowrap px-2 py-2.5">
                      <Button variant="ghost" size="icon" aria-label={`Edit sample of ${entry.karigar.fullName}`} disabled={!canUpdate} onClick={() => startEdit(entry)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-destructive"
                        aria-label={`Delete sample of ${entry.karigar.fullName}`}
                        disabled={!canDelete}
                        onClick={() => setToDelete(entry)}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!list?.items.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No sample entries yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              {list?.items.length ? (
                <tfoot>
                  <tr className="border-t border-border font-semibold">
                    <td colSpan={4} className="px-4 py-2">
                      Total{search ? ' (filtered)' : ''}
                    </td>
                    <td className="numeric px-4 py-2 text-right">{list.totals.quantity.toLocaleString('en-IN')}</td>
                    <td />
                    <td className="numeric px-4 py-2 text-right">{money(list.totals.amount)}</td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        )}
        {list ? <Pagination meta={list.pagination} onPageChange={setPage} className="border-t border-border" /> : null}
      </Card>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete sample entry?"
        description={
          toDelete ? `${toDelete.quantity} pcs · ${toDelete.item.itemName} · ${toDelete.karigar.fullName} · ₹${money(Number(toDelete.total))} — it is also removed from the karigar's ledger.` : undefined
        }
        confirmLabel="Delete"
        tone="destructive"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
      />
    </PageLayout>
  );
};
