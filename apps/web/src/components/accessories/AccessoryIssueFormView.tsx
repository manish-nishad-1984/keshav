import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, PackageMinus, PackagePlus, Save } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
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
import type { Karigar } from '../karigars/karigar-constants';
import type { AccessoryTransaction, AccessoryTransactionType, KarigarLot, PositionWithPending } from './accessory-constants';
import { ACCESSORY_ISSUES_QUERY_KEY, formatAmount } from './accessory-constants';

interface AccessoryIssueFormViewProps {
  transaction: AccessoryTransaction | null;
  initialType: AccessoryTransactionType;
  onDone: () => void;
  onCancel: () => void;
}

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const EPS = 0.0005;

export const AccessoryIssueFormView = ({ transaction, initialType, onDone, onCancel }: AccessoryIssueFormViewProps) => {
  const isEdit = Boolean(transaction);
  const queryClient = useQueryClient();
  const { selectedBook } = useSelectedBook();
  const bookId = transaction?.cuttingEntry.bookId ?? selectedBook?.id;
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<AccessoryTransactionType>(transaction?.type ?? initialType);
  const [karigarId, setKarigarId] = useState(transaction?.karigarId ?? '');
  const [lotId, setLotId] = useState(transaction?.cuttingEntryId ?? '');
  const [date, setDate] = useState(transaction?.date.slice(0, 10) ?? localIsoDate());
  const [entryTime, setEntryTime] = useState(transaction ? (transaction.entryTime ?? '') : nowTime());
  const [remarks, setRemarks] = useState(transaction?.remarks ?? '');
  const [quantities, setQuantities] = useState<Record<string, number | ''>>(() =>
    Object.fromEntries(transaction?.lines.map((l) => [l.accessoryId, Number(l.quantity)]) ?? []),
  );

  const { data: karigars } = useQuery({
    queryKey: ['karigars', 'options'],
    queryFn: () => apiClient.list<Karigar>('/karigars', { page: 1, pageSize: 100 }),
  });
  const { data: lots } = useQuery({
    queryKey: [...ACCESSORY_ISSUES_QUERY_KEY, 'karigar-lots', karigarId, bookId],
    queryFn: () => apiClient.get<KarigarLot[]>('/accessory-issues/karigar-lots', { karigarId, bookId }),
    enabled: Boolean(karigarId && bookId),
  });
  const { data: position, isFetching: positionLoading } = useQuery({
    queryKey: [...ACCESSORY_ISSUES_QUERY_KEY, 'position', karigarId, lotId, transaction?.id],
    queryFn: () =>
      apiClient.get<PositionWithPending>('/accessory-issues/position', {
        karigarId,
        cuttingEntryId: lotId,
        excludeId: transaction?.id,
      }),
    enabled: Boolean(karigarId && lotId),
  });

  const karigarOptions = karigars?.items.filter((k) => k.isActive || k.id === transaction?.karigarId) ?? [];

  // A different karigar has different lots: drop a lot they never took.
  useEffect(() => {
    if (!isEdit && lotId && lots && !lots.some((l) => l.id === lotId)) setLotId('');
  }, [lots, lotId, isEdit]);

  const lines = position?.lines ?? [];
  const isIssue = type === 'ISSUE';
  const maxFor = (line: (typeof lines)[number]) => (isIssue ? (line.perPiece > 0 ? line.canIssue : 0) : line.holding);
  const qty = (id: string) => Number(quantities[id]) || 0;
  const overLines = lines.filter((l) => qty(l.accessoryId) > maxFor(l) + EPS);
  const anyQuantity = lines.some((l) => qty(l.accessoryId) > 0);

  const fillAll = () =>
    setQuantities(Object.fromEntries(lines.filter((l) => maxFor(l) > 0).map((l) => [l.accessoryId, maxFor(l)])));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        date,
        entryTime: entryTime || null,
        remarks: remarks.trim() || null,
        lines: lines.map((l) => ({ accessoryId: l.accessoryId, quantity: qty(l.accessoryId) })),
      };
      if (isEdit && transaction) return apiClient.patch(`/accessory-issues/${transaction.id}`, payload);
      return apiClient.post('/accessory-issues', { ...payload, type, karigarId, cuttingEntryId: lotId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ACCESSORY_ISSUES_QUERY_KEY });
      onDone();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'),
  });

  const canSubmit = Boolean(karigarId && lotId && date && anyQuantity && overLines.length === 0);

  return (
    <PageLayout title="Accessory Issue / Return" description="Give accessories to a karigar for a lot they took, or take back the extra.">
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

            {/* Issue or return */}
            <div role="radiogroup" aria-label="Entry type" className="inline-flex rounded-md border border-border bg-muted p-0.5">
              {(
                [
                  { value: 'ISSUE', label: 'Issue to karigar', icon: PackagePlus },
                  { value: 'RETURN', label: 'Return from karigar', icon: PackageMinus },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={type === option.value}
                  disabled={isEdit && type !== option.value}
                  onClick={() => {
                    setType(option.value);
                    setQuantities({});
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors disabled:opacity-40',
                    type === option.value ? 'bg-card font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <option.icon className="size-4" />
                  {option.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Karigar" required htmlFor="acc-karigar">
                <Select
                  value={karigarId}
                  disabled={isEdit}
                  onValueChange={(v) => {
                    setKarigarId(v);
                    setQuantities({});
                  }}
                >
                  <SelectTrigger id="acc-karigar">
                    <SelectValue placeholder={karigarOptions.length ? 'Select karigar' : 'No karigars'} />
                  </SelectTrigger>
                  <SelectContent>
                    {karigarOptions.map((k) => (
                      <SelectItem key={k.id} value={k.id}>
                        {k.fullName}
                        <span className="ml-1.5 text-muted-foreground">{k.workType.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                label="Lot Number"
                required
                htmlFor="acc-lot"
                hint={
                  isEdit
                    ? 'Cannot be changed'
                    : karigarId && lots && !lots.length
                      ? 'This karigar has taken no lot in this book (Cutting Distribution)'
                      : 'Lots this karigar took'
                }
              >
                <Select
                  value={lotId}
                  disabled={isEdit || !karigarId}
                  onValueChange={(v) => {
                    setLotId(v);
                    setQuantities({});
                  }}
                >
                  <SelectTrigger id="acc-lot">
                    <SelectValue placeholder={karigarId ? 'Select lot' : 'Select a karigar first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {lots?.map((lot) => (
                      <SelectItem key={lot.id} value={lot.id}>
                        Lot {lot.lotNumber} · {lot.item.itemName} · {lot.piecesTaken} pcs taken
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Date & Time" required htmlFor="acc-date">
                <div className="flex gap-2">
                  <DatePicker id="acc-date" required className="min-w-0 flex-1" value={date} onChange={setDate} />
                  <Input
                    type="time"
                    aria-label="Time"
                    className="w-[7.5rem] shrink-0"
                    value={entryTime}
                    onChange={(e) => setEntryTime(e.target.value)}
                  />
                </div>
              </FormField>
            </div>

            {position?.pendingElsewhere.length ? (
              <div role="status" className="flex gap-2 rounded-md border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-warning" />
                <div>
                  <p className="font-medium">{position.karigar.fullName} still holds accessories from other lots</p>
                  <p className="text-xs text-muted-foreground">
                    {position.pendingElsewhere
                      .map((p) => `${p.name} ${formatAmount(p.holding)} ${p.unit} (lot ${p.lots.join(', ')})`)
                      .join(' · ')}
                  </p>
                </div>
              </div>
            ) : null}

            <section aria-labelledby="acc-lines-heading" className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="acc-lines-heading" className="text-sm font-semibold">
                  Accessories
                  {position ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      Design {position.lot.item.itemName} · {position.piecesTaken} pcs taken · {position.piecesMade} pcs made
                    </span>
                  ) : null}
                </h3>
                {lines.length ? (
                  <Button type="button" variant="ghost" size="sm" onClick={fillAll} disabled={!lines.some((l) => maxFor(l) > 0)}>
                    {isIssue ? <PackagePlus /> : <PackageMinus />}
                    {isIssue ? 'Give full limit' : 'Take back all extra'}
                  </Button>
                ) : null}
              </div>

              {!karigarId || !lotId ? (
                <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Select a karigar and a lot to see the accessories.
                </div>
              ) : positionLoading && !position ? (
                <LoadingState />
              ) : !lines.length ? (
                <FormAlert tone="error">
                  Design {position?.lot.item.itemName} has no accessories set. Set them in Accessory Master → Per piece, by design.
                </FormAlert>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="data-table w-full min-w-max text-sm">
                    <thead className="border-b border-border text-2xs uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2 text-left">Accessory</th>
                        <th className="px-3 py-2 text-right">Per pc</th>
                        <th className="px-3 py-2 text-right">Limit</th>
                        <th className="px-3 py-2 text-right">Given</th>
                        <th className="px-3 py-2 text-right">Returned</th>
                        <th className="px-3 py-2 text-right">Used</th>
                        <th className="px-3 py-2 text-right">With karigar</th>
                        <th className="px-3 py-2 text-center">{isIssue ? 'Give now' : 'Take back now'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => {
                        const max = maxFor(line);
                        const over = qty(line.accessoryId) > max + EPS;
                        return (
                          <tr key={line.accessoryId} className="border-b border-border last:border-0">
                            <td className="px-3 py-1.5 font-medium">
                              {line.name}
                              <span className="ml-1 text-2xs font-normal text-muted-foreground">{line.unit}</span>
                            </td>
                            <td className="numeric px-3 py-1.5 text-right text-muted-foreground">{line.perPiece ? formatAmount(line.perPiece) : '—'}</td>
                            <td className="numeric px-3 py-1.5 text-right">{formatAmount(line.limit)}</td>
                            <td className="numeric px-3 py-1.5 text-right">{formatAmount(line.issued)}</td>
                            <td className="numeric px-3 py-1.5 text-right text-muted-foreground">{formatAmount(line.returned)}</td>
                            <td className="numeric px-3 py-1.5 text-right text-muted-foreground">{formatAmount(line.used)}</td>
                            <td className={cn('numeric px-3 py-1.5 text-right font-semibold', line.holding > EPS && 'text-status-warning')}>
                              {formatAmount(line.holding)}
                            </td>
                            <td className="px-3 py-1.5 text-center align-top">
                              <Input
                                type="number"
                                min={0}
                                max={max}
                                step="any"
                                inputMode="decimal"
                                aria-label={`${line.name}, ${isIssue ? 'give' : 'take back'} up to ${max}`}
                                aria-invalid={over || undefined}
                                disabled={max <= 0 && !qty(line.accessoryId)}
                                className={cn(
                                  'numeric mx-auto h-9 w-24 px-2 text-center',
                                  over && 'border-destructive text-destructive focus-visible:ring-destructive/20',
                                )}
                                value={quantities[line.accessoryId] ?? ''}
                                onChange={(e) =>
                                  setQuantities((q) => ({ ...q, [line.accessoryId]: e.target.value === '' ? '' : Number(e.target.value) }))
                                }
                              />
                              <span className={cn('mt-0.5 block text-2xs', over ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                                {max > 0 ? `max ${formatAmount(max)}` : isIssue ? 'limit reached' : 'nothing to return'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {overLines.length ? (
                <FormAlert tone="error">
                  {isIssue
                    ? 'Some accessories are above the limit (shown in red). The karigar can get more only after using or returning what they hold.'
                    : 'Some returns are more than the karigar holds (shown in red).'}
                </FormAlert>
              ) : null}
            </section>

            <FormField label="Remarks" htmlFor="acc-remarks">
              <Textarea
                id="acc-remarks"
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
