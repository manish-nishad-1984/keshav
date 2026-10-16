import { Boxes, Hourglass, History, PackageCheck, PencilLine, type LucideIcon } from 'lucide-react';
import { QtyChip, QtyLegend, QtyRowLabel, type QtyTone } from '../ui/qty-tone';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { LoadingState } from '../ui/loading-state';
import { cn } from '../../lib/utils';
import type { ProductionAvailability } from './production-entry-constants';
import { cellKey } from './production-entry-constants';
import { ColourThumb } from '../common/ColourThumb';

// The grid's summary rows, in order; their colours also tint the cells (see qty-tone).
const LEGEND = [
  { tone: 'total', icon: Boxes, label: 'Given to karigar' },
  { tone: 'earlier', icon: History, label: 'Handed in earlier' },
  { tone: 'now', icon: PencilLine, label: 'Handing in now' },
  { tone: 'pending', icon: Hourglass, label: 'Still with karigar' },
] as const satisfies readonly { tone: QtyTone; icon: LucideIcon; label: string }[];

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

interface ProductionSizeGridProps {
  availability: ProductionAvailability | undefined;
  loading: boolean;
  // Why there is no grid yet ("Select a karigar and lot"), when nothing is loaded.
  emptyText: string;
  // Pieces handed in now, keyed "colorId:sizeId".
  values: Record<string, number | ''>;
  onChange: (values: Record<string, number | ''>) => void;
}

const toNumberOrEmpty = (value: string): number | '' => (value === '' ? '' : Number(value));

export const ProductionSizeGrid = ({ availability, loading, emptyText, values, onChange }: ProductionSizeGridProps) => {
  const sizes = availability?.sizes ?? [];
  // Only colours this karigar actually took.
  const colors = availability?.colors.filter((c) => c.cells.some((cell) => cell.given > 0)) ?? [];
  const qty = (key: string) => Number(values[key]) || 0;

  const rowTotal = (colorId: string) => sum(sizes.map((s) => qty(cellKey(colorId, s.id))));
  const column = (sizeId: string, pick: 'given' | 'handedIn' | 'remaining') =>
    sum(colors.map((c) => c.cells.find((cell) => cell.sizeId === sizeId)?.[pick] ?? 0));
  const nowColumn = (sizeId: string) => sum(colors.map((c) => qty(cellKey(c.colorId, sizeId))));
  const totalOf = (pick: 'given' | 'handedIn' | 'remaining') => sum(sizes.map((s) => column(s.id, pick)));
  const totalNow = sum(sizes.map((s) => nowColumn(s.id)));

  const handInAll = () =>
    onChange(
      Object.fromEntries(
        colors.flatMap((c) => c.cells.filter((cell) => cell.remaining > 0).map((cell) => [cellKey(c.colorId, cell.sizeId), cell.remaining])),
      ),
    );

  const overCells = colors.flatMap((c) => c.cells.filter((cell) => qty(cellKey(c.colorId, cell.sizeId)) > cell.remaining));

  return (
    <section aria-labelledby="pe-sizes-heading" className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 id="pe-sizes-heading" className="text-sm font-semibold">
            Pieces handed in, size by size
          </h3>
          <QtyLegend items={LEGEND} />
        </div>
        {colors.length ? (
          <Button type="button" variant="ghost" size="sm" onClick={handInAll} disabled={totalOf('remaining') === 0}>
            <PackageCheck />
            Fill all pending
          </Button>
        ) : null}
      </div>

      {loading && !availability ? (
        <LoadingState />
      ) : !colors.length ? (
        <div className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">{emptyText}</div>
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
                return (
                  <tr key={color.colorId} className="border-b border-border last:border-0">
                    <td className="px-2 py-1.5">
                      <ColourThumb photoUrl={color.photoUrl} name={color.name} size={48} />
                    </td>
                    <td className="px-2 py-1.5 font-medium">{color.name}</td>
                    {color.cells.map((cell) => {
                      const key = cellKey(color.colorId, cell.sizeId);
                      const over = qty(key) > cell.remaining;
                      const size = sizes.find((s) => s.id === cell.sizeId);
                      return (
                        <td key={cell.sizeId} className="px-1 py-1.5 text-center align-top">
                          {cell.given === 0 ? (
                            <span className="inline-block pt-2 text-muted-foreground">—</span>
                          ) : (
                            <>
                              <Input
                                type="number"
                                min={0}
                                max={cell.remaining}
                                step={1}
                                inputMode="numeric"
                                aria-label={`${color.name}, size ${size?.name ?? ''}, ${cell.remaining} still with karigar`}
                                aria-invalid={over || undefined}
                                disabled={cell.remaining === 0 && !qty(key)}
                                className={cn(
                                  'numeric mx-auto h-10 w-20 px-2 text-center text-base font-semibold',
                                  qty(key) > 0 && 'border-primary/50 bg-primary/10 text-primary',
                                  over && 'border-destructive bg-destructive/10 text-destructive focus-visible:ring-destructive/20',
                                )}
                                value={values[key] ?? ''}
                                onChange={(e) => onChange({ ...values, [key]: toNumberOrEmpty(e.target.value) })}
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
            {/* Given, handed in earlier, handing in now and what will still be with the karigar */}
            <tfoot className="text-sm">
              {(
                [
                  { ...LEGEND[0], value: (id: string) => column(id, 'given'), total: totalOf('given') },
                  { ...LEGEND[1], value: (id: string) => column(id, 'handedIn'), total: totalOf('handedIn') },
                  { ...LEGEND[2], value: nowColumn, total: totalNow },
                  { ...LEGEND[3], value: (id: string) => column(id, 'remaining') - nowColumn(id), total: totalOf('remaining') - totalNow },
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
        <p role="alert" className="text-sm font-medium text-destructive">
          Some sizes have more pieces than the karigar has (shown in red). Reduce them to save.
        </p>
      ) : null}
    </section>
  );
};

/** Total typed into the grid, plus whether any cell is over its limit — for the page's save check. */
export const summarizeGrid = (availability: ProductionAvailability | undefined, values: Record<string, number | ''>) => {
  let total = 0;
  let over = false;
  for (const color of availability?.colors ?? []) {
    for (const cell of color.cells) {
      const q = Number(values[cellKey(color.colorId, cell.sizeId)]) || 0;
      total += q;
      if (q > cell.remaining) over = true;
    }
  }
  return { total, over };
};
