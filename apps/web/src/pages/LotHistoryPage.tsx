import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Hourglass, ImageOff, Package, Scissors, Truck, Users } from 'lucide-react';
import { QTY_TONE_CLASSES, QtyChip, type QtyTone } from '../components/ui/qty-tone';
import { cn } from '../lib/utils';
import { apiClient, ApiRequestError, resolvePhotoUrl } from '../lib/api-client';
import { PageLayout } from '../components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { FormAlert } from '../components/ui/form-alert';
import { LoadingState } from '../components/ui/loading-state';
import { useSelectedBook } from '../hooks/use-selected-book';
import { formatDate } from '../lib/date';
import { formatMoney } from '../lib/format';

type Stage = 'not_given' | 'with_karigars' | 'in_production' | 'ready' | 'delivered' | 'closed';
interface Cell {
  color: string;
  size: string;
  quantity: number;
}

interface LotHistory {
  lot: {
    id: string;
    lotNumber: string;
    bookName: string;
    date: string;
    entryTime: string | null;
    itemName: string;
    itemPhotoUrl: string | null;
    partyName: string;
    patternType: string;
    isOnline: boolean;
    pieces: number | null;
    remainingFabric: number | null;
    averageValue: number | null;
    averageUnit: string;
    totalQuantity: number;
    closedAt: string | null;
    closeReason: string | null;
    closeNote: string | null;
    closedShortage: number | null;
    closedAlteration: number | null;
  };
  stage: Stage;
  summary: {
    cut: number;
    distributed: number;
    notGiven: number;
    produced: number;
    alteration: number;
    withKarigars: number;
    delivered: number;
    readyToDeliver: number;
    labourCost: number;
  };
  sizes: { id: string; name: string; detail: string | null }[];
  cutGrid: { color: string; photoUrl: string | null; cells: Record<string, number>; total: number }[];
  karigars: { karigarId: string; name: string; workType: string; given: number; handedIn: number; alteration: number; pending: number }[];
  distributions: { id: string; date: string; entryTime: string | null; karigar: string; workType: string; total: number; remarks: string | null; cells: Cell[] }[];
  production: {
    id: string;
    date: string;
    entryTime: string | null;
    karigar: string;
    quantity: number;
    alteration: number;
    rate: number | null;
    total: number;
    overlock: { karigar: string; rate: number | null; total: number } | null;
    flatlock: { karigar: string; rate: number | null; total: number } | null;
    remarks: string | null;
    cells: Cell[];
  }[];
  accessories: {
    id: string;
    type: 'ISSUE' | 'RETURN';
    date: string;
    entryTime: string | null;
    karigar: string;
    remarks: string | null;
    lines: { name: string; unit: string; quantity: number }[];
  }[];
  deliveries: { id: string; challanNumber: number; billNumber: string | null; date: string; entryTime: string | null; total: number; remarks: string | null; cells: Cell[] }[];
}

const STAGES: Record<Stage, { label: string; variant: 'muted' | 'warning' | 'info' | 'progress' | 'success' | 'neutral' }> = {
  not_given: { label: 'Cut — not given yet', variant: 'muted' },
  with_karigars: { label: 'With karigars', variant: 'warning' },
  in_production: { label: 'Production running', variant: 'info' },
  ready: { label: 'Ready to deliver', variant: 'progress' },
  delivered: { label: 'Delivered', variant: 'success' },
  closed: { label: 'Closed', variant: 'neutral' },
};

const CLOSE_REASONS: Record<string, string> = { DAMAGED: 'Damaged', SHORTAGE: 'Shortage', RETURNED_BY_PARTY: 'Returned by party' };

const n = (value: number) => value.toLocaleString('en-IN');
const when = (date: string, time: string | null) => `${formatDate(date.slice(0, 10))}${time ? ` ${time}` : ''}`;

// "Red: M 20, L 15 · Blue: M 5" — a compact colour/size breakdown of one entry.
const CellList = ({ cells }: { cells: Cell[] }) => {
  const byColor = new Map<string, Cell[]>();
  for (const c of cells) byColor.set(c.color, [...(byColor.get(c.color) ?? []), c]);
  if (!byColor.size) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-0.5">
      {[...byColor.entries()].map(([color, list]) => (
        <p key={color} className="text-xs">
          <span className="font-medium">{color}:</span>{' '}
          <span className="numeric text-muted-foreground">{list.map((c) => `${c.size} ${n(c.quantity)}`).join(', ')}</span>
        </p>
      ))}
    </div>
  );
};

const SummaryTile = ({ icon: Icon, label, value, tone }: { icon: typeof Scissors; label: string; value: number; tone: QtyTone }) => (
  <div className={cn('flex items-center gap-3 rounded-lg border px-3 py-3', QTY_TONE_CLASSES[tone].chip)}>
    <Icon className="size-7 shrink-0" />
    <div className="min-w-0">
      <p className="truncate text-xs font-medium">{label}</p>
      <p className="numeric text-2xl font-bold leading-tight">
        {n(value)} <span className="text-xs font-normal opacity-80">pcs</span>
      </p>
    </div>
  </div>
);

const Section = ({ title, count, tone, children }: { title: string; count?: number; tone: QtyTone; children: React.ReactNode }) => (
  <Card className="overflow-hidden">
    <CardHeader className={cn('border-l-4', QTY_TONE_CLASSES[tone].chip, 'border-l-current')}>
      <CardTitle className="text-base">
        {title}
        {count !== undefined ? <span className="ml-2 font-normal text-muted-foreground">({count})</span> : null}
      </CardTitle>
    </CardHeader>
    <div className="overflow-x-auto">{children}</div>
  </Card>
);

const Empty = ({ text }: { text: string }) => <p className="px-4 py-6 text-center text-sm text-muted-foreground">{text}</p>;

const th = 'px-3 py-2 text-left font-medium';
const td = 'px-3 py-2 align-top';

// One lot, everything about it: reached from the lot number box in the header.
export const LotHistoryPage = () => {
  const [params] = useSearchParams();
  const lotNumber = (params.get('lot') ?? '').trim();
  const { selectedBook } = useSelectedBook();
  const bookId = selectedBook?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['lot-history', bookId, lotNumber],
    queryFn: () => apiClient.get<LotHistory>(`/cutting/history/${encodeURIComponent(lotNumber)}`, { bookId }),
    enabled: Boolean(bookId && lotNumber),
    retry: false,
  });

  if (!lotNumber) {
    return (
      <PageLayout title="Lot History">
        <FormAlert tone="info">Type a lot number in the box at the top and press Enter.</FormAlert>
      </PageLayout>
    );
  }
  if (isLoading || !bookId) {
    return (
      <PageLayout title={`Lot ${lotNumber}`}>
        <LoadingState variant="page" />
      </PageLayout>
    );
  }
  if (error || !data) {
    return (
      <PageLayout title={`Lot ${lotNumber}`}>
        <FormAlert tone="error">
          {error instanceof ApiRequestError ? error.message : `Lot ${lotNumber} not found.`} (Book {selectedBook?.name} is selected — change the book in the header to look in another.)
        </FormAlert>
      </PageLayout>
    );
  }

  const { lot, summary, sizes } = data;
  const stage = STAGES[data.stage];
  const designPhoto = resolvePhotoUrl(lot.itemPhotoUrl);
  const fabric = lot.pieces && lot.averageValue ? (lot.totalQuantity / lot.pieces) * lot.averageValue : null;

  return (
    <PageLayout
      title={`Lot ${lot.lotNumber} · ${lot.itemName}`}
      description={`Book ${lot.bookName} · Party ${lot.partyName} · Cut on ${when(lot.date, lot.entryTime)}`}
      actions={<Badge variant={stage.variant}>{stage.label}</Badge>}
    >
      {lot.closedAt ? (
        <FormAlert tone="warning">
          Lot closed on {formatDate(lot.closedAt.slice(0, 10))}
          {lot.closeReason ? ` — ${CLOSE_REASONS[lot.closeReason] ?? lot.closeReason}` : ''}
          {lot.closedAlteration ? ` — ${n(lot.closedAlteration)} pcs in alteration` : ''}
          {lot.closedShortage ? ` (${n(lot.closedShortage)} pcs short)` : ''}
          {lot.closeNote ? `. ${lot.closeNote}` : ''}
        </FormAlert>
      ) : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        <SummaryTile icon={Scissors} label="Cut" value={summary.cut} tone="total" />
        <SummaryTile icon={Hourglass} label="Not given yet" value={summary.notGiven} tone="pending" />
        <SummaryTile icon={Users} label="With karigars" value={summary.withKarigars} tone="earlier" />
        <SummaryTile icon={Package} label="Produced (handed in)" value={summary.produced} tone="now" />
        <SummaryTile icon={Scissors} label="In alteration" value={summary.alteration} tone="earlier" />
        <SummaryTile icon={ArrowLeftRight} label="Ready to deliver" value={summary.readyToDeliver} tone="now" />
        <SummaryTile icon={Truck} label="Delivered" value={summary.delivered} tone="done" />
      </div>

      <Card className="overflow-hidden border-primary/25 bg-primary/5">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
          <div className="flex size-40 shrink-0 items-center justify-center self-center overflow-hidden rounded-lg border border-border bg-card sm:self-start">
            {designPhoto ? (
              <img src={designPhoto} alt={`Design ${lot.itemName}`} className="size-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                <ImageOff className="size-8" />
                No design photo
              </span>
            )}
          </div>
          <div className="grid flex-1 content-start gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Design', lot.itemName],
              ['Party', lot.partyName],
              ['Pattern', `${lot.patternType} · ${lot.isOnline ? 'Online' : 'Offline'}`],
              ['Average', lot.pieces && lot.averageValue ? `${lot.averageValue} ${lot.averageUnit} per ${lot.pieces} pcs` : '—'],
              ['Total fabric', fabric ? `${fabric.toFixed(2)} ${lot.averageUnit}` : '—'],
              ['Remaining fabric', lot.remainingFabric != null ? `${lot.remainingFabric} ${lot.averageUnit}` : '—'],
              ['Labour cost (production)', `₹ ${formatMoney(summary.labourCost)}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-card/70 px-3 py-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-base font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Section title="Cut quantity (colour × size)" tone="total">
        <table className="data-table w-full text-sm">
          <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className={th}>Colour</th>
              {sizes.map((s) => (
                <th key={s.id} className="px-3 py-2 text-center font-medium normal-case tracking-normal">
                  {s.name}
                  {s.detail ? <span className="block text-xs font-normal opacity-80">{s.detail}</span> : null}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.cutGrid.map((row) => (
              <tr key={row.color} className="border-b border-border last:border-0">
                <td className={`${td} font-medium`}>
                  <span className="flex items-center gap-2">
                    {resolvePhotoUrl(row.photoUrl) ? (
                      <img src={resolvePhotoUrl(row.photoUrl)!} alt={`${row.color} cloth`} className="size-10 rounded-md border border-border object-cover" />
                    ) : null}
                    {row.color}
                  </span>
                </td>
                {sizes.map((s) => (
                  <td key={s.id} className="numeric px-3 py-2 text-center">
                    {row.cells[s.id] ? n(row.cells[s.id]) : '—'}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <QtyChip tone="total" value={row.total} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Karigar-wise position" count={data.karigars.length} tone="earlier">
        {data.karigars.length ? (
          <table className="data-table w-full text-sm">
            <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className={th}>Karigar</th>
                <th className={th}>Work type</th>
                <th className="px-3 py-2 text-right font-medium">Given</th>
                <th className="px-3 py-2 text-right font-medium">Handed in</th>
                <th className="px-3 py-2 text-right font-medium">Alteration</th>
                <th className="px-3 py-2 text-right font-medium">Pending</th>
              </tr>
            </thead>
            <tbody>
              {data.karigars.map((k) => (
                <tr key={k.karigarId} className="border-b border-border last:border-0">
                  <td className={`${td} font-medium`}>{k.name}</td>
                  <td className={`${td} text-muted-foreground`}>{k.workType}</td>
                  <td className="px-3 py-2 text-right">
                    <QtyChip tone="earlier" value={k.given} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <QtyChip tone="now" value={k.handedIn} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <QtyChip tone="earlier" value={k.alteration} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <QtyChip tone="pending" value={k.pending} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty text="Not given to any karigar yet." />
        )}
      </Section>

      <Section title="Cutting distribution" count={data.distributions.length} tone="earlier">
        {data.distributions.length ? (
          <table className="data-table w-full text-sm">
            <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Karigar</th>
                <th className={th}>Colour / size</th>
                <th className="px-3 py-2 text-right font-medium">Pcs</th>
                <th className={th}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {data.distributions.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className={`${td} whitespace-nowrap`}>{when(d.date, d.entryTime)}</td>
                  <td className={td}>
                    <span className="font-medium">{d.karigar}</span> <span className="text-xs text-muted-foreground">{d.workType}</span>
                  </td>
                  <td className={td}>
                    <CellList cells={d.cells} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <QtyChip tone="earlier" value={d.total} />
                  </td>
                  <td className={`${td} text-muted-foreground`}>{d.remarks ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty text="No distribution yet." />
        )}
      </Section>

      <Section title="Production (handed in)" count={data.production.length} tone="now">
        {data.production.length ? (
          <table className="data-table w-full text-sm">
            <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Karigar</th>
                <th className={th}>Colour / size</th>
                <th className="px-3 py-2 text-right font-medium">Pcs</th>
                <th className="px-3 py-2 text-right font-medium">Alteration</th>
                <th className="px-3 py-2 text-right font-medium">Rate</th>
                <th className="px-3 py-2 text-right font-medium">Amount ₹</th>
                <th className={th}>Flatlock / Overlock</th>
              </tr>
            </thead>
            <tbody>
              {data.production.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className={`${td} whitespace-nowrap`}>{when(p.date, p.entryTime)}</td>
                  <td className={`${td} font-medium`}>{p.karigar}</td>
                  <td className={td}>
                    <CellList cells={p.cells} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <QtyChip tone="now" value={p.quantity} />
                  </td>
                  <td className="numeric px-3 py-2 text-right">{p.alteration ? n(p.alteration) : '—'}</td>
                  <td className="numeric px-3 py-2 text-right">{p.rate != null ? formatMoney(p.rate) : '—'}</td>
                  <td className="numeric px-3 py-2 text-right">{formatMoney(p.total)}</td>
                  <td className={`${td} text-xs text-muted-foreground`}>
                    {p.flatlock ? <p>Flatlock: {p.flatlock.karigar} · ₹ {formatMoney(p.flatlock.total)}</p> : null}
                    {p.overlock ? <p>Overlock: {p.overlock.karigar} · ₹ {formatMoney(p.overlock.total)}</p> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty text="Nothing handed in yet." />
        )}
      </Section>

      <Section title="Accessories" count={data.accessories.length} tone="pending">
        {data.accessories.length ? (
          <table className="data-table w-full text-sm">
            <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Type</th>
                <th className={th}>Karigar</th>
                <th className={th}>Items</th>
              </tr>
            </thead>
            <tbody>
              {data.accessories.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className={`${td} whitespace-nowrap`}>{when(t.date, t.entryTime)}</td>
                  <td className={td}>
                    <Badge variant={t.type === 'ISSUE' ? 'warning' : 'success'}>{t.type === 'ISSUE' ? 'Issued' : 'Returned'}</Badge>
                  </td>
                  <td className={`${td} font-medium`}>{t.karigar}</td>
                  <td className={`${td} text-xs`}>{t.lines.map((l) => `${l.name} ${l.quantity} ${l.unit}`).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty text="No accessories issued for this lot." />
        )}
      </Section>

      <Section title="Delivery to party" count={data.deliveries.length} tone="done">
        {data.deliveries.length ? (
          <table className="data-table w-full text-sm">
            <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className={th}>Challan</th>
                <th className={th}>Date</th>
                <th className={th}>Colour / size</th>
                <th className="px-3 py-2 text-right font-medium">Pcs</th>
              </tr>
            </thead>
            <tbody>
              {data.deliveries.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className={`${td} numeric font-medium`}>
                    #{d.challanNumber}
                    {d.billNumber ? <span className="block text-xs font-normal text-muted-foreground">Bill {d.billNumber}</span> : null}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{when(d.date, d.entryTime)}</td>
                  <td className={td}>
                    <CellList cells={d.cells} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <QtyChip tone="done" value={d.total} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty text="Nothing delivered yet." />
        )}
      </Section>

      <p className="text-xs text-muted-foreground">
        <Link to="/dashboard" className="underline">
          Back to dashboard
        </Link>
      </p>
    </PageLayout>
  );
};
