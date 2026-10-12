import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ClipboardList } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { LoadingState } from '../ui/loading-state';
import { QtyChip } from '../ui/qty-tone';
import { useSelectedBook } from '../../hooks/use-selected-book';
import { formatDate } from '../../lib/date';
import { cn } from '../../lib/utils';

type Stage = 'not_given' | 'with_karigars' | 'in_production' | 'ready' | 'delivered' | 'closed';

interface LotStatus {
  id: string;
  lotNumber: string;
  date: string;
  isOnline: boolean;
  itemName: string;
  partyName: string;
  cut: number;
  notGiven: number;
  withKarigars: number;
  produced: number;
  readyToDeliver: number;
  delivered: number;
  stage: Stage;
  closeReason: 'DAMAGED' | 'SHORTAGE' | 'RETURNED_BY_PARTY' | null;
  closedShortage: number | null;
  closedAlteration: number | null;
  alteration: number;
  karigars: { karigarId: string; name: string; workType: string; given: number; handedIn: number; pending: number }[];
}

const STAGES: Record<Stage, { label: string; variant: 'muted' | 'warning' | 'info' | 'progress' | 'success' | 'neutral' }> = {
  not_given: { label: 'Cut — not given yet', variant: 'muted' },
  with_karigars: { label: 'With karigars', variant: 'warning' },
  in_production: { label: 'Production running', variant: 'info' },
  ready: { label: 'Ready to deliver', variant: 'progress' },
  delivered: { label: 'Delivered', variant: 'success' },
  closed: { label: 'Closed', variant: 'neutral' },
};

const FILTERS = [
  { key: 'running', label: 'Running' },
  { key: 'all', label: 'All lots' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'closed', label: 'Closed' },
] as const;

export const LotStatusCard = () => {
  const { selectedBook } = useSelectedBook();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('running');
  const [open, setOpen] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-lot-status', selectedBook?.id],
    queryFn: () => apiClient.get<LotStatus[]>('/dashboard/lot-status', { bookId: selectedBook?.id }),
    enabled: Boolean(selectedBook),
  });

  const lots = (data ?? []).filter((l) => (filter === 'all' ? true : filter === 'running' ? l.stage !== 'delivered' && l.stage !== 'closed' : l.stage === filter));

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-status-progress/15 text-status-progress">
            <ClipboardList className="size-4" strokeWidth={1.9} />
          </span>
          <div>
            <CardTitle>Lot Status</CardTitle>
            <CardDescription>
              {selectedBook ? `Book ${selectedBook.name} — where every lot stands and how much is with each karigar.` : 'Select a book.'}
            </CardDescription>
          </div>
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)}>
              {f.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <LoadingState />
        ) : !lots.length ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No lots here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full min-w-max text-left text-sm">
              <thead className="border-y border-border text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-2 py-2 font-medium">Lot</th>
                  <th className="px-2 py-2 font-medium">Design · Party</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 text-center font-medium">Cut</th>
                  <th className="px-2 py-2 text-center font-medium">Not given</th>
                  <th className="px-2 py-2 text-center font-medium">With karigars</th>
                  <th className="px-2 py-2 text-center font-medium">Produced</th>
                  <th className="px-2 py-2 text-center font-medium">Ready</th>
                  <th className="px-2 py-2 text-center font-medium">Delivered</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => {
                  const isOpen = open === lot.id;
                  const stage = STAGES[lot.stage];
                  return (
                    <Fragment key={lot.id}>
                      <tr
                        className={cn('cursor-pointer border-b border-border hover:bg-muted/40', isOpen && 'bg-muted/40')}
                        onClick={() => setOpen(isOpen ? null : lot.id)}
                      >
                        <td className="px-2 py-2 text-muted-foreground">
                          <button type="button" aria-label={isOpen ? 'Hide karigars' : 'Show karigars'} aria-expanded={isOpen}>
                            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </button>
                        </td>
                        <td className="numeric px-2 py-2 font-semibold">
                          {lot.lotNumber}
                          <span className="block text-2xs font-normal text-muted-foreground">{formatDate(lot.date)}</span>
                        </td>
                        <td className="px-2 py-2">
                          <span className="font-medium">{lot.itemName}</span>
                          <span className="block text-xs text-muted-foreground">{lot.partyName}</span>
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant={stage.variant}>{stage.label}</Badge>
                          {lot.alteration ? <span className="mt-0.5 block text-2xs text-status-warning">{lot.alteration} in alteration</span> : null}
                          {lot.stage === 'closed' && lot.closedShortage ? (
                            <span className="mt-0.5 block text-2xs text-muted-foreground">
                              {lot.closedShortage} not delivered{lot.closeReason ? ` — ${lot.closeReason === 'DAMAGED' ? 'damaged' : lot.closeReason === 'SHORTAGE' ? 'shortage' : 'returned by party'}` : ''}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-2 text-center"><QtyChip tone="total" size="sm" value={lot.cut} /></td>
                        <td className="px-2 py-2 text-center"><QtyChip tone="earlier" size="sm" value={lot.notGiven} /></td>
                        <td className="px-2 py-2 text-center"><QtyChip tone="pending" size="sm" value={lot.withKarigars} /></td>
                        <td className="px-2 py-2 text-center"><QtyChip tone="now" size="sm" value={lot.produced} /></td>
                        <td className="px-2 py-2 text-center"><QtyChip tone="now" size="sm" value={lot.readyToDeliver} /></td>
                        <td className="px-2 py-2 text-center"><QtyChip tone="total" size="sm" value={lot.delivered} /></td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-b border-border bg-muted/20">
                          <td />
                          <td colSpan={9} className="px-2 py-2">
                            {lot.karigars.length ? (
                              <table className="w-full max-w-2xl text-sm">
                                <thead className="text-2xs uppercase tracking-wider text-muted-foreground">
                                  <tr>
                                    <th className="py-1 text-left font-medium">Karigar</th>
                                    <th className="py-1 text-center font-medium">Given</th>
                                    <th className="py-1 text-center font-medium">Handed in</th>
                                    <th className="py-1 text-center font-medium">Still with karigar</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lot.karigars.map((k) => (
                                    <tr key={k.karigarId} className="border-t border-border/60">
                                      <td className="py-1.5 font-medium">
                                        {k.name} <span className="text-xs font-normal text-muted-foreground">{k.workType}</span>
                                      </td>
                                      <td className="py-1.5 text-center"><QtyChip tone="total" size="sm" value={k.given} /></td>
                                      <td className="py-1.5 text-center"><QtyChip tone="now" size="sm" value={k.handedIn} /></td>
                                      <td className="py-1.5 text-center"><QtyChip tone="pending" size="sm" value={k.pending} /></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p className="text-sm text-muted-foreground">Not given to any karigar yet.</p>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
