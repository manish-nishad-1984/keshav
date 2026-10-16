import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PackageMinus, PackagePlus, Pencil, Search, Trash2 } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { PageLayout } from '../../components/layout/PageLayout';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { FormAlert } from '../ui/form-alert';
import { LoadingState } from '../ui/loading-state';
import { Pagination } from '../ui/pagination';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { usePermissions } from '../../hooks/use-permissions';
import { useSelectedBook } from '../../hooks/use-selected-book';
import { formatDate } from '../../lib/date';
import { cn } from '../../lib/utils';
import type { AccessoryTransaction, AccessoryTransactionType, KarigarLotPosition } from './accessory-constants';
import { ACCESSORY_ISSUES_QUERY_KEY, TRANSACTION_TYPE_LABELS, formatAmount } from './accessory-constants';

type Tab = 'entries' | 'balance' | 'due';

interface AccessoryIssueListViewProps {
  onAdd: (type: AccessoryTransactionType) => void;
  onEdit: (transaction: AccessoryTransaction) => void;
}

const linesText = (t: AccessoryTransaction) =>
  t.lines.map((l) => `${l.accessory.name} ${formatAmount(l.quantity)} ${l.accessory.unit}`).join(', ');

// One row per karigar × accessory across the book's lots.
interface BalanceRow {
  key: string;
  karigar: string;
  accessory: string;
  unit: string;
  limit: number;
  issued: number;
  returned: number;
  used: number;
  holding: number;
  holdingLots: string[];
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

const toBalanceRows = (positions: KarigarLotPosition[]): BalanceRow[] => {
  const rows = new Map<string, BalanceRow>();
  for (const p of positions) {
    for (const l of p.lines) {
      const key = `${p.karigar.id}:${l.accessoryId}`;
      const row = rows.get(key) ?? {
        key,
        karigar: p.karigar.fullName,
        accessory: l.name,
        unit: l.unit,
        limit: 0,
        issued: 0,
        returned: 0,
        used: 0,
        holding: 0,
        holdingLots: [],
      };
      row.limit = round3(row.limit + l.limit);
      row.issued = round3(row.issued + l.issued);
      row.returned = round3(row.returned + l.returned);
      row.used = round3(row.used + l.used);
      row.holding = round3(row.holding + l.holding);
      if (l.holding > 0) row.holdingLots.push(p.lot.lotNumber);
      rows.set(key, row);
    }
  }
  return [...rows.values()]
    .filter((r) => r.issued > 0)
    .sort((a, b) => a.karigar.localeCompare(b.karigar) || a.accessory.localeCompare(b.accessory));
};

export const AccessoryIssueListView = ({ onAdd, onEdit }: AccessoryIssueListViewProps) => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const [tab, setTab] = useState<Tab>('entries');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [onlyHolding, setOnlyHolding] = useState(true);
  const [toDelete, setToDelete] = useState<AccessoryTransaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { selectedBook, isLoading: booksLoading } = useSelectedBook();
  const bookId = selectedBook?.id;

  const canCreate = isSuperAdmin || hasPermission('accessory_issues:create');
  const canUpdate = isSuperAdmin || hasPermission('accessory_issues:update');
  const canDelete = isSuperAdmin || hasPermission('accessory_issues:delete');

  const { data, isLoading } = useQuery({
    queryKey: [...ACCESSORY_ISSUES_QUERY_KEY, 'list', { page, search, bookId }],
    queryFn: () =>
      apiClient.list<AccessoryTransaction>('/accessory-issues', { page, pageSize: 10, search: search || undefined, bookId }),
    enabled: Boolean(bookId) && tab === 'entries',
  });
  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: [...ACCESSORY_ISSUES_QUERY_KEY, 'balance', bookId],
    queryFn: () => apiClient.get<KarigarLotPosition[]>('/accessory-issues/balance', { bookId }),
    enabled: Boolean(bookId) && tab === 'balance',
  });

  const { data: dueList, isLoading: dueLoading } = useQuery({
    queryKey: [...ACCESSORY_ISSUES_QUERY_KEY, 'pending-returns', bookId],
    queryFn: () => apiClient.get<KarigarLotPosition[]>('/accessory-issues/pending-returns', { bookId }),
    enabled: Boolean(bookId) && tab === 'due',
  });
  const dueRows = (dueList ?? []).flatMap((p) =>
    p.lines.map((l) => ({
      key: `${p.karigar.id}:${p.lot.id}:${l.accessoryId}`,
      karigar: p.karigar.fullName,
      lot: p.lot.lotNumber,
      design: p.lot.item.itemName,
      alteration: p.piecesAlteration,
      accessory: l.name,
      unit: l.unit,
      due: l.returnDue,
    })),
  );

  const balanceRows = useMemo(() => {
    const rows = toBalanceRows(balance ?? []);
    const term = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!onlyHolding || r.holding > 0) &&
        (!term || r.karigar.toLowerCase().includes(term) || r.accessory.toLowerCase().includes(term)),
    );
  }, [balance, onlyHolding, search]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/accessory-issues/${id}`),
    onSuccess: () => {
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ACCESSORY_ISSUES_QUERY_KEY });
    },
    onError: (err) => {
      setToDelete(null);
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');
    },
  });

  return (
    <PageLayout
      title="Accessory Issue"
      description={
        selectedBook
          ? 'Accessories given to karigars for their lots · book ' + selectedBook.name + '.'
          : 'Accessories given to karigars against the lots they took.'
      }
      actions={
        canCreate ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onAdd('RETURN')} disabled={!selectedBook}>
              <PackageMinus />
              Return
            </Button>
            <Button onClick={() => onAdd('ISSUE')} disabled={!selectedBook}>
              <PackagePlus />
              Issue Accessories
            </Button>
          </div>
        ) : null
      }
    >
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <div role="tablist" aria-label="View" className="inline-flex rounded-md border border-border bg-muted p-0.5">
            {(
              [
                { value: 'entries', label: 'Entries' },
                { value: 'balance', label: 'Karigar Balance' },
                { value: 'due', label: 'Return Due' },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={tab === option.value}
                onClick={() => setTab(option.value)}
                className={cn(
                  'rounded px-3 py-1 text-sm transition-colors',
                  tab === option.value ? 'bg-card font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={tab === 'entries' ? 'Search lot, karigar or accessory…' : 'Search karigar or accessory…'}
              className="pl-8"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
          {tab === 'balance' ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" checked={onlyHolding} onChange={(e) => setOnlyHolding(e.target.checked)} />
              Only with pending accessories
            </label>
          ) : null}
        </div>

        {tab === 'entries' ? (
          isLoading || booksLoading ? (
            <LoadingState variant="page" />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full text-left text-sm">
                <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Karigar</th>
                    <th className="px-4 py-2 font-medium">Lot No.</th>
                    <th className="px-4 py-2 font-medium">Design</th>
                    <th className="px-4 py-2 font-medium">Accessories</th>
                    <th className="px-4 py-2 font-medium">Remarks</th>
                    <th className="px-4 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.map((t) => (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                        {formatDate(t.date)}
                        {t.entryTime ? <span className="ml-1.5 text-2xs">{t.entryTime}</span> : null}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={t.type === 'ISSUE' ? 'info' : 'success'}>{TRANSACTION_TYPE_LABELS[t.type]}</Badge>
                      </td>
                      <td className="px-4 py-2.5">{t.karigar.fullName}</td>
                      <td className="numeric px-4 py-2.5 font-medium">{t.cuttingEntry.lotNumber}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{t.cuttingEntry.item.itemName}</td>
                      <td className="max-w-[18rem] truncate px-4 py-2.5" title={linesText(t)}>
                        {linesText(t)}
                      </td>
                      <td className="max-w-[10rem] truncate px-4 py-2.5 text-muted-foreground" title={t.remarks ?? undefined}>
                        {t.remarks || '—'}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5">
                        <Button variant="ghost" size="icon" aria-label={`Edit entry for lot ${t.cuttingEntry.lotNumber}`} disabled={!canUpdate} onClick={() => onEdit(t)}>
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-destructive"
                          aria-label={`Delete entry for lot ${t.cuttingEntry.lotNumber}`}
                          disabled={!canDelete}
                          onClick={() => {
                            setError(null);
                            setToDelete(t);
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {!data?.items.length ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        {selectedBook ? 'No accessory entries in this book yet.' : 'Add a book in Book Master and select it in the header.'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )
        ) : tab === 'due' ? (
          dueLoading || booksLoading ? (
            <LoadingState variant="page" />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full text-left text-sm">
                <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Karigar</th>
                    <th className="px-4 py-2 font-medium">Lot</th>
                    <th className="px-4 py-2 font-medium">Design</th>
                    <th className="px-4 py-2 text-right font-medium">Alteration pcs</th>
                    <th className="px-4 py-2 font-medium">Accessory</th>
                    <th className="px-4 py-2 text-right font-medium">To take back</th>
                  </tr>
                </thead>
                <tbody>
                  {dueRows
                    .filter((r) => !search || `${r.karigar} ${r.accessory} ${r.lot}`.toLowerCase().includes(search.toLowerCase()))
                    .map((r) => (
                      <tr key={r.key} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 font-medium">{r.karigar}</td>
                        <td className="numeric px-4 py-2.5">{r.lot}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{r.design}</td>
                        <td className="numeric px-4 py-2.5 text-right">{r.alteration}</td>
                        <td className="px-4 py-2.5">
                          {r.accessory} <span className="text-2xs text-muted-foreground">{r.unit}</span>
                        </td>
                        <td className="numeric px-4 py-2.5 text-right font-semibold text-status-danger">{formatAmount(r.due)}</td>
                      </tr>
                    ))}
                  {!dueRows.length ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No karigar has accessories to return for alteration pieces.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )
        ) : balanceLoading || booksLoading ? (
          <LoadingState variant="page" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left text-sm">
              <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Karigar</th>
                  <th className="px-4 py-2 font-medium">Accessory</th>
                  <th className="px-4 py-2 text-right font-medium">Limit</th>
                  <th className="px-4 py-2 text-right font-medium">Given</th>
                  <th className="px-4 py-2 text-right font-medium">Returned</th>
                  <th className="px-4 py-2 text-right font-medium">Used</th>
                  <th className="px-4 py-2 text-right font-medium">With karigar</th>
                  <th className="px-4 py-2 font-medium">Pending lots</th>
                </tr>
              </thead>
              <tbody>
                {balanceRows.map((r) => (
                  <tr key={r.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium">{r.karigar}</td>
                    <td className="px-4 py-2.5">
                      {r.accessory} <span className="text-2xs text-muted-foreground">{r.unit}</span>
                    </td>
                    <td className="numeric px-4 py-2.5 text-right text-muted-foreground">{formatAmount(r.limit)}</td>
                    <td className="numeric px-4 py-2.5 text-right">{formatAmount(r.issued)}</td>
                    <td className="numeric px-4 py-2.5 text-right text-muted-foreground">{formatAmount(r.returned)}</td>
                    <td className="numeric px-4 py-2.5 text-right text-muted-foreground">{formatAmount(r.used)}</td>
                    <td className={cn('numeric px-4 py-2.5 text-right font-semibold', r.holding > 0 ? 'text-status-warning' : 'text-status-success')}>
                      {r.holding > 0 ? formatAmount(r.holding) : 'All used'}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.holdingLots.length ? r.holdingLots.join(', ') : '—'}</td>
                  </tr>
                ))}
                {!balanceRows.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      {onlyHolding ? 'No karigar holds pending accessories in this book.' : 'No accessories issued in this book yet.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'entries' && data ? <Pagination meta={data.pagination} onPageChange={setPage} className="border-t border-border" /> : null}
      </Card>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={toDelete?.type === 'RETURN' ? 'Delete return?' : 'Delete issue?'}
        description={toDelete ? `${linesText(toDelete)} · ${toDelete.karigar.fullName} · lot ${toDelete.cuttingEntry.lotNumber}` : undefined}
        confirmLabel="Delete"
        tone="destructive"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
      />
    </PageLayout>
  );
};
