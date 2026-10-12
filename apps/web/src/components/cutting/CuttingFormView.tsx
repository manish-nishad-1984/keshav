import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings2, Plus, Save, Trash2, UserPlus, Ruler, Palette } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { PageLayout } from '../../components/layout/PageLayout';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePicker } from '../ui/date-picker';
import { PatternTypeManagerDialog } from './PatternTypeManagerDialog';
import { ColorManagerDialog } from './ColorManagerDialog';
import { SizeManagerDialog, SIZES_QUERY_KEY } from './SizeManagerDialog';
import { RowPhotoPicker } from './RowPhotoPicker';
import { PartyFormDialog, PARTIES_QUERY_KEY } from '../parties/PartyFormDialog';
import { BOOKS_QUERY_KEY, useSelectedBook } from '../../hooks/use-selected-book';
import { usePermissions } from '../../hooks/use-permissions';
import { localIsoDate } from '../../lib/date';
import { cn } from '../../lib/utils';
import type { Item } from '../items/item-constants';
import type { Party } from '../parties/party-constants';
import type { AverageUnit, Color, CuttingEntry, CuttingRowInput, PatternType, Size } from './cutting-constants';
import { AVERAGE_UNIT_LABELS, AVERAGE_UNIT_SHORT, fabricRequired } from './cutting-constants';

interface CuttingFormViewProps {
  entry: CuttingEntry | null;
  onDone: () => void;
  onCancel: () => void;
}

// Row keys only need to be unique within this form (crypto.randomUUID isn't available on the
// plain-http live site).
let rowKeySeq = 0;
const newRow = (): CuttingRowInput => ({ key: `row-${++rowKeySeq}`, colorId: '', photoUrl: null, quantities: {} });

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const toNumberOrEmpty = (value: string): number | '' => (value === '' ? '' : Number(value));
const rowTotal = (row: CuttingRowInput) => Object.values(row.quantities).reduce<number>((sum, q) => sum + (Number(q) || 0), 0);
const formatQty = (value: number) => value.toLocaleString('en-IN');

// Select + trailing icon button rendered as one joined control.
const joinedTrigger = 'min-w-0 flex-1 rounded-r-none';
const joinedButton = 'shrink-0 rounded-l-none border-l-0 text-muted-foreground shadow-sm hover:text-foreground';

const emptyHeader = () => ({
  date: localIsoDate(),
  entryTime: nowTime(),
  patternTypeId: '',
  isOnline: true,
  itemId: '',
  partyId: '',
  pieces: '' as number | '',
  averageValue: '' as number | '',
  averageUnit: 'KILOGRAM' as AverageUnit,
  remainingFabric: '' as number | '',
});

export const CuttingFormView = ({ entry, onDone, onCancel }: CuttingFormViewProps) => {
  const isEdit = Boolean(entry);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [patternManagerOpen, setPatternManagerOpen] = useState(false);
  const [colorManagerOpen, setColorManagerOpen] = useState(false);
  const [sizeManagerOpen, setSizeManagerOpen] = useState(false);
  const [partyFormOpen, setPartyFormOpen] = useState(false);
  const { selectedBook } = useSelectedBook();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canAddParty = isSuperAdmin || hasPermission('parties:create');
  const canManageMasters = isSuperAdmin || hasPermission('cutting:manage');

  const [form, setForm] = useState(emptyHeader);
  const [rows, setRows] = useState<CuttingRowInput[]>(() => [newRow()]);

  const { data: patternTypes } = useQuery({
    queryKey: ['pattern-types'],
    queryFn: () => apiClient.get<PatternType[]>('/cutting/pattern-types'),
  });
  const { data: colors } = useQuery({
    queryKey: ['colors'],
    queryFn: () => apiClient.get<Color[]>('/cutting/colors'),
  });
  const { data: sizes } = useQuery({
    queryKey: SIZES_QUERY_KEY,
    queryFn: () => apiClient.get<Size[]>('/cutting/sizes'),
  });
  const { data: items } = useQuery({
    queryKey: ['items', { page: 1, pageSize: 100 }],
    queryFn: () => apiClient.list<Item>('/items', { page: 1, pageSize: 100 }),
  });
  const { data: parties } = useQuery({
    queryKey: PARTIES_QUERY_KEY,
    queryFn: () => apiClient.get<Party[]>('/parties'),
  });
  const activePatternTypes = patternTypes?.filter((p) => p.isActive) ?? [];
  const activeItems = items?.items.filter((i) => i.isActive) ?? [];
  // Active options, plus whatever the entry being edited already uses (even if deactivated since).
  const usedColorIds = new Set(entry?.rows.map((r) => r.colorId));
  const colorOptions = colors?.filter((c) => c.isActive || usedColorIds.has(c.id)) ?? [];
  const partyOptions = parties?.filter((p) => p.isActive || p.id === entry?.partyId) ?? [];

  // Grid columns: active sizes in Size Master order, plus any inactive size this lot already uses.
  const sizeColumns = useMemo(() => {
    const used = new Set(entry?.rows.flatMap((r) => r.quantities.map((q) => q.sizeId)));
    return (sizes ?? []).filter((s) => s.isActive || used.has(s.id));
  }, [sizes, entry]);

  // Lot numbers are assigned by the server on save; this is only a preview of the next one.
  const { data: nextLot } = useQuery({
    queryKey: [...BOOKS_QUERY_KEY, selectedBook?.id, 'next-lot'],
    queryFn: () => apiClient.get<{ nextLotNumber: string }>(`/books/${selectedBook!.id}/next-lot`),
    enabled: !isEdit && Boolean(selectedBook),
  });

  useEffect(() => {
    setError(null);
    if (entry) {
      setForm({
        date: entry.date.slice(0, 10),
        entryTime: entry.entryTime ?? '',
        patternTypeId: entry.patternTypeId,
        isOnline: entry.isOnline,
        itemId: entry.itemId,
        partyId: entry.partyId,
        pieces: entry.pieces == null ? '' : Number(entry.pieces),
        averageValue: Number(entry.averageValue),
        averageUnit: entry.averageUnit,
        remainingFabric: entry.remainingFabric == null ? '' : Number(entry.remainingFabric),
      });
      setRows(
        entry.rows.length
          ? entry.rows.map((r) => ({
              ...newRow(),
              colorId: r.colorId,
              photoUrl: r.photoUrl,
              quantities: Object.fromEntries(r.quantities.map((q) => [q.sizeId, q.quantity])),
            }))
          : [newRow()],
      );
    } else {
      setForm(emptyHeader());
      setRows([newRow()]);
    }
  }, [entry]);

  const updateRow = (key: string, patch: Partial<CuttingRowInput>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const setQuantity = (key: string, sizeId: string, value: number | '') =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, quantities: { ...r.quantities, [sizeId]: value } } : r)));
  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  const sizeTotals = sizeColumns.map((size) => rows.reduce((sum, r) => sum + (Number(r.quantities[size.id]) || 0), 0));
  const grandTotal = sizeTotals.reduce((sum, t) => sum + t, 0);
  const fabric = fabricRequired(grandTotal, form.pieces, form.averageValue);
  const unit = AVERAGE_UNIT_SHORT[form.averageUnit];

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        date: form.date,
        entryTime: form.entryTime || null,
        patternTypeId: form.patternTypeId,
        isOnline: form.isOnline,
        itemId: form.itemId,
        partyId: form.partyId,
        pieces: form.pieces,
        averageValue: form.averageValue,
        averageUnit: form.averageUnit,
        remainingFabric: form.remainingFabric === '' ? null : form.remainingFabric,
        rows: rows.map((r) => ({
          colorId: r.colorId,
          photoUrl: r.photoUrl,
          quantities: sizeColumns.map((s) => ({ sizeId: s.id, quantity: Number(r.quantities[s.id]) || 0 })),
        })),
      };
      if (isEdit && entry) {
        return apiClient.patch(`/cutting/${entry.id}`, payload);
      }
      return apiClient.post('/cutting', { ...payload, bookId: selectedBook?.id });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cutting-entries'] });
      void queryClient.invalidateQueries({ queryKey: BOOKS_QUERY_KEY });
      onDone();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'),
  });

  const rowsValid = rows.length > 0 && rows.every((r) => r.colorId && rowTotal(r) > 0);
  const canSubmit = Boolean(
    (isEdit || selectedBook) &&
      form.date &&
      form.patternTypeId &&
      form.itemId &&
      form.partyId &&
      form.pieces !== '' &&
      form.averageValue !== '' &&
      rowsValid,
  );

  return (
    <PageLayout title="Cutting Entry" description="Fabric cutting lots — the starting point of production.">
      <Card>
        <CardContent className="p-3 sm:p-4">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {error ? <FormAlert tone="error">{error}</FormAlert> : null}
            {!isEdit && !selectedBook ? (
              <FormAlert tone="error">No active book is selected. Add a book in Book Master, then select it in the header.</FormAlert>
            ) : null}

            {/* Header — Lot / Date & time / Pattern · Online / Design / Party · PCs / Avg */}
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                label="Lot Number"
                htmlFor="cutting-lot"
                hint={
                  isEdit
                    ? `Book ${entry?.book.name} · cannot be changed`
                    : selectedBook
                      ? `Auto · book ${selectedBook.name} · assigned on save`
                      : 'Auto-generated from the selected book'
                }
              >
                <Input
                  id="cutting-lot"
                  readOnly
                  tabIndex={-1}
                  className="numeric font-semibold"
                  value={isEdit ? (entry?.lotNumber ?? '') : (nextLot?.nextLotNumber ?? '')}
                  placeholder="Auto"
                />
              </FormField>

              <FormField label="Date & Time" required htmlFor="cutting-date">
                <div className="flex gap-2">
                  <DatePicker
                    id="cutting-date"
                    required
                    className="min-w-0 flex-1"
                    value={form.date}
                    onChange={(date) => setForm((f) => ({ ...f, date }))}
                  />
                  <Input
                    type="time"
                    aria-label="Time"
                    className="w-[7.5rem] shrink-0"
                    value={form.entryTime}
                    onChange={(e) => setForm((f) => ({ ...f, entryTime: e.target.value }))}
                  />
                </div>
              </FormField>

              <FormField label="Pattern Type" required htmlFor="cutting-pattern">
                <div className="flex">
                  <Select value={form.patternTypeId} onValueChange={(v) => setForm((f) => ({ ...f, patternTypeId: v }))}>
                    <SelectTrigger id="cutting-pattern" className={joinedTrigger}>
                      <SelectValue placeholder="Select pattern type" />
                    </SelectTrigger>
                    <SelectContent>
                      {activePatternTypes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={joinedButton}
                    aria-label="Manage pattern types"
                    title="Manage pattern types"
                    onClick={() => setPatternManagerOpen(true)}
                  >
                    <Settings2 />
                  </Button>
                </div>
              </FormField>

              <FormField label="Online / Offline" required>
                <div role="radiogroup" aria-label="Online / Offline" className="flex h-9 items-center gap-5">
                  {[
                    { label: 'Online', value: true },
                    { label: 'Offline', value: false },
                  ].map((option) => (
                    <label key={option.label} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="isOnline"
                        className="size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-input bg-card transition-[border-color,border-width] duration-150 checked:border-[5px] checked:border-primary hover:border-primary/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
                        checked={form.isOnline === option.value}
                        onChange={() => setForm((f) => ({ ...f, isOnline: option.value }))}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </FormField>

              <FormField label="Design" required htmlFor="cutting-item">
                <Select value={form.itemId} onValueChange={(v) => setForm((f) => ({ ...f, itemId: v }))}>
                  <SelectTrigger id="cutting-item">
                    <SelectValue placeholder="Select design" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.itemName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Party" required htmlFor="cutting-party">
                <div className="flex">
                  <Select value={form.partyId} onValueChange={(v) => setForm((f) => ({ ...f, partyId: v }))}>
                    <SelectTrigger id="cutting-party" className={canAddParty ? joinedTrigger : undefined}>
                      <SelectValue placeholder={partyOptions.length ? 'Select party' : 'No parties yet'} />
                    </SelectTrigger>
                    <SelectContent>
                      {partyOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.isActive ? p.name : `${p.name} (inactive)`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {canAddParty ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={joinedButton}
                      aria-label="Add party"
                      title="Add party"
                      onClick={() => setPartyFormOpen(true)}
                    >
                      <UserPlus />
                    </Button>
                  ) : null}
                </div>
              </FormField>

              <FormField label="PCs" required htmlFor="cutting-pieces" hint="Pieces that use the Avg fabric">
                <Input
                  id="cutting-pieces"
                  type="number"
                  min={0.01}
                  step="0.01"
                  inputMode="decimal"
                  required
                  className="numeric text-right"
                  value={form.pieces}
                  onChange={(e) => setForm((f) => ({ ...f, pieces: toNumberOrEmpty(e.target.value) }))}
                />
              </FormField>

              <FormField label="Avg" required htmlFor="cutting-average" hint="Fabric used for those PCs">
                <div className="flex">
                  <Input
                    id="cutting-average"
                    type="number"
                    step="0.001"
                    min={0}
                    inputMode="decimal"
                    required
                    className="numeric min-w-0 flex-1 rounded-r-none text-right"
                    value={form.averageValue}
                    onChange={(e) => setForm((f) => ({ ...f, averageValue: toNumberOrEmpty(e.target.value) }))}
                  />
                  <Select
                    value={form.averageUnit}
                    onValueChange={(v) => setForm((f) => ({ ...f, averageUnit: v as AverageUnit }))}
                  >
                    <SelectTrigger aria-label="Average unit" className="w-28 shrink-0 rounded-l-none border-l-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(AVERAGE_UNIT_LABELS) as [AverageUnit, string][]).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </FormField>

              <FormField label="Remaining Fabric" htmlFor="cutting-remaining" hint="Fabric left after cutting (optional)">
                <div className="flex">
                  <Input
                    id="cutting-remaining"
                    type="number"
                    step="0.001"
                    min={0}
                    inputMode="decimal"
                    className="numeric min-w-0 flex-1 rounded-r-none text-right"
                    value={form.remainingFabric}
                    onChange={(e) => setForm((f) => ({ ...f, remainingFabric: toNumberOrEmpty(e.target.value) }))}
                  />
                  <span className="flex w-28 shrink-0 items-center rounded-r-md border border-l-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                    {AVERAGE_UNIT_LABELS[form.averageUnit]}
                  </span>
                </div>
              </FormField>
            </div>

            {/* Production — one row per colour, pieces per size */}
            <section aria-labelledby="cutting-production-heading" className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="cutting-production-heading" className="text-sm font-semibold">
                  Production
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {rows.length} {rows.length === 1 ? 'colour' : 'colours'}
                  </span>
                </h3>
                {canManageMasters ? (
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setColorManagerOpen(true)}>
                      <Palette />
                      Colours
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSizeManagerOpen(true)}>
                      <Ruler />
                      Sizes
                    </Button>
                  </div>
                ) : null}
              </div>

              {!sizeColumns.length ? (
                <FormAlert tone="error">No sizes in Size Master. Use “Sizes” above to add them.</FormAlert>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="data-table w-full min-w-max text-sm">
                    <thead className="border-b border-border text-2xs uppercase tracking-wider">
                      <tr>
                        <th className="w-14 px-2 py-2 text-left">Photo</th>
                        <th className="w-52 min-w-[11rem] px-2 py-2 text-left">Colour</th>
                        {sizeColumns.map((size) => (
                          <th key={size.id} className="min-w-[4.5rem] px-1.5 py-1.5 text-center normal-case tracking-normal">
                            <span className="block text-xs font-semibold">{size.name}</span>
                            {size.detail ? <span className="block text-2xs font-normal opacity-80">{size.detail}</span> : null}
                          </th>
                        ))}
                        <th className="w-20 px-2 py-2 text-right">Total</th>
                        <th className="w-10 px-1 py-2">
                          <span className="sr-only">Remove</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={row.key} className="border-b border-border last:border-0">
                          <td className="px-2 py-1.5">
                            <RowPhotoPicker
                              label={`cloth photo for colour row ${index + 1}`}
                              value={row.photoUrl}
                              onChange={(photoUrl) => updateRow(row.key, { photoUrl })}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Select value={row.colorId} onValueChange={(v) => updateRow(row.key, { colorId: v })}>
                              <SelectTrigger aria-label={`Colour for row ${index + 1}`} className="h-9">
                                <SelectValue placeholder="Select colour" />
                              </SelectTrigger>
                              <SelectContent>
                                {colorOptions.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          {sizeColumns.map((size) => (
                            <td key={size.id} className="px-1 py-1.5 text-center">
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                inputMode="numeric"
                                aria-label={`Row ${index + 1}, size ${size.name}`}
                                className="numeric mx-auto h-9 w-[4.75rem] px-2 text-center"
                                value={row.quantities[size.id] ?? ''}
                                onChange={(e) => setQuantity(row.key, size.id, toNumberOrEmpty(e.target.value))}
                              />
                            </td>
                          ))}
                          <td className="numeric px-2 py-1.5 text-right font-semibold">{formatQty(rowTotal(row))}</td>
                          <td className="px-1 py-1.5 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 hover:text-destructive [&_svg]:size-3.5"
                              aria-label={`Remove colour row ${index + 1}`}
                              disabled={rows.length === 1}
                              onClick={() => removeRow(row.key)}
                            >
                              <Trash2 />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border">
                        <td colSpan={2} className="px-2 py-2 text-left">
                          Total
                        </td>
                        {sizeTotals.map((total, i) => (
                          <td key={sizeColumns[i].id} className="numeric px-2 py-2 text-center">
                            {total ? formatQty(total) : '—'}
                          </td>
                        ))}
                        <td className="numeric px-2 py-2 text-right">{formatQty(grandTotal)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => setRows((prev) => [...prev, newRow()])}>
                  <Plus />
                  Add Colour
                </Button>

                {/* Total fabric = total pieces ÷ PCs × Avg */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <span>
                    <span className="numeric font-semibold text-foreground">{formatQty(grandTotal)}</span> pcs
                  </span>
                  <span aria-hidden>÷</span>
                  <span>
                    PCs <span className="numeric font-semibold text-foreground">{form.pieces || '—'}</span>
                  </span>
                  <span aria-hidden>×</span>
                  <span>
                    Avg{' '}
                    <span className="numeric font-semibold text-foreground">
                      {form.averageValue === '' ? '—' : `${form.averageValue} ${unit}`}
                    </span>
                  </span>
                  <span aria-hidden>=</span>
                  <span className="text-foreground">
                    Total Kapda{' '}
                    <output aria-live="polite" className={cn('numeric text-base font-semibold', fabric !== null && 'text-primary')}>
                      {fabric === null ? '—' : `${fabric.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${unit}`}
                    </output>
                  </span>
                </div>
              </div>
            </section>

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

      <PatternTypeManagerDialog open={patternManagerOpen} onOpenChange={setPatternManagerOpen} />
      <ColorManagerDialog open={colorManagerOpen} onOpenChange={setColorManagerOpen} />
      <SizeManagerDialog open={sizeManagerOpen} onOpenChange={setSizeManagerOpen} />
      <PartyFormDialog
        open={partyFormOpen}
        onOpenChange={setPartyFormOpen}
        onSaved={(party) => setForm((f) => ({ ...f, partyId: party.id }))}
      />
    </PageLayout>
  );
};
