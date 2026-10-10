import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Hourglass, Package, Scissors, Truck, Users } from 'lucide-react';
import { apiClient, ApiRequestError } from '../lib/api-client';
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
    partyName: string;
    patternType: string;
    isOnline: boolean;
    pieces: number | null;
    averageValue: number | null;
    averageUnit: string;
    totalQuantity: number;
    closedAt: string | null;
    closeReason: string | null;
    closeNote: string | null;
    closedShortage: number | null;
  };
  stage: Stage;
  summary: {
    cut: number;
    distributed: number;
    notGiven: number;
    produced: number;
    withKarigars: number;
    delivered: number;
    readyToDeliver: number;
    labourCost: number;
  };
  sizes: { id: string; name: string; detail: string | null }[];
  cutGrid: { color: string; cells: Record<string, number>; total: number }[];
  karigars: { karigarId: string; name: string; workType: string; given: number; handedIn: number; pending: number }[];
  distributions: { id: string; date: string; entryTime: string | null; karigar: string; workType: string; total: number; remarks: string | null; cells: Cell[] }[];
  production: {
    id: string;
    date: string;
    entryTime: string | null;
    karigar: string;
    quantity: number;
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
  deliveries: { id: string; challanNumber: number; date: string; entryTime: string | null; total: number; remarks: string | null; cells: Cell[] }[];
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

const SummaryTile = ({ icon: Icon, label, value, hint }: { icon: typeof Scissors; label: string; value: number; hint?: string }) => (
  <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5">
    <Icon className="size-6 shrink-0 text-muted-foreground" />
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="numeric text-xl font-semibold leading-tight">
        {n(value)} <span className="text-xs font-normal text-muted-foreground">pcs</span>
      </p>
      {hint ? <p className="truncate text-2xs text-muted-foreground">{hint}</p> : null}
    </div>
  </div>
);

const Section = ({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) => (
  <Card>
    <CardHeader>
      <CardTitle>
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
          {lot.closedShortage ? ` (${n(lot.closedShortage)} pcs short)` : ''}
          {lot.closeNote ? `. ${lot.closeNote}` : ''}
        </FormAlert>
      ) : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <SummaryTile icon={Scissors} label="Cut" value={summary.cut} />
        <SummaryTile icon={Hourglass} label="Not given yet" value={summary.notGiven} />
        <SummaryTile icon={Users} label="With karigars" value={summary.withKarigars} />
        <SummaryTile icon={Package} label="Produced (handed in)" value={summary.produced} />
        <SummaryTile icon={ArrowLeftRight} label="Ready to deliver" value={summary.readyToDeliver} />
        <SummaryTile icon={Truck} label="Delivered" value={summary.delivered} />
      </div>

      <Card>
        <CardContent className="grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Design', lot.itemName],
            ['Party', lot.partyName],
            ['Pattern', `${lot.patternType} · ${lot.isOnline ? 'Online' : 'Offline'}`],
            ['Average', lot.pieces && lot.averageValue ? `${lot.averageValue} ${lot.averageUnit} per ${lot.pieces} pcs` : '—'],
            ['Total fabric', fabric ? `${fabric.toFixed(2)} ${lot.averageUnit}` : '—'],
            ['Labour cost (production)', `₹ ${formatMoney(summary.labourCost)}`],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-medium">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Section title="Cut quantity (colour × size)">
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
                <td className={`${td} font-medium`}>{row.color}</td>
                {sizes.map((s) => (
                  <td key={s.id} className="numeric px-3 py-2 text-center">
                    {row.cells[s.id] ? n(row.cells[s.id]) : '—'}
                  </td>
                ))}
                <td className="numeric px-3 py-2 text-right font-semibold">{n(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Karigar-wise position" count={data.karigars.length}>
        {data.karigars.length ? (
          <table className="data-table w-full text-sm">
            <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className={th}>Karigar</th>
                <th className={th}>Work type</th>
                <th className="px-3 py-2 text-right font-medium">Given</th>
                <th className="px-3 py-2 text-right font-medium">Handed in</th>
                <th className="px-3 py-2 text-right font-medium">Pending</th>
              </tr>
            </thead>
            <tbody>
              {data.karigars.map((k) => (
                <tr key={k.karigarId} className="border-b border-border last:border-0">
                  <td className={`${td} font-medium`}>{k.name}</td>
                  <td className={`${td} text-muted-foreground`}>{k.workType}</td>
                  <td className="numeric px-3 py-2 text-right">{n(k.given)}</td>
                  <td className="numeric px-3 py-2 text-right">{n(k.handedIn)}</td>
                  <td className={`numeric px-3 py-2 text-right font-semibold ${k.pending > 0 ? 'text-status-danger' : ''}`}>{n(k.pending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty text="Not given to any karigar yet." />
        )}
      </Section>

      <Section title="Cutting distribution" count={data.distributions.length}>
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
                  <td className="numeric px-3 py-2 text-right font-semibold">{n(d.total)}</td>
                  <td className={`${td} text-muted-foreground`}>{d.remarks ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty text="No distribution yet." />
        )}
      </Section>

      <Section title="Production (handed in)" count={data.production.length}>
        {data.production.length ? (
          <table className="data-table w-full text-sm">
            <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className={th}>Date</th>
                <th className={th}>Karigar</th>
                <th className={th}>Colour / size</th>
                <th className="px-3 py-2 text-right font-medium">Pcs</th>
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
                  <td className="numeric px-3 py-2 text-right font-semibold">{n(p.quantity)}</td>
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

      <Section title="Accessories" count={data.accessories.length}>
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

      <Section title="Delivery to party" count={data.deliveries.length}>
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
                  <td className={`${td} numeric font-medium`}>#{d.challanNumber}</td>
                  <td className={`${td} whitespace-nowrap`}>{when(d.date, d.entryTime)}</td>
                  <td className={td}>
                    <CellList cells={d.cells} />
                  </td>
                  <td className="numeric px-3 py-2 text-right font-semibold">{n(d.total)}</td>
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
