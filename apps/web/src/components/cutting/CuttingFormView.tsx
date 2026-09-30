import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings2, Plus, Trash2 } from 'lucide-react';
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
import type { Item } from '../items/item-constants';
import type { AverageUnit, Color, CuttingEntry, CuttingEntryLineInput, PatternType } from './cutting-constants';
import { AVERAGE_UNIT_LABELS } from './cutting-constants';

interface CuttingFormViewProps {
  entry: CuttingEntry | null;
  onDone: () => void;
  onCancel: () => void;
}

const emptyLine: CuttingEntryLineInput = { size: '', quantity: '', rate: '' };

const toDateInputValue = (value: string) => value.slice(0, 10);

const lineTotal = (line: CuttingEntryLineInput) =>
  typeof line.quantity === 'number' && typeof line.rate === 'number' ? line.quantity * line.rate : 0;

const formatAmount = (value: number) =>
  value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const toNumberOrEmpty = (value: string): number | '' => (value === '' ? '' : Number(value));

// Shared column template for the size header row and each size row (sm and up). Below sm each
// row collapses to a stacked mini-card: Size + delete on top, Quantity / Rate / Total beneath.
const SIZE_GRID =
  'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2rem] gap-x-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2rem]';

// Select + trailing icon button rendered as one joined control.
const joinedTrigger = 'min-w-0 flex-1 rounded-r-none';
const joinedButton = 'shrink-0 rounded-l-none border-l-0 text-muted-foreground shadow-sm hover:text-foreground';

export const CuttingFormView = ({ entry, onDone, onCancel }: CuttingFormViewProps) => {
  const isEdit = Boolean(entry);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [patternManagerOpen, setPatternManagerOpen] = useState(false);
  const [colorManagerOpen, setColorManagerOpen] = useState(false);
  // Index of a just-added size row, so its Size input takes focus when it mounts.
  const [focusLineIndex, setFocusLineIndex] = useState<number | null>(null);

  const [form, setForm] = useState({
    lotNumber: '',
    date: '',
    patternTypeId: '',
    isOnline: true,
    itemId: '',
    partyName: '',
    averageValue: '' as number | '',
    averageUnit: 'KILOGRAM' as AverageUnit,
    colorId: '',
  });
  const [lines, setLines] = useState<CuttingEntryLineInput[]>([{ ...emptyLine }]);

  const { data: patternTypes } = useQuery({
    queryKey: ['pattern-types'],
    queryFn: () => apiClient.get<PatternType[]>('/cutting/pattern-types'),
  });
  const { data: colors } = useQuery({
    queryKey: ['colors'],
    queryFn: () => apiClient.get<Color[]>('/cutting/colors'),
  });
  const { data: items } = useQuery({
    queryKey: ['items', { page: 1, pageSize: 100 }],
    queryFn: () => apiClient.list<Item>('/items', { page: 1, pageSize: 100 }),
  });
  const activePatternTypes = patternTypes?.filter((p) => p.isActive) ?? [];
  const activeColors = colors?.filter((c) => c.isActive) ?? [];
  const activeItems = items?.items.filter((i) => i.isActive) ?? [];

  useEffect(() => {
    setError(null);
    setFocusLineIndex(null);
    if (entry) {
      setForm({
        lotNumber: entry.lotNumber,
        date: toDateInputValue(entry.date),
        patternTypeId: entry.patternTypeId,
        isOnline: entry.isOnline,
        itemId: entry.itemId,
        partyName: entry.partyName,
        averageValue: Number(entry.averageValue),
        averageUnit: entry.averageUnit,
        colorId: entry.colorId,
      });
      setLines(entry.lines.map((l) => ({ size: l.size, quantity: l.quantity, rate: Number(l.rate) })));
    } else {
      setForm({
        lotNumber: '',
        date: '',
        patternTypeId: '',
        isOnline: true,
        itemId: '',
        partyName: '',
        averageValue: '',
        averageUnit: 'KILOGRAM',
        colorId: '',
      });
      setLines([{ ...emptyLine }]);
    }
  }, [entry]);

  const grandTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const totalQuantity = lines.reduce((sum, l) => sum + (typeof l.quantity === 'number' ? l.quantity : 0), 0);

  const updateLine = (index: number, patch: Partial<CuttingEntryLineInput>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const addLine = () => {
    setFocusLineIndex(lines.length);
    setLines((prev) => [...prev, { ...emptyLine }]);
  };
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        date: form.date,
        patternTypeId: form.patternTypeId,
        isOnline: form.isOnline,
        itemId: form.itemId,
        partyName: form.partyName,
        averageValue: form.averageValue,
        averageUnit: form.averageUnit,
        colorId: form.colorId,
        lines: lines.map((l) => ({ size: l.size, quantity: l.quantity, rate: l.rate })),
      };
      if (isEdit && entry) {
        return apiClient.patch(`/cutting/${entry.id}`, payload);
      }
      return apiClient.post('/cutting', { ...payload, lotNumber: form.lotNumber });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cutting-entries'] });
      onDone();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'),
  });

  const canSubmit =
    form.lotNumber &&
    form.date &&
    form.patternTypeId &&
    form.itemId &&
    form.partyName &&
    form.averageValue !== '' &&
    form.colorId &&
    lines.length > 0 &&
    lines.every((l) => l.size && l.quantity !== '' && l.rate !== '');

  return (
    <PageLayout title="Cutting Entry" description="Fabric cutting lots — the starting point of production.">
      <Card>
        <CardContent className="p-4 sm:p-5">
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {error ? <FormAlert tone="error">{error}</FormAlert> : null}

            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <FormField
                label="Lot Number"
                required
                htmlFor="cutting-lot"
                hint={isEdit ? 'Cannot be changed after creation.' : undefined}
              >
                <Input
                  id="cutting-lot"
                  required
                  disabled={isEdit}
                  autoFocus={!isEdit}
                  autoComplete="off"
                  value={form.lotNumber}
                  onChange={(e) => setForm((f) => ({ ...f, lotNumber: e.target.value }))}
                />
              </FormField>

              <FormField label="Date" required htmlFor="cutting-date">
                <DatePicker
                  id="cutting-date"
                  required
                  value={form.date}
                  onChange={(date) => setForm((f) => ({ ...f, date }))}
                />
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
                        className="size-4 cursor-pointer accent-primary"
                        checked={form.isOnline === option.value}
                        onChange={() => setForm((f) => ({ ...f, isOnline: option.value }))}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </FormField>

              <FormField label="Item" required htmlFor="cutting-item">
                <Select value={form.itemId} onValueChange={(v) => setForm((f) => ({ ...f, itemId: v }))}>
                  <SelectTrigger id="cutting-item">
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
              </FormField>

              <FormField label="Color" required htmlFor="cutting-color">
                <div className="flex">
                  <Select value={form.colorId} onValueChange={(v) => setForm((f) => ({ ...f, colorId: v }))}>
                    <SelectTrigger id="cutting-color" className={joinedTrigger}>
                      <SelectValue placeholder="Select color" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeColors.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={joinedButton}
                    aria-label="Manage colors"
                    title="Manage colors"
                    onClick={() => setColorManagerOpen(true)}
                  >
                    <Settings2 />
                  </Button>
                </div>
              </FormField>

              {/* Spans two columns on desktop so the last row has no empty cell. */}
              <FormField label="Party Name" required htmlFor="cutting-party" className="lg:col-span-2">
                <Input
                  id="cutting-party"
                  required
                  value={form.partyName}
                  onChange={(e) => setForm((f) => ({ ...f, partyName: e.target.value }))}
                />
              </FormField>

              <FormField label="Average" required htmlFor="cutting-average">
                <div className="flex">
                  <Input
                    id="cutting-average"
                    type="number"
                    step="0.01"
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
            </div>

            <section aria-labelledby="cutting-sizes-heading" className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 id="cutting-sizes-heading" className="text-sm font-semibold">
                  Sizes
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{lines.length}</span>
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus />
                  Add Size
                </Button>
              </div>

              <div className={`${SIZE_GRID} hidden border-b border-border pb-1.5 section-label sm:grid`}>
                <span>Size</span>
                <span className="text-right">Quantity</span>
                <span className="text-right">Rate</span>
                <span className="text-right">Total</span>
                <span className="sr-only">Remove</span>
              </div>

              <div className="space-y-2 sm:space-y-1.5">
                {lines.map((line, index) => (
                  <div
                    key={index}
                    className={`${SIZE_GRID} items-end gap-y-2 rounded-md border border-border p-2 sm:items-center sm:rounded-none sm:border-0 sm:p-0`}
                  >
                    <label className="col-span-3 space-y-1 sm:col-span-1 sm:space-y-0">
                      <span className="text-2xs text-muted-foreground sm:sr-only">Size {index + 1}</span>
                      <Input
                        required
                        className="h-8"
                        autoFocus={index === focusLineIndex}
                        value={line.size}
                        onChange={(e) => updateLine(index, { size: e.target.value })}
                      />
                    </label>
                    <label className="space-y-1 sm:space-y-0">
                      <span className="text-2xs text-muted-foreground sm:sr-only">Quantity</span>
                      <Input
                        required
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        className="numeric h-8 text-right"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: toNumberOrEmpty(e.target.value) })}
                      />
                    </label>
                    <label className="space-y-1 sm:space-y-0">
                      <span className="text-2xs text-muted-foreground sm:sr-only">Rate</span>
                      <Input
                        required
                        type="number"
                        step="0.01"
                        min={0}
                        inputMode="decimal"
                        className="numeric h-8 text-right"
                        value={line.rate}
                        onChange={(e) => updateLine(index, { rate: toNumberOrEmpty(e.target.value) })}
                      />
                    </label>
                    <div className="space-y-1 text-right sm:space-y-0">
                      <span className="block text-2xs text-muted-foreground sm:hidden">Total</span>
                      <output className="numeric flex h-8 items-center justify-end pr-1 text-muted-foreground">
                        {formatAmount(lineTotal(line))}
                      </output>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-start-4 row-start-1 size-8 self-end text-muted-foreground hover:text-destructive sm:col-start-5 sm:self-center [&_svg]:size-3.5"
                      aria-label={`Remove size ${index + 1}`}
                      disabled={lines.length === 1}
                      onClick={() => removeLine(index)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-4 rounded-md bg-muted px-3 py-2.5">
                <span className="text-xs text-muted-foreground">
                  {lines.length} {lines.length === 1 ? 'size' : 'sizes'} · {totalQuantity.toLocaleString('en-IN')} pcs
                </span>
                <div className="text-right">
                  <div className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">Total</div>
                  <output aria-live="polite" className="numeric block text-base font-semibold text-foreground">
                    ₹{formatAmount(grandTotal)}
                  </output>
                </div>
              </div>
            </section>

            <div className="flex gap-2 border-t border-border pt-4 sm:justify-end">
              <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1 sm:min-w-24 sm:flex-none" loading={mutation.isPending} disabled={!canSubmit}>
                Save
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <PatternTypeManagerDialog open={patternManagerOpen} onOpenChange={setPatternManagerOpen} />
      <ColorManagerDialog open={colorManagerOpen} onOpenChange={setColorManagerOpen} />
    </PageLayout>
  );
};
