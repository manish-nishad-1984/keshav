import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Factory, History, Hourglass, ImageOff, PackageCheck, Save, Truck, type LucideIcon } from 'lucide-react';
import { QtyChip, QtyLegend, QtyRowLabel, type QtyTone } from '../ui/qty-tone';
import { apiClient, ApiRequestError, resolvePhotoUrl } from '../../lib/api-client';
import { PageLayout } from '../../components/layout/PageLayout';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import { LoadingState } from '../ui/loading-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePicker } from '../ui/date-picker';
import { useSelectedBook } from '../../hooks/use-selected-book';
import { localIsoDate } from '../../lib/date';
import { cn } from '../../lib/utils';
import type { Delivery, DeliveryAvailability, DeliveryLot } from './delivery-constants';
import { cellKey, DELIVERIES_QUERY_KEY } from './delivery-constants';

interface DeliveryFormViewProps {
  delivery: Delivery | null;
  // Called with the saved delivery so the page can open its challan.
  onDone: (saved: Delivery) => void;
  onCancel: () => void;
}

// The grid's summary rows, in order; their colours also tint the cells (see qty-tone).
const LEGEND = [
  { tone: 'total', icon: Factory, label: 'Produced' },
  { tone: 'earlier', icon: History, label: 'Delivered earlier' },
  { tone: 'now', icon: Truck, label: 'Delivering now' },
  { tone: 'pending', icon: Hourglass, label: 'Still ready' },
] as const satisfies readonly { tone: QtyTone; icon: LucideIcon; label: string }[];

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const toNumberOrEmpty = (value: string): number | '' => (value === '' ? '' : Number(value));
const formatQty = (value: number) => value.toLocaleString('en-IN');
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export const DeliveryFormView = ({ delivery, onDone, onCancel }: DeliveryFormViewProps) => {
  const isEdit = Boolean(delivery);
  const queryClient = useQueryClient();
  const { selectedBook } = useSelectedBook();
  const bookId = delivery?.cuttingEntry.bookId ?? selectedBook?.id;
  const [error, setError] = useState<string | null>(null);

  const [lotId, setLotId] = useState(delivery?.cuttingEntryId ?? '');
  const [date, setDate] = useState(delivery?.date.slice(0, 10) ?? localIsoDate());
  const [entryTime, setEntryTime] = useState(delivery ? (delivery.entryTime ?? '') : nowTime());
  const [remarks, setRemarks] = useState(delivery?.remarks ?? '');
  const [billNumber, setBillNumber] = useState(delivery?.billNumber ?? '');
  // Pieces delivered now, keyed "colorId:sizeId".
  const [sent, setSent] = useState<Record<string, number | ''>>(() =>
    Object.fromEntries(delivery?.quantities.map((q) => [cellKey(q.colorId, q.sizeId), q.quantity]) ?? []),
  );

  const { data: lots } = useQuery({
    queryKey: [...DELIVERIES_QUERY_KEY, 'lots', bookId],
    queryFn: () => apiClient.get<DeliveryLot[]>('/deliveries/lots', { bookId }),
    enabled: Boolean(bookId),
  });
  const { data: availability, isFetching: availabilityLoading } = useQuery({
    queryKey: [...DELIVERIES_QUERY_KEY, 'availability', lotId, delivery?.id],
    queryFn: () => apiClient.get<DeliveryAvailability>(`/deliveries/availability/${lotId}`, { excludeId: delivery?.id }),
    enabled: Boolean(lotId),
  });

  // Lots with produced pieces not yet delivered — plus the lot being edited.
  const lotOptions =
    lots?.filter((l) => l.producedQuantity - l.deliveredQuantity > 0 || l.id === delivery?.cuttingEntryId) ?? [];
  const selectedLot = lots?.find((l) => l.id === lotId);

  const sizes = availability?.sizes ?? [];
  // Only colours with something produced; the rest have nothing to deliver.
  const colors = availability?.colors.filter((c) => c.cells.some((cell) => cell.produced > 0)) ?? [];
  const qty = (key: string) => Number(sent[key]) || 0;

  const rowTotal = (colorId: string) => sum(sizes.map((s) => qty(cellKey(colorId, s.id))));
  const column = (sizeId: string, pick: 'produced' | 'delivered' | 'remaining') =>
    sum(colors.map((c) => c.cells.find((cell) => cell.sizeId === sizeId)?.[pick] ?? 0));
  const sentColumn = (sizeId: string) => sum(colors.map((c) => qty(cellKey(c.colorId, sizeId))));
  const totalOf = (pick: 'produced' | 'delivered' | 'remaining') => sum(sizes.map((s) => column(s.id, pick)));
  const totalSent = sum(sizes.map((s) => sentColumn(s.id)));

  const overCells = colors.flatMap((c) => c.cells.filter((cell) => qty(cellKey(c.colorId, cell.sizeId)) > cell.remaining));

  const deliverAllReady = () =>
    setSent(
      Object.fromEntries(
        colors.flatMap((c) => c.cells.filter((cell) => cell.remaining > 0).map((cell) => [cellKey(c.colorId, cell.sizeId), cell.remaining])),
      ),
    );

  const mutation = useMutation({
    mutationFn: async () => {
      const quantities = colors.flatMap((c) =>
        c.cells.filter((cell) => cell.produced > 0).map((cell) => ({
          colorId: c.colorId,
          sizeId: cell.sizeId,
          quantity: qty(cellKey(c.colorId, cell.sizeId)),
        })),
      );
      const payload = { date, entryTime: entryTime || null, billNumber: billNumber.trim() || null, remarks: remarks.trim() || null, quantities };
      if (isEdit && delivery) return apiClient.patch<Delivery>(`/deliveries/${delivery.id}`, payload);
      return apiClient.post<Delivery>('/deliveries', { ...payload, cuttingEntryId: lotId });
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY });
      onDone(saved);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'),
  });

  const canSubmit = Boolean(lotId && date && totalSent > 0 && overCells.length === 0);
  const lot = availability?.cuttingEntry;
  const designPhoto = resolvePhotoUrl(lot?.photoUrl);

  return (
    <PageLayout
      title={isEdit ? `Edit Delivery · Challan ${delivery?.challanNumber}` : 'New Delivery'}
      description="Send finished pieces of a lot to its party, by colour and size."
    >
      <Card>
        <CardContent className="p-3 sm:p-4">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              mutation.mutate();
            }}
          >
            {error ? <FormAlert tone="error">{error}</FormAlert> : null}
            {!bookId ? (
              <FormAlert tone="error">No active book is selected. Add a book in Book Master, then select it in the header.</FormAlert>
            ) : null}

            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                label="Lot Number"
                required
                htmlFor="del-lot"
                hint={
                  isEdit
                    ? 'Cannot be changed'
                    : lots && !lotOptions.length
                      ? 'No lot in this book has produced pieces left to deliver'
                      : 'Lots with production (partial or complete)'
                }
              >
                <Select
                  value={lotId}
                  disabled={isEdit}
                  onValueChange={(v) => {
                    setLotId(v);
                    setSent({});
                  }}
                >
                  <SelectTrigger id="del-lot">
                    <SelectValue placeholder="Select lot" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotOptions.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        Lot {l.lotNumber} · {l.item.itemName} · {formatQty(l.producedQuantity - l.deliveredQuantity)} ready
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Date & Time" required htmlFor="del-date">
                <div className="flex gap-2">
                  <DatePicker id="del-date" required className="min-w-0 flex-1" value={date} onChange={setDate} />
                  <Input
                    type="time"
                    aria-label="Time"
                    className="w-[7.5rem] shrink-0"
                    value={entryTime}
                    onChange={(e) => setEntryTime(e.target.value)}
                  />
                </div>
              </FormField>

              <FormField label="Bill No." htmlFor="del-bill" hint="Client's reference (optional)">
                <Input id="del-bill" maxLength={50} value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
              </FormField>

              <FormField label="Party" htmlFor="del-party" hint="The lot's party">
                <Input
                  id="del-party"
                  readOnly
                  tabIndex={-1}
                  placeholder="Select a lot first"
                  value={lot?.party.name ?? delivery?.party.name ?? ''}
                />
              </FormField>
            </div>

            {lot ? (
              <div className="flex gap-3 rounded-lg border border-border p-2.5">
                {designPhoto ? (
                  <a href={designPhoto} target="_blank" rel="noreferrer" className="shrink-0">
                    <img
                      src={designPhoto}
                      alt={`Design ${lot.item.itemName}`}
                      className="size-28 rounded-md border border-border object-cover sm:size-32"
                    />
                  </a>
                ) : (
                  <span className="flex size-28 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-xs text-muted-foreground sm:size-32">
                    <ImageOff className="size-5" />
                    No photo
                  </span>
                )}
                <dl className="grid min-w-0 flex-1 grid-cols-2 content-start gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Design</dt>
                    <dd className="font-semibold">{lot.item.itemName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Lot</dt>
                    <dd className="numeric font-semibold">{lot.lotNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Type</dt>
                    <dd className="font-medium">{lot.isOnline ? 'Online' : 'Offline'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Cut</dt>
                    <dd className="numeric font-medium">{formatQty(lot.totalQuantity)} pcs</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Produced</dt>
                    <dd className="numeric font-medium">{formatQty(selectedLot?.producedQuantity ?? totalOf('produced'))} pcs</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Ready to deliver</dt>
                    <dd className="numeric font-semibold text-primary">{formatQty(totalOf('remaining'))} pcs</dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <section aria-labelledby="del-sizes-heading" className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <h3 id="del-sizes-heading" className="text-sm font-semibold">
                    Sizes
                  </h3>
                  <QtyLegend items={LEGEND} />
                </div>
                {colors.length ? (
                  <Button type="button" variant="ghost" size="sm" onClick={deliverAllReady} disabled={totalOf('remaining') === 0}>
                    <PackageCheck />
                    Deliver all ready
                  </Button>
                ) : null}
              </div>

              {!lotId ? (
                <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Select a lot to see its produced sizes.
                </div>
              ) : availabilityLoading && !availability ? (
                <LoadingState />
              ) : !colors.length ? (
                <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Nothing produced in this lot yet.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="data-table w-full min-w-max text-sm">
                    <thead className="border-b border-border text-2xs uppercase tracking-wider">
                      <tr>
                        <th className="w-14 px-2 py-2 text-left">Photo</th>
                        <th className="min-w-[8rem] px-2 py-2 text-left">Colour</th>
                        {sizes.map((size) => (
                          <th key={size.id} className="w-28 px-1.5 py-2 text-center normal-case tracking-normal">
                            <span className="block text-sm font-semibold">{size.name}</span>
                            {size.detail ? <span className="block text-xs font-normal opacity-80">{size.detail}</span> : null}
                          </th>
                        ))}
                        <th className="w-24 px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {colors.map((color) => {
                        const photo = resolvePhotoUrl(color.photoUrl);
                        return (
                          <tr key={color.colorId} className="border-b border-border last:border-0">
                            <td className="px-2 py-1.5">
                              {photo ? (
                                <img src={photo} alt={`${color.name} cloth`} className="size-10 rounded-md border border-border object-cover" />
                              ) : (
                                <span className="flex size-10 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
                                  <ImageOff className="size-4" />
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 font-medium">{color.name}</td>
                            {color.cells.map((cell) => {
                              const key = cellKey(color.colorId, cell.sizeId);
                              const over = qty(key) > cell.remaining;
                              const size = sizes.find((s) => s.id === cell.sizeId);
                              return (
                                <td key={cell.sizeId} className="px-1 py-1.5 text-center align-top">
                                  {cell.produced === 0 ? (
                                    <span className="inline-block pt-2 text-muted-foreground">—</span>
                                  ) : (
                                    <>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={cell.remaining}
                                        step={1}
                                        inputMode="numeric"
                                        aria-label={`${color.name}, size ${size?.name ?? ''}, ${cell.remaining} ready`}
                                        aria-invalid={over || undefined}
                                        disabled={cell.remaining === 0 && !qty(key)}
                                        className={cn(
                                          'numeric mx-auto h-10 w-20 px-2 text-center text-base font-semibold',
                                          qty(key) > 0 && 'border-primary/50 bg-primary/10 text-primary',
                                          over && 'border-destructive bg-destructive/10 text-destructive focus-visible:ring-destructive/20',
                                        )}
                                        value={sent[key] ?? ''}
                                        onChange={(e) => setSent((g) => ({ ...g, [key]: toNumberOrEmpty(e.target.value) }))}
                                      />
                                      <QtyChip size="sm" tone="pending" value={cell.remaining} className="mt-1" />
                                    </>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-2 py-1.5 text-right">
                              <QtyChip tone="now" value={rowTotal(color.colorId)} className="min-w-[4rem] text-base" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Produced, delivered earlier, delivering now and what will still be ready */}
                    <tfoot className="text-sm">
                      {(
                        [
                          { ...LEGEND[0], value: (id: string) => column(id, 'produced'), total: totalOf('produced') },
                          { ...LEGEND[1], value: (id: string) => column(id, 'delivered'), total: totalOf('delivered') },
                          { ...LEGEND[2], value: sentColumn, total: totalSent },
                          {
                            ...LEGEND[3],
                            value: (id: string) => column(id, 'remaining') - sentColumn(id),
                            total: totalOf('remaining') - totalSent,
                          },
                        ] as const
                      ).map((line) => (
                        <tr key={line.label} className="border-t border-border bg-card">
                          <td colSpan={2} className="px-2 py-1.5 text-left">
                            <QtyRowLabel tone={line.tone} icon={line.icon} label={line.label} />
                          </td>
                          {sizes.map((size) => (
                            <td key={size.id} className="px-1 py-1.5 text-center">
                              <QtyChip tone={line.tone} value={line.value(size.id)} />
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-right">
                            <QtyChip tone={line.tone} value={line.total} className="min-w-[4rem] text-base" />
                          </td>
                        </tr>
                      ))}
                    </tfoot>
                  </table>
                </div>
              )}

              {overCells.length ? (
                <FormAlert tone="error">Some sizes have more pieces than are ready (shown in red). Reduce them to save.</FormAlert>
              ) : null}
            </section>

            <FormField label="Remarks" htmlFor="del-remarks">
              <Textarea
                id="del-remarks"
                rows={2}
                maxLength={500}
                className="min-h-[3.5rem]"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </FormField>

            <div className="flex gap-2 border-t border-border pt-4 sm:justify-end">
              <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 sm:min-w-24 sm:flex-none" loading={mutation.isPending} disabled={!canSubmit}>
                <Save />
                Save & Challan
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageLayout>
  );
};
