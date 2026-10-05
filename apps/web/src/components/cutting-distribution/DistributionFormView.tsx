import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageOff, PackageCheck, Save } from 'lucide-react';
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
import type { Karigar, WorkType } from '../karigars/karigar-constants';
import type { Availability, Distribution, DistributionLot } from './distribution-constants';
import { cellKey, DISTRIBUTIONS_QUERY_KEY } from './distribution-constants';

interface DistributionFormViewProps {
  distribution: Distribution | null;
  onDone: () => void;
  onCancel: () => void;
}

const ALL_WORK_TYPES = 'all';

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const toNumberOrEmpty = (value: string): number | '' => (value === '' ? '' : Number(value));
const formatQty = (value: number) => value.toLocaleString('en-IN');
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export const DistributionFormView = ({ distribution, onDone, onCancel }: DistributionFormViewProps) => {
  const isEdit = Boolean(distribution);
  const queryClient = useQueryClient();
  const { selectedBook } = useSelectedBook();
  const bookId = distribution?.cuttingEntry.bookId ?? selectedBook?.id;
  const [error, setError] = useState<string | null>(null);

  const [lotId, setLotId] = useState(distribution?.cuttingEntryId ?? '');
  const [workTypeId, setWorkTypeId] = useState(distribution?.karigar.workType.id ?? ALL_WORK_TYPES);
  const [karigarId, setKarigarId] = useState(distribution?.karigarId ?? '');
  const [date, setDate] = useState(distribution?.date.slice(0, 10) ?? localIsoDate());
  const [entryTime, setEntryTime] = useState(distribution ? (distribution.entryTime ?? '') : nowTime());
  const [remarks, setRemarks] = useState(distribution?.remarks ?? '');
  // Pieces given now, keyed "colorId:sizeId".
  const [given, setGiven] = useState<Record<string, number | ''>>(() =>
    Object.fromEntries(distribution?.quantities.map((q) => [cellKey(q.colorId, q.sizeId), q.quantity]) ?? []),
  );

  const { data: lots } = useQuery({
    queryKey: [...DISTRIBUTIONS_QUERY_KEY, 'lots', bookId],
    queryFn: () => apiClient.get<DistributionLot[]>('/cutting-distributions/lots', { bookId }),
    enabled: Boolean(bookId),
  });
  const { data: workTypes } = useQuery({
    queryKey: ['work-types'],
    queryFn: () => apiClient.get<WorkType[]>('/karigars/work-types'),
  });
  const { data: karigars } = useQuery({
    queryKey: ['karigars', 'options'],
    queryFn: () => apiClient.list<Karigar>('/karigars', { page: 1, pageSize: 100 }),
  });
  const { data: availability, isFetching: availabilityLoading } = useQuery({
    queryKey: [...DISTRIBUTIONS_QUERY_KEY, 'availability', lotId, distribution?.id],
    queryFn: () =>
      apiClient.get<Availability>(`/cutting-distributions/availability/${lotId}`, { excludeId: distribution?.id }),
    enabled: Boolean(lotId),
  });

  // Only lots that still have pieces to give — plus the lot being edited.
  const lotOptions = lots?.filter((l) => l.totalQuantity - l.distributedQuantity > 0 || l.id === distribution?.cuttingEntryId) ?? [];
  const karigarOptions =
    karigars?.items.filter(
      (k) =>
        (k.isActive || k.id === distribution?.karigarId) && (workTypeId === ALL_WORK_TYPES || k.workTypeId === workTypeId),
    ) ?? [];

  // A changed work type filter drops a karigar who no longer matches it.
  useEffect(() => {
    if (karigarId && karigars && !karigarOptions.some((k) => k.id === karigarId)) setKarigarId('');
  }, [workTypeId, karigars]); // eslint-disable-line react-hooks/exhaustive-deps

  const sizes = availability?.sizes ?? [];
  const colors = availability?.colors ?? [];
  const qty = (key: string) => Number(given[key]) || 0;

  const rowTotal = (colorId: string) => sum(sizes.map((s) => qty(cellKey(colorId, s.id))));
  const column = (sizeId: string, pick: 'cut' | 'distributed' | 'remaining') =>
    sum(colors.map((c) => c.cells.find((cell) => cell.sizeId === sizeId)?.[pick] ?? 0));
  const givenColumn = (sizeId: string) => sum(colors.map((c) => qty(cellKey(c.colorId, sizeId))));
  const totalOf = (pick: 'cut' | 'distributed' | 'remaining') => sum(sizes.map((s) => column(s.id, pick)));
  const totalGiven = sum(sizes.map((s) => givenColumn(s.id)));

  const overCells = colors.flatMap((c) => c.cells.filter((cell) => qty(cellKey(c.colorId, cell.sizeId)) > cell.remaining));

  const giveAllRemaining = () =>
    setGiven(
      Object.fromEntries(
        colors.flatMap((c) => c.cells.filter((cell) => cell.remaining > 0).map((cell) => [cellKey(c.colorId, cell.sizeId), cell.remaining])),
      ),
    );

  const mutation = useMutation({
    mutationFn: async () => {
      const quantities = colors.flatMap((c) =>
        c.cells.filter((cell) => cell.cut > 0).map((cell) => ({
          colorId: c.colorId,
          sizeId: cell.sizeId,
          quantity: qty(cellKey(c.colorId, cell.sizeId)),
        })),
      );
      const payload = { karigarId, date, entryTime: entryTime || null, remarks: remarks.trim() || null, quantities };
      if (isEdit && distribution) return apiClient.patch(`/cutting-distributions/${distribution.id}`, payload);
      return apiClient.post('/cutting-distributions', { ...payload, cuttingEntryId: lotId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DISTRIBUTIONS_QUERY_KEY });
      onDone();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'),
  });

  const canSubmit = Boolean(lotId && karigarId && date && totalGiven > 0 && overCells.length === 0);

  return (
    <PageLayout title="Cutting Distribution" description="Hand cut pieces of a lot to a karigar, by colour and size.">
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
                htmlFor="dist-lot"
                hint={
                  isEdit
                    ? 'Cannot be changed'
                    : lots && !lotOptions.length
                      ? 'Every lot in this book is fully distributed'
                      : 'Lots that still have pieces to give'
                }
              >
                <Select
                  value={lotId}
                  disabled={isEdit}
                  onValueChange={(v) => {
                    setLotId(v);
                    setGiven({});
                  }}
                >
                  <SelectTrigger id="dist-lot">
                    <SelectValue placeholder="Select lot" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotOptions.map((lot) => (
                      <SelectItem key={lot.id} value={lot.id}>
                        Lot {lot.lotNumber} · {lot.item.itemName} · {formatQty(lot.totalQuantity - lot.distributedQuantity)} of{' '}
                        {formatQty(lot.totalQuantity)} left
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Date & Time" required htmlFor="dist-date">
                <div className="flex gap-2">
                  <DatePicker id="dist-date" required className="min-w-0 flex-1" value={date} onChange={setDate} />
                  <Input
                    type="time"
                    aria-label="Time"
                    className="w-[7.5rem] shrink-0"
                    value={entryTime}
                    onChange={(e) => setEntryTime(e.target.value)}
                  />
                </div>
              </FormField>

              <div className="grid grid-cols-2 gap-2">
                <FormField label="Work Type" htmlFor="dist-work-type">
                  <Select value={workTypeId} onValueChange={setWorkTypeId}>
                    <SelectTrigger id="dist-work-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_WORK_TYPES}>All</SelectItem>
                      {workTypes
                        ?.filter((w) => w.isActive || w.id === workTypeId)
                        .map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            {w.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Karigar" required htmlFor="dist-karigar">
                  <Select value={karigarId} onValueChange={setKarigarId}>
                    <SelectTrigger id="dist-karigar">
                      <SelectValue placeholder={karigarOptions.length ? 'Select karigar' : 'No karigars'} />
                    </SelectTrigger>
                    <SelectContent>
                      {karigarOptions.map((k) => (
                        <SelectItem key={k.id} value={k.id}>
                          {k.fullName}
                          {k.isActive ? '' : ' (inactive)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </div>

            {availability ? (
              <p className="text-xs text-muted-foreground">
                Design <span className="font-medium text-foreground">{availability.cuttingEntry.item.itemName}</span> · Party{' '}
                <span className="font-medium text-foreground">{availability.cuttingEntry.party.name}</span> · Cut{' '}
                <span className="numeric font-medium text-foreground">{formatQty(availability.cuttingEntry.totalQuantity)}</span> pcs
              </p>
            ) : null}

            <section aria-labelledby="dist-sizes-heading" className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="dist-sizes-heading" className="text-sm font-semibold">
                  Sizes
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Fill the pieces given now — “left” is what the lot still has
                  </span>
                </h3>
                {colors.length ? (
                  <Button type="button" variant="ghost" size="sm" onClick={giveAllRemaining} disabled={totalOf('remaining') === 0}>
                    <PackageCheck />
                    Give all remaining
                  </Button>
                ) : null}
              </div>

              {!lotId ? (
                <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Select a lot to see its colours and sizes.
                </div>
              ) : availabilityLoading && !availability ? (
                <LoadingState />
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="data-table w-full min-w-max text-sm">
                    <thead className="border-b border-border text-2xs uppercase tracking-wider">
                      <tr>
                        <th className="w-14 px-2 py-2 text-left">Photo</th>
                        <th className="min-w-[9rem] px-2 py-2 text-left">Colour</th>
                        {sizes.map((size) => (
                          <th key={size.id} className="min-w-[5rem] px-1.5 py-1.5 text-center normal-case tracking-normal">
                            <span className="block text-xs font-semibold">{size.name}</span>
                            {size.detail ? <span className="block text-2xs font-normal opacity-80">{size.detail}</span> : null}
                          </th>
                        ))}
                        <th className="w-20 px-2 py-2 text-right">Total</th>
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
                                  {cell.cut === 0 ? (
                                    <span className="inline-block pt-2 text-muted-foreground">—</span>
                                  ) : (
                                    <>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={cell.remaining}
                                        step={1}
                                        inputMode="numeric"
                                        aria-label={`${color.name}, size ${size?.name ?? ''}, ${cell.remaining} left`}
                                        aria-invalid={over || undefined}
                                        disabled={cell.remaining === 0 && !qty(key)}
                                        className={cn(
                                          'numeric mx-auto h-9 w-[4.75rem] px-2 text-center',
                                          over && 'border-destructive text-destructive focus-visible:ring-destructive/20',
                                        )}
                                        value={given[key] ?? ''}
                                        onChange={(e) => setGiven((g) => ({ ...g, [key]: toNumberOrEmpty(e.target.value) }))}
                                      />
                                      <span className={cn('mt-0.5 block text-2xs', over ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                                        {cell.remaining === 0 ? 'none left' : `${formatQty(cell.remaining)} left`}
                                      </span>
                                    </>
                                  )}
                                </td>
                              );
                            })}
                            <td className="numeric px-2 py-1.5 text-right font-semibold">{formatQty(rowTotal(color.colorId))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Lot total, given earlier, given now and what will still be left */}
                    <tfoot className="text-xs">
                      {(
                        [
                          { label: 'Lot total (cut)', value: (id: string) => column(id, 'cut'), total: totalOf('cut'), className: 'text-muted-foreground' },
                          { label: 'Given earlier', value: (id: string) => column(id, 'distributed'), total: totalOf('distributed'), className: 'text-muted-foreground' },
                          { label: 'Giving now', value: givenColumn, total: totalGiven, className: 'font-semibold' },
                          {
                            label: 'Still to give',
                            value: (id: string) => column(id, 'remaining') - givenColumn(id),
                            total: totalOf('remaining') - totalGiven,
                            className: 'font-semibold text-primary',
                          },
                        ] as const
                      ).map((line) => (
                        <tr key={line.label} className="border-t border-border">
                          <td colSpan={2} className={cn('px-2 py-1.5 text-left', line.className)}>
                            {line.label}
                          </td>
                          {sizes.map((size) => {
                            const v = line.value(size.id);
                            return (
                              <td key={size.id} className={cn('numeric px-2 py-1.5 text-center', line.className, v < 0 && 'text-destructive')}>
                                {formatQty(v)}
                              </td>
                            );
                          })}
                          <td className={cn('numeric px-2 py-1.5 text-right', line.className, line.total < 0 && 'text-destructive')}>
                            {formatQty(line.total)}
                          </td>
                        </tr>
                      ))}
                    </tfoot>
                  </table>
                </div>
              )}

              {overCells.length ? (
                <FormAlert tone="error">Some sizes have more pieces than are left in the lot (shown in red). Reduce them to save.</FormAlert>
              ) : null}
            </section>

            <FormField label="Remarks" htmlFor="dist-remarks">
              <Textarea
                id="dist-remarks"
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
                Save
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageLayout>
  );
};
