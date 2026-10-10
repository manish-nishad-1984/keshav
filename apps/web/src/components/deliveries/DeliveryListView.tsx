import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Printer, Trash2 } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { PageLayout } from '../../components/layout/PageLayout';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { FormAlert } from '../ui/form-alert';
import { LoadingState } from '../ui/loading-state';
import { Pagination } from '../ui/pagination';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { usePermissions } from '../../hooks/use-permissions';
import { useSelectedBook } from '../../hooks/use-selected-book';
import { formatDate } from '../../lib/date';
import type { Delivery } from './delivery-constants';
import { DELIVERIES_QUERY_KEY } from './delivery-constants';

const colourNames = (d: Delivery) => [...new Set(d.quantities.map((q) => q.color.name))].join(', ');

interface DeliveryListViewProps {
  onAdd: () => void;
  onEdit: (delivery: Delivery) => void;
  onChallan: (delivery: Delivery) => void;
}

export const DeliveryListView = ({ onAdd, onEdit, onChallan }: DeliveryListViewProps) => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<Delivery | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { selectedBook, isLoading: booksLoading } = useSelectedBook();
  const bookId = selectedBook?.id;

  const canCreate = isSuperAdmin || hasPermission('deliveries:create');
  const canUpdate = isSuperAdmin || hasPermission('deliveries:update');
  const canDelete = isSuperAdmin || hasPermission('deliveries:delete');

  const { data, isLoading } = useQuery({
    queryKey: [...DELIVERIES_QUERY_KEY, { page, search, bookId }],
    queryFn: () => apiClient.list<Delivery>('/deliveries', { page, pageSize: 10, search: search || undefined, bookId }),
    enabled: Boolean(bookId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/deliveries/${id}`),
    onSuccess: () => {
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY });
    },
    onError: (err) => {
      setToDelete(null);
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');
    },
  });

  return (
    <PageLayout
      title="Delivery"
      description={
        selectedBook ? 'Finished pieces sent to parties · book ' + selectedBook.name + '.' : 'Finished pieces of a lot sent to its party.'
      }
      actions={
        canCreate ? (
          <Button onClick={onAdd} disabled={!selectedBook}>
            <Plus />
            New Delivery
          </Button>
        ) : null
      }
    >
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search challan, bill, lot or party…"
              className="pl-8"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
        </div>

        {isLoading || booksLoading ? (
          <LoadingState variant="page" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left text-sm">
              <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Challan</th>
                  <th className="px-4 py-2 font-medium">Bill No.</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Lot No.</th>
                  <th className="px-4 py-2 font-medium">Design</th>
                  <th className="px-4 py-2 font-medium">Party</th>
                  <th className="px-4 py-2 font-medium">Colours</th>
                  <th className="px-4 py-2 font-medium text-right">Pcs</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0">
                    <td className="numeric px-4 py-2.5 font-semibold">#{d.challanNumber}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{d.billNumber ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {formatDate(d.date)}
                      {d.entryTime ? <span className="ml-1.5 text-2xs">{d.entryTime}</span> : null}
                    </td>
                    <td className="numeric px-4 py-2.5 font-medium">{d.cuttingEntry.lotNumber}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{d.cuttingEntry.item.itemName}</td>
                    <td className="px-4 py-2.5">{d.party.name}</td>
                    <td className="max-w-[14rem] truncate px-4 py-2.5 text-muted-foreground" title={colourNames(d)}>
                      {colourNames(d)}
                    </td>
                    <td className="numeric px-4 py-2.5 text-right font-medium">{d.totalQuantity.toLocaleString('en-IN')}</td>
                    <td className="whitespace-nowrap px-2 py-2.5">
                      <Button variant="ghost" size="icon" aria-label={`Print challan ${d.challanNumber}`} onClick={() => onChallan(d)}>
                        <Printer />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`Edit challan ${d.challanNumber}`} disabled={!canUpdate} onClick={() => onEdit(d)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-destructive"
                        aria-label={`Delete challan ${d.challanNumber}`}
                        disabled={!canDelete}
                        onClick={() => {
                          setError(null);
                          setToDelete(d);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!data?.items.length ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      {selectedBook ? 'No deliveries in this book yet.' : 'Add a book in Book Master and select it in the header.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        {data ? <Pagination meta={data.pagination} onPageChange={setPage} className="border-t border-border" /> : null}
      </Card>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Delete delivery?"
        description={
          toDelete
            ? `Challan #${toDelete.challanNumber}: ${toDelete.totalQuantity} pcs of lot ${toDelete.cuttingEntry.lotNumber} go back to ready-to-deliver.`
            : undefined
        }
        confirmLabel="Delete"
        tone="destructive"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
      />
    </PageLayout>
  );
};
