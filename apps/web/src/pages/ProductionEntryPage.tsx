import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, RotateCcw, Save } from 'lucide-react';
import { apiClient, ApiRequestError } from '../lib/api-client';
import { PageLayout } from '../components/layout/PageLayout';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { FormField } from '../components/ui/form-field';
import { FormAlert } from '../components/ui/form-alert';
import { LoadingState } from '../components/ui/loading-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DatePicker } from '../components/ui/date-picker';
import { ProductionPhotoCompare } from '../components/production-entries/ProductionPhotoCompare';
import { ProductionSizeGrid, summarizeGrid } from '../components/production-entries/ProductionSizeGrid';
import { cn } from '../lib/utils';
import type { Karigar } from '../components/karigars/karigar-constants';
import type { ProductionAvailability, ProductionEntry, ProductionKarigarLot } from '../components/production-entries/production-entry-constants';
import { cellKey, STAGE_LABELS } from '../components/production-entries/production-entry-constants';
import { localIsoDate } from '../lib/date';
import { useSelectedBook } from '../hooks/use-selected-book';

const NONE = 'none';

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const emptyForm = () => ({
  carrierId: '',
  cuttingEntryId: '',
  date: localIsoDate(),
  entryTime: nowTime(),
  carrierRate: '',
  flatlockKarigarId: NONE,
  flatlockRate: '',
  overlockCarrierId: NONE,
  overlockRate: '',
  photoUrl: null as string | null,
  remarks: '',
});
type FormState = ReturnType<typeof emptyForm>;

const money = (value: number) => value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const rateOrNull = (value: string) => (value === '' ? null : Number(value));

// One stage card: who did it, the (locked) quantity, an optional rate and the total.
const StageCard = ({
  title,
  accent,
  quantity,
  karigarSlot,
  rate,
  onRate,
  active,
  rateId,
}: {
  title: string;
  accent: string;
  quantity: number;
  karigarSlot: React.ReactNode;
  rate: string;
  onRate: (value: string) => void;
  active: boolean;
  rateId: string;
}) => {
  const total = active && rate ? quantity * Number(rate) : 0;
  return (
    <section aria-label={title} className={cn('space-y-2 rounded-lg border border-border bg-card p-3', !active && 'opacity-70')}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span className={cn('size-2.5 rounded-full', accent)} aria-hidden />
          {title}
        </h3>
        {active && !rate ? <Badge variant="warning">Rate pending</Badge> : null}
      </div>
      {karigarSlot}
      <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] gap-2">
        <div className="space-y-1">
          <p className="text-2xs font-medium text-muted-foreground">Qty (pcs)</p>
          <div className="numeric flex h-9 items-center justify-end rounded-md bg-muted px-2.5 text-sm font-semibold max-sm:h-11">
            {active ? quantity : '—'}
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor={rateId} className="text-2xs font-medium text-muted-foreground">
            Rate ₹ <span className="font-normal">(optional)</span>
          </label>
          <Input
            id={rateId}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className="numeric text-right"
            disabled={!active}
            value={rate}
            onChange={(e) => onRate(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
        <span className="text-muted-foreground">Total</span>
        <span className="numeric font-semibold">₹ {money(total)}</span>
      </div>
    </section>
  );
};

export const ProductionEntryPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const isEdit = Boolean(editId);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  // Pieces handed in now per colour + size, keyed "colorId:sizeId".
  const [qtys, setQtys] = useState<Record<string, number | ''>>({});
  const [saved, setSaved] = useState(false);
  // The karigar was paid after this entry: the user must confirm changing it.
  const [paidWarning, setPaidWarning] = useState<string | null>(null);
  const [pendingNew, setPendingNew] = useState(false);
  const { selectedBook } = useSelectedBook();
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const { data: editing, isLoading: editLoading } = useQuery({
    queryKey: ['production-entries', 'detail', editId],
    queryFn: () => apiClient.get<ProductionEntry>(`/production-entries/${editId}`),
    enabled: isEdit,
  });
  // Lots are per book: a new entry uses the header's book, an edited one its own lot's book.
  const bookId = isEdit ? editing?.cuttingEntry?.bookId : selectedBook?.id;

  useEffect(() => {
    if (!editing) return;
    setForm({
      carrierId: editing.carrierId,
      cuttingEntryId: editing.cuttingEntryId ?? '',
      date: editing.date.slice(0, 10),
      entryTime: editing.entryTime ?? '',
      carrierRate: editing.carrierRate ? String(Number(editing.carrierRate)) : '',
      flatlockKarigarId: editing.flatlockKarigarId ?? NONE,
      flatlockRate: editing.flatlockRate ? String(Number(editing.flatlockRate)) : '',
      overlockCarrierId: editing.overlockCarrierId ?? NONE,
      overlockRate: editing.overlockRate ? String(Number(editing.overlockRate)) : '',
      photoUrl: editing.photoUrl,
      remarks: editing.remarks ?? '',
    });
    setQtys(Object.fromEntries(editing.quantities.map((q) => [cellKey(q.colorId, q.sizeId), q.quantity])));
  }, [editing]);

  const { data: karigars } = useQuery({
    queryKey: ['karigars', 'options'],
    queryFn: () => apiClient.list<Karigar>('/karigars', { page: 1, pageSize: 100 }),
  });
  const keep = new Set([editing?.carrierId, editing?.flatlockKarigarId, editing?.overlockCarrierId]);
  const karigarOptions = karigars?.items.filter((k) => k.isActive || keep.has(k.id)) ?? [];

  const { data: lots, isFetching: lotsLoading } = useQuery({
    queryKey: ['production-entries', 'karigar-lots', form.carrierId, bookId],
    queryFn: () => apiClient.get<ProductionKarigarLot[]>('/production-entries/karigar-lots', { karigarId: form.carrierId, bookId }),
    enabled: Boolean(form.carrierId && bookId),
  });
  // New entries: only lots with pieces still to hand in. Editing: the entry's own lot.
  const lotOptions = lots?.filter((l) => (isEdit ? l.id === form.cuttingEntryId : l.piecesPending > 0)) ?? [];
  const lot = lots?.find((l) => l.id === form.cuttingEntryId);

  // A different karigar has different lots: drop a lot they never took.
  useEffect(() => {
    if (!isEdit && form.cuttingEntryId && lots && !lotOptions.some((l) => l.id === form.cuttingEntryId)) set({ cuttingEntryId: '' });
  }, [lots]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: availability, isFetching: availabilityLoading } = useQuery({
    queryKey: ['production-entries', 'availability', form.carrierId, form.cuttingEntryId, editId],
    queryFn: () =>
      apiClient.get<ProductionAvailability>('/production-entries/availability', {
        karigarId: form.carrierId,
        cuttingEntryId: form.cuttingEntryId,
        excludeId: editId ?? undefined,
      }),
    enabled: Boolean(form.carrierId && form.cuttingEntryId),
  });

  // A different karigar or lot starts with an empty grid (an edit keeps its own pieces).
  const pickKarigar = (carrierId: string) => {
    set({ carrierId, cuttingEntryId: '' });
    setQtys({});
  };
  const pickLot = (cuttingEntryId: string) => {
    set({ cuttingEntryId });
    setQtys({});
  };

  // Old entries without a lot have no grid; they keep their saved quantity.
  const hasGrid = Boolean(form.cuttingEntryId);
  const grid = summarizeGrid(availability, qtys);
  const quantity = hasGrid ? grid.total : (editing?.carrierQuantity ?? 0);
  const flatlockOn = form.flatlockKarigarId !== NONE;
  const overlockOn = form.overlockCarrierId !== NONE;
  const stitchingTotal = form.carrierRate ? quantity * Number(form.carrierRate) : 0;
  const flatlockTotal = flatlockOn && form.flatlockRate ? quantity * Number(form.flatlockRate) : 0;
  const overlockTotal = overlockOn && form.overlockRate ? quantity * Number(form.overlockRate) : 0;
  const grandTotal = stitchingTotal + flatlockTotal + overlockTotal;

  const mutation = useMutation({
    mutationFn: (confirmed: boolean) => {
      const payload = {
        date: form.date,
        entryTime: form.entryTime || null,
        carrierRate: rateOrNull(form.carrierRate),
        flatlockKarigarId: flatlockOn ? form.flatlockKarigarId : null,
        flatlockRate: flatlockOn ? rateOrNull(form.flatlockRate) : null,
        overlockCarrierId: overlockOn ? form.overlockCarrierId : null,
        overlockRate: overlockOn ? rateOrNull(form.overlockRate) : null,
        photoUrl: form.photoUrl ?? undefined,
        confirmed: confirmed || undefined,
        remarks: form.remarks || (isEdit ? null : undefined),
        ...(hasGrid && availability
          ? {
              quantities: availability.colors.flatMap((c) =>
                c.cells.map((cell) => ({ colorId: c.colorId, sizeId: cell.sizeId, quantity: Number(qtys[cellKey(c.colorId, cell.sizeId)]) || 0 })),
              ),
            }
          : {}),
      };
      if (isEdit) return apiClient.patch(`/production-entries/${editId}`, payload);
      return apiClient.post('/production-entries', { ...payload, cuttingEntryId: form.cuttingEntryId, carrierId: form.carrierId });
    },
    onError: (err) => {
      if (err instanceof ApiRequestError && err.code === 'PAID_CHANGE') {
        setPaidWarning(err.message);
        return;
      }
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');
    },
  });

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  // Older entries may predate lots; they can still be edited (e.g. to fill in rates).
  const isValid = Boolean(form.carrierId && (isEdit || form.cuttingEntryId) && form.date && form.photoUrl && quantity > 0 && !grid.over);

  const save = (andNew: boolean, confirmed = false) => {
    setError(null);
    setPendingNew(andNew);
    mutation.mutate(confirmed, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['production-entries'] });
        void queryClient.invalidateQueries({ queryKey: ['accessory-issues'] });
        if (isEdit) {
          navigate('/production-history');
          return;
        }
        setSaved(true);
        // Save & New keeps the date and the karigar — the next lot is often theirs too.
        setQtys({});
        setForm(andNew ? { ...emptyForm(), date: form.date, carrierId: form.carrierId } : emptyForm());
      },
    });
  };

  // Flatlock / overlock dropdowns list only karigars whose work type is that stage (spacing and case ignored).
  const isWorkType = (k: Karigar, stage: string) =>
    k.workType.name.toLowerCase().replace(/[^a-z]/g, '') === stage.toLowerCase();
  const otherKarigarSelect = (id: string, value: string, onChange: (v: string) => void, label: string) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={`${label} karigar`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Not done</SelectItem>
        {karigarOptions.filter((k) => k.id === value || isWorkType(k, label)).map((k) => (
          <SelectItem key={k.id} value={k.id}>
            {k.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (isEdit && editLoading) {
    return (
      <PageLayout title="Edit Production Entry">
        <LoadingState variant="page" />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={isEdit ? 'Edit Production Entry' : 'Daily Production Entry'}
      description="Pieces the karigar hands in, size by size — stitching, flatlock and overlock."
    >
      <Card>
        <CardContent className="p-3 sm:p-4">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save(false);
            }}
          >
            {error ? <FormAlert tone="error">{error}</FormAlert> : null}
            {saved ? <FormAlert tone="success">Production entry saved.</FormAlert> : null}
            {!bookId && !isEdit ? (
              <FormAlert tone="error">No active book is selected. Add a book in Book Master, then select it in the header.</FormAlert>
            ) : null}

            {/* Karigar → lot → date & time */}
            <div className="grid grid-cols-1 gap-x-3 gap-y-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)]">
              <FormField label="Stitching Karigar" required htmlFor="pe-karigar">
                <Select value={form.carrierId} disabled={isEdit} onValueChange={pickKarigar}>
                  <SelectTrigger id="pe-karigar">
                    <SelectValue placeholder="Select karigar" />
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

              <FormField
                label="Lot Number"
                required
                htmlFor="pe-lot"
                hint={
                  isEdit
                    ? 'Cannot be changed'
                    : form.carrierId && lots && !lotOptions.length && !lotsLoading
                      ? 'No pending lot for this karigar in this book (Cutting Distribution)'
                      : undefined
                }
              >
                <Select value={form.cuttingEntryId} disabled={isEdit || !form.carrierId} onValueChange={pickLot}>
                  <SelectTrigger id="pe-lot">
                    <SelectValue placeholder={form.carrierId ? 'Select lot' : 'Select a karigar first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {lotOptions.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        Lot {l.lotNumber} · {l.item.itemName} · {isEdit ? `${l.piecesTaken} pcs` : `${l.piecesPending} pcs with karigar`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Date & Time" required htmlFor="pe-date">
                <div className="flex gap-2">
                  <DatePicker id="pe-date" required className="min-w-0 flex-1" value={form.date} onChange={(date) => set({ date })} />
                  <Input
                    type="time"
                    aria-label="Time"
                    className="w-[7.25rem] shrink-0"
                    value={form.entryTime}
                    onChange={(e) => set({ entryTime: e.target.value })}
                  />
                </div>
              </FormField>
            </div>

            {/* Read-only lot details */}
            {lot ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md bg-muted px-3 py-2 text-sm">
                <span>
                  <span className="text-muted-foreground">Design</span> <span className="font-semibold">{lot.item.itemName}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Party</span> <span className="font-medium">{lot.party.name}</span>
                </span>
                <Badge variant={lot.isOnline ? 'info' : 'muted'}>{lot.isOnline ? 'Online' : 'Offline'}</Badge>
                <span className="text-muted-foreground">
                  Given <span className="numeric font-medium text-foreground">{lot.piecesTaken}</span>
                  {lot.piecesProduced && !isEdit ? (
                    <>
                      {' '}· already in <span className="numeric font-medium text-foreground">{lot.piecesProduced}</span>
                    </>
                  ) : null}
                </span>
                <span className="ml-auto font-semibold text-primary">
                  Handing in now: <span className="numeric">{quantity}</span> pcs
                </span>
              </div>
            ) : null}

            {/* Size-wise pieces handed in */}
            {hasGrid ? (
              <ProductionSizeGrid
                availability={availability}
                loading={availabilityLoading}
                emptyText="This karigar has no pieces of this lot."
                values={qtys}
                onChange={setQtys}
              />
            ) : (
              <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                {isEdit ? `${quantity} pcs (this older entry has no size details)` : 'Select a karigar and a lot to enter the pieces size by size.'}
              </div>
            )}

            {/* Stitching · Flatlock · Overlock */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <StageCard
                title={STAGE_LABELS.stitching}
                accent="bg-primary"
                quantity={quantity}
                active
                rateId="pe-rate-stitching"
                rate={form.carrierRate}
                onRate={(v) => set({ carrierRate: v })}
                karigarSlot={
                  <div className="flex h-9 items-center truncate rounded-md border border-dashed border-border px-2.5 text-sm max-sm:h-11">
                    {karigarOptions.find((k) => k.id === form.carrierId)?.fullName ?? (
                      <span className="text-muted-foreground">Stitching karigar above</span>
                    )}
                  </div>
                }
              />
              <StageCard
                title={STAGE_LABELS.flatlock}
                accent="bg-status-progress"
                quantity={quantity}
                active={flatlockOn}
                rateId="pe-rate-flatlock"
                rate={form.flatlockRate}
                onRate={(v) => set({ flatlockRate: v })}
                karigarSlot={otherKarigarSelect('pe-flatlock', form.flatlockKarigarId, (v) => set({ flatlockKarigarId: v }), 'Flatlock')}
              />
              <StageCard
                title={STAGE_LABELS.overlock}
                accent="bg-status-success"
                quantity={quantity}
                active={overlockOn}
                rateId="pe-rate-overlock"
                rate={form.overlockRate}
                onRate={(v) => set({ overlockRate: v })}
                karigarSlot={otherKarigarSelect('pe-overlock', form.overlockCarrierId, (v) => set({ overlockCarrierId: v }), 'Overlock')}
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 rounded-md border border-border px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                Stitching <span className="numeric text-foreground">₹ {money(stitchingTotal)}</span>
              </span>
              <span className="text-muted-foreground">
                Flatlock <span className="numeric text-foreground">₹ {money(flatlockTotal)}</span>
              </span>
              <span className="text-muted-foreground">
                Overlock <span className="numeric text-foreground">₹ {money(overlockTotal)}</span>
              </span>
              <span className="font-semibold">
                Grand Total <output aria-live="polite" className="numeric text-base text-primary">₹ {money(grandTotal)}</output>
              </span>
            </div>

            {/* Photo compare + remarks */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="space-y-1">
                <p className="text-xs font-medium">
                  Photo <span className="text-destructive">*</span>
                </p>
                <ProductionPhotoCompare lotPhotoUrl={lot?.lotPhotoUrl ?? null} value={form.photoUrl} onChange={(url) => set({ photoUrl: url })} />
              </div>
              <FormField label="Remarks" htmlFor="pe-remarks">
                <Textarea
                  id="pe-remarks"
                  rows={4}
                  placeholder="Enter remarks (optional)"
                  className="min-h-24 resize-y"
                  value={form.remarks}
                  onChange={(e) => set({ remarks: e.target.value })}
                />
              </FormField>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border pt-3 sm:justify-end">
              {isEdit ? (
                <Button type="button" variant="outline" onClick={() => navigate('/production-history')}>
                  Cancel
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => setForm(emptyForm())}>
                    <RotateCcw />
                    Clear
                  </Button>
                  <Button type="button" variant="outline" loading={mutation.isPending} disabled={!isValid} onClick={() => save(true)}>
                    <FilePlus2 />
                    Save & New
                  </Button>
                </>
              )}
              <Button type="submit" className="sm:min-w-28" loading={mutation.isPending} disabled={!isValid}>
                <Save />
                {isEdit ? 'Save Changes' : 'Save Entry'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={paidWarning !== null}
        onOpenChange={(open) => !open && setPaidWarning(null)}
        title="Karigar was already paid"
        description={paidWarning}
        confirmLabel="Yes, save the change"
        isSubmitting={mutation.isPending}
        onConfirm={() => {
          setPaidWarning(null);
          save(pendingNew, true);
        }}
      />
    </PageLayout>
  );
};
