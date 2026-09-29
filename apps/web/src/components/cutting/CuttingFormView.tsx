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

export const CuttingFormView = ({ entry, onDone, onCancel }: CuttingFormViewProps) => {
  const isEdit = Boolean(entry);
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [patternManagerOpen, setPatternManagerOpen] = useState(false);
  const [colorManagerOpen, setColorManagerOpen] = useState(false);

  const [form, setForm] = useState({
    lotNumber: '',
    date: '',
    patternTypeId: '',
    characterId: '',
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
    if (entry) {
      setForm({
        lotNumber: entry.lotNumber,
        date: toDateInputValue(entry.date),
        patternTypeId: entry.patternTypeId,
        characterId: entry.characterId,
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
        characterId: '',
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

  const updateLine = (index: number, patch: Partial<CuttingEntryLineInput>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const addLine = () => setLines((prev) => [...prev, { ...emptyLine }]);
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        date: form.date,
        patternTypeId: form.patternTypeId,
        characterId: form.characterId,
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
    form.characterId &&
    form.itemId &&
    form.partyName &&
    form.averageValue !== '' &&
    form.colorId &&
    lines.length > 0 &&
    lines.every((l) => l.size && l.quantity !== '' && l.rate !== '');

  return (
    <PageLayout title="Cutting Entry" description="Fabric cutting lots — the starting point of production.">
      <Card>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            {error ? <FormAlert tone="error">{error}</FormAlert> : null}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Lot Number" required hint={isEdit ? 'Cannot be changed after creation.' : undefined}>
                <Input
                  required
                  disabled={isEdit}
                  autoFocus={!isEdit}
                  value={form.lotNumber}
                  onChange={(e) => setForm((f) => ({ ...f, lotNumber: e.target.value }))}
                />
              </FormField>

              <FormField label="Date" required>
                <Input type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              </FormField>

              <FormField label="Pattern Type" required>
                <div className="flex items-center gap-2">
                  <Select
                    value={form.patternTypeId}
                    onValueChange={(v) => setForm((f) => ({ ...f, patternTypeId: v }))}
                  >
                    <SelectTrigger className="flex-1">
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
                  <Button type="button" variant="outline" size="icon" onClick={() => setPatternManagerOpen(true)}>
                    <Settings2 />
                  </Button>
                </div>
              </FormField>

              <FormField label="Character" required hint="Same pattern-type list, used as a second classification.">
                <div className="flex items-center gap-2">
                  <Select value={form.characterId} onValueChange={(v) => setForm((f) => ({ ...f, characterId: v }))}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select character" />
                    </SelectTrigger>
                    <SelectContent>
                      {activePatternTypes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => setPatternManagerOpen(true)}>
                    <Settings2 />
                  </Button>
                </div>
              </FormField>

              <FormField label="Online / Offline" required>
                <div className="flex h-9 items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="isOnline"
                      checked={form.isOnline}
                      onChange={() => setForm((f) => ({ ...f, isOnline: true }))}
                    />
                    Online
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name="isOnline"
                      checked={!form.isOnline}
                      onChange={() => setForm((f) => ({ ...f, isOnline: false }))}
                    />
                    Offline
                  </label>
                </div>
              </FormField>

              <FormField label="Item" required>
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
              </FormField>

              <FormField label="Party Name" required>
                <Input
                  required
                  value={form.partyName}
                  onChange={(e) => setForm((f) => ({ ...f, partyName: e.target.value }))}
                />
              </FormField>

              <FormField label="Average" required>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    required
                    className="numeric"
                    value={form.averageValue}
                    onChange={(e) => setForm((f) => ({ ...f, averageValue: e.target.value === '' ? '' : Number(e.target.value) }))}
                  />
                  <Select
                    value={form.averageUnit}
                    onValueChange={(v) => setForm((f) => ({ ...f, averageUnit: v as AverageUnit }))}
                  >
                    <SelectTrigger className="w-32">
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

              <FormField label="Color" required>
                <div className="flex items-center gap-2">
                  <Select value={form.colorId} onValueChange={(v) => setForm((f) => ({ ...f, colorId: v }))}>
                    <SelectTrigger className="flex-1">
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
                  <Button type="button" variant="outline" size="icon" onClick={() => setColorManagerOpen(true)}>
                    <Settings2 />
                  </Button>
                </div>
              </FormField>
            </div>

            <div className="border-t border-border pt-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Sizes</h3>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus />
                  Add size
                </Button>
              </div>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Size</th>
                      <th className="px-3 py-2 font-medium">Quantity</th>
                      <th className="px-3 py-2 font-medium">Rate</th>
                      <th className="px-3 py-2 font-medium">Total</th>
                      <th className="px-3 py-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={index} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <Input
                            required
                            className="h-8"
                            value={line.size}
                            onChange={(e) => updateLine(index, { size: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            required
                            type="number"
                            className="numeric h-8"
                            value={line.quantity}
                            onChange={(e) => updateLine(index, { quantity: e.target.value === '' ? '' : Number(e.target.value) })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            required
                            type="number"
                            step="0.01"
                            className="numeric h-8"
                            value={line.rate}
                            onChange={(e) => updateLine(index, { rate: e.target.value === '' ? '' : Number(e.target.value) })}
                          />
                        </td>
                        <td className="numeric px-3 py-2 text-muted-foreground">{lineTotal(line).toFixed(2)}</td>
                        <td className="px-2 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={lines.length === 1}
                            onClick={() => removeLine(index)}
                          >
                            <Trash2 />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <FormField label="Total" className="mt-4 max-w-xs">
                <Input disabled className="numeric" value={grandTotal.toFixed(2)} />
              </FormField>
            </div>

            <div className="flex items-center gap-2 border-t border-border pt-4">
              <Button type="submit" loading={mutation.isPending} disabled={!canSubmit}>
                Save
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
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
