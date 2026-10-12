import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, RotateCcw, Save, Search, Trash2, X } from 'lucide-react';
import { apiClient, ApiRequestError } from '../lib/api-client';
import { PageLayout } from '../components/layout/PageLayout';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { FormField } from '../components/ui/form-field';
import { FormAlert } from '../components/ui/form-alert';
import { LoadingState } from '../components/ui/loading-state';
import { Pagination } from '../components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DatePicker } from '../components/ui/date-picker';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { PRESS_RATES_QUERY_KEY } from '../components/settings/PressRatesCard';
import type { PressRates } from '../components/settings/PressRatesCard';
import { usePermissions } from '../hooks/use-permissions';
import { formatDate, localIsoDate } from '../lib/date';
import { cn } from '../lib/utils';
import type { PaginationMeta } from '@ckfast/types';
import type { Karigar } from '../components/karigars/karigar-constants';

interface PressEntry {
  id: string;
  karigarId: string;
  date: string;
  entryTime: string | null;
  isOnline: boolean;
  pieces: number;
  rate: string;
  total: string;
  remarks: string | null;
  karigar: { id: string; code: string; fullName: string };
}

interface PressEntryList {
  items: PressEntry[];
  totals: { pieces: number; amount: number };
  pagination: PaginationMeta;
}

const QUERY_KEY = ['press-entries'] as const;

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const emptyForm = () => ({
  karigarId: '',
  date: localIsoDate(),
  entryTime: nowTime(),
  isOnline: true,
  pieces: '' as number | '',
  rate: '',
  remarks: '',
});

const money = (value: number) => value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isPress = (k: Karigar) => k.workType?.name.trim().toLowerCase() === 'press';

export const PressEntryPage = () => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canCreate = isSuperAdmin || hasPermission('press_entries:create');
  const canUpdate = isSuperAdmin || hasPermission('press_entries:update');
  const canDelete = isSuperAdmin || hasPermission('press_entries:delete');

  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<PressEntry | null>(null);
  const [toDelete, setToDelete] = useState<PressEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const set = (patch: Partial<ReturnType<typeof emptyForm>>) => setForm((f) => ({ ...f, ...patch }));

  const { data: rates } = useQuery({
    queryKey: PRESS_RATES_QUERY_KEY,
    queryFn: () => apiClient.get<PressRates>('/press-entries/rates'),
  });
  const { data: karigars } = useQuery({
    queryKey: ['karigars', 'options'],
    queryFn: () => apiClient.list<Karigar>('/karigars', { page: 1, pageSize: 100 }),
  });
  const pressKarigars = karigars?.items.filter((k) => isPress(k) && (k.isActive || k.id === editing?.karigarId)) ?? [];

  const { data: list, isLoading } = useQuery({
    queryKey: [...QUERY_KEY, { page, search }],
    queryFn: () => apiClient.get<PressEntryList>('/press-entries', { page, pageSize: 10, search: search || undefined }),
  });

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  // The rates the admin set up for the chosen mode; an edited entry's own saved rate stays selectable.
  const modeRates = rates ? (form.isOnline ? rates.onlineRates : rates.offlineRates) : [];
  const rateOptions =
    editing && editing.isOnline === form.isOnline && !modeRates.some((r) => Math.abs(r - Number(editing.rate)) < 0.005)
      ? [...modeRates, Number(editing.rate)].sort((a, b) => a - b)
      : modeRates;
  const rate = Number(form.rate) || 0;
  const total = (Number(form.pieces) || 0) * rate;

  // A new entry (or a new mode) starts on the first rate of the list.
  useEffect(() => {
    if (!rateOptions.length) return;
    if (!rateOptions.some((r) => String(r) === form.rate)) setForm((f) => ({ ...f, rate: String(rateOptions[0]) }));
  }, [rates, form.isOnline, form.rate]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = (entry: PressEntry) => {
    setError(null);
    setEditing(entry);
    setForm({
      karigarId: entry.karigarId,
      date: entry.date.slice(0, 10),
      entryTime: entry.entryTime ?? '',
      isOnline: entry.isOnline,
      pieces: entry.pieces,
      rate: String(Number(entry.rate)),
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
        date: form.date,
        entryTime: form.entryTime || null,
        isOnline: form.isOnline,
        pieces: Number(form.pieces),
        rate: Number(form.rate),
        remarks: form.remarks.trim() || null,
      };
      return editing ? apiClient.patch(`/press-entries/${editing.id}`, payload) : apiClient.post('/press-entries', payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
      setSaved(true);
      // Keep the date for the next entry; the next karigar is usually different.
      setEditing(null);
      setForm({ ...emptyForm(), date: form.date });
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/press-entries/${id}`),
    onSuccess: () => {
      setToDelete(null);
      if (editing?.id === toDelete?.id) reset();
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: (err) => {
      setToDelete(null);
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');
    },
  });

  const isValid = Boolean(form.karigarId && form.date && Number(form.pieces) > 0 && rate > 0);
  const canSave = editing ? canUpdate : canCreate;

  return (
    <PageLayout title="Press Entry" description="Pieces ironed by press karigars — pick the online / offline rate.">
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
              {saved ? <FormAlert tone="success">Press entry saved.</FormAlert> : null}
              {editing ? (
                <div className="flex items-center justify-between rounded-md bg-accent px-3 py-1.5 text-sm">
                  <span>
                    Editing entry of <span className="font-medium">{editing.karigar.fullName}</span> · {formatDate(editing.date)}
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={reset}>
                    <X />
                    Cancel edit
                  </Button>
                </div>
              ) : null}
              {karigars && !pressKarigars.length ? (
                <FormAlert tone="error">No Press karigar yet. Add one in Karigar Master with work type “Press”.</FormAlert>
              ) : null}

              <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.2fr)_auto]">
                <FormField label="Press Karigar" required htmlFor="press-karigar">
                  <Select value={form.karigarId} onValueChange={(v) => set({ karigarId: v })}>
                    <SelectTrigger id="press-karigar">
                      <SelectValue placeholder="Select karigar" />
                    </SelectTrigger>
                    <SelectContent>
                      {pressKarigars.map((k) => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.fullName} ({k.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Date & Time" required htmlFor="press-date">
                  <div className="flex gap-2">
                    <DatePicker id="press-date" required className="min-w-0 flex-1" value={form.date} onChange={(date) => set({ date })} />
                    <Input
                      type="time"
                      aria-label="Time"
                      className="w-[7.25rem] shrink-0"
                      value={form.entryTime}
                      onChange={(e) => set({ entryTime: e.target.value })}
                    />
                  </div>
                </FormField>

                <FormField label="Online / Offline" required className="sm:col-span-2 lg:col-span-1">
                  <div role="radiogroup" aria-label="Online / Offline" className="flex h-9 rounded-md border border-border bg-muted p-0.5 max-sm:h-11">
                    {[
                      { label: 'Online', value: true },
                      { label: 'Offline', value: false },
                    ].map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        role="radio"
                        aria-checked={form.isOnline === option.value}
                        onClick={() => set({ isOnline: option.value, rate: '' })}
                        className={cn(
                          'flex-1 rounded px-4 text-sm transition-colors',
                          form.isOnline === option.value ? 'bg-card font-semibold text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </FormField>
              </div>

              <div className="grid grid-cols-3 gap-x-3 gap-y-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,2fr)]">
                <FormField label="No. of Pieces" required htmlFor="press-pieces">
                  <Input
                    id="press-pieces"
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    className="numeric text-right text-base font-semibold"
                    value={form.pieces}
                    onChange={(e) => set({ pieces: e.target.value === '' ? '' : Number(e.target.value) })}
                  />
                </FormField>
                <FormField label="Rate ₹ / pc" required htmlFor="press-rate" hint={rateOptions.length ? undefined : 'Add rates in Settings'}>
                  <Select value={form.rate} onValueChange={(v) => set({ rate: v })}>
                    <SelectTrigger id="press-rate" className="numeric">
                      <SelectValue placeholder="Select rate" />
                    </SelectTrigger>
                    <SelectContent>
                      {rateOptions.map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          ₹ {money(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Total ₹" htmlFor="press-total">
                  <output
                    id="press-total"
                    aria-live="polite"
                    className="numeric flex h-9 items-center justify-end rounded-md bg-primary/10 px-3 text-base font-semibold text-primary max-sm:h-11"
                  >
                    {money(total)}
                  </output>
                </FormField>
                <FormField label="Remarks" htmlFor="press-remarks" className="col-span-3 sm:col-span-1">
                  <Input id="press-remarks" maxLength={500} placeholder="Optional" value={form.remarks} onChange={(e) => set({ remarks: e.target.value })} />
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
              placeholder="Search karigar…"
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
                  <th className="px-4 py-2 font-medium">Mode</th>
                  <th className="px-4 py-2 text-right font-medium">Pieces</th>
                  <th className="px-4 py-2 text-right font-medium">Rate ₹</th>
                  <th className="px-4 py-2 text-right font-medium">Total ₹</th>
                  <th className="px-4 py-2 font-medium">Remarks</th>
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
                    <td className="px-4 py-2.5">
                      <Badge variant={entry.isOnline ? 'info' : 'muted'}>{entry.isOnline ? 'Online' : 'Offline'}</Badge>
                    </td>
                    <td className="numeric px-4 py-2.5 text-right">{entry.pieces.toLocaleString('en-IN')}</td>
                    <td className="numeric px-4 py-2.5 text-right text-muted-foreground">{money(Number(entry.rate))}</td>
                    <td className="numeric px-4 py-2.5 text-right font-semibold">{money(Number(entry.total))}</td>
                    <td className="max-w-[12rem] truncate px-4 py-2.5 text-muted-foreground" title={entry.remarks ?? undefined}>
                      {entry.remarks || '—'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5">
                      <Button variant="ghost" size="icon" aria-label={`Edit press entry of ${entry.karigar.fullName}`} disabled={!canUpdate} onClick={() => startEdit(entry)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-destructive"
                        aria-label={`Delete press entry of ${entry.karigar.fullName}`}
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
                      No press entries yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              {list?.items.length ? (
                <tfoot>
                  <tr className="border-t border-border font-semibold">
                    <td colSpan={3} className="px-4 py-2">
                      Total{search ? ' (filtered)' : ''}
                    </td>
                    <td className="numeric px-4 py-2 text-right">{list.totals.pieces.toLocaleString('en-IN')}</td>
                    <td />
                    <td className="numeric px-4 py-2 text-right">{money(list.totals.amount)}</td>
                    <td colSpan={2} />
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
        title="Delete press entry?"
        description={toDelete ? `${toDelete.pieces} pcs · ${toDelete.karigar.fullName} · ₹${money(Number(toDelete.total))}` : undefined}
        confirmLabel="Delete"
        tone="destructive"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
      />
    </PageLayout>
  );
};
