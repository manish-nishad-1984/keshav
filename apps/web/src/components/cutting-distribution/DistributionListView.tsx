import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
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
import type { Distribution } from './distribution-constants';
import { DISTRIBUTIONS_QUERY_KEY } from './distribution-constants';

const colourNames = (d: Distribution) => [...new Set(d.quantities.map((q) => q.color.name))].join(', ');

interface DistributionListViewProps {
  onAdd: () => void;
  onEdit: (distribution: Distribution) => void;
}

export const DistributionListView = ({ onAdd, onEdit }: DistributionListViewProps) => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<Distribution | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { selectedBook, isLoading: booksLoading } = useSelectedBook();
  const bookId = selectedBook?.id;

  const canCreate = isSuperAdmin || hasPermission('cutting_distribution:create');
  const canUpdate = isSuperAdmin || hasPermission('cutting_distribution:update');
  const canDelete = isSuperAdmin || hasPermission('cutting_distribution:delete');

  const { data, isLoading } = useQuery({
    queryKey: [...DISTRIBUTIONS_QUERY_KEY, { page, search, bookId }],
    queryFn: () =>
      apiClient.list<Distribution>('/cutting-distributions', { page, pageSize: 10, search: search || undefined, bookId }),
    enabled: Boolean(bookId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/cutting-distributions/${id}`),
    onSuccess: () => {
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: DISTRIBUTIONS_QUERY_KEY });
    },
    onError: (err) => {
      setToDelete(null);
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');
    },
  });

  return (
    <PageLayout
      title="Cutting Distribution"
      description={
        selectedBook
          ? 'Cut pieces handed to karigars · book ' + selectedBook.name + '.'
          : 'Cut pieces of a lot handed to karigars, by colour and size.'
      }
      actions={
        canCreate ? (
          <Button onClick={onAdd} disabled={!selectedBook}>
            <Plus />
            Add Distribution
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
              placeholder="Search lot or karigar…"
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
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Lot No.</th>
                  <th className="px-4 py-2 font-medium">Design</th>
                  <th className="px-4 py-2 font-medium">Karigar</th>
                  <th className="px-4 py-2 font-medium">Colours</th>
                  <th className="px-4 py-2 font-medium text-right">Pcs Given</th>
                  <th className="px-4 py-2 font-medium">Remarks</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {formatDate(d.date)}
                      {d.entryTime ? <span className="ml-1.5 text-2xs">{d.entryTime}</span> : null}
                    </td>
                    <td className="numeric px-4 py-2.5 font-medium">{d.cuttingEntry.lotNumber}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{d.cuttingEntry.item.itemName}</td>
                    <td className="px-4 py-2.5">
                      {d.karigar.fullName}
                      <span className="ml-1.5 text-2xs text-muted-foreground">{d.karigar.workType.name}</span>
                    </td>
                    <td className="max-w-[14rem] truncate px-4 py-2.5 text-muted-foreground" title={colourNames(d)}>
                      {colourNames(d)}
                    </td>
                    <td className="numeric px-4 py-2.5 text-right font-medium">{d.totalQuantity.toLocaleString('en-IN')}</td>
                    <td className="max-w-[12rem] truncate px-4 py-2.5 text-muted-foreground" title={d.remarks ?? undefined}>
                      {d.remarks || '—'}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5">
                      <Button variant="ghost" size="icon" aria-label={`Edit distribution of lot ${d.cuttingEntry.lotNumber}`} disabled={!canUpdate} onClick={() => onEdit(d)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-destructive"
                        aria-label={`Delete distribution of lot ${d.cuttingEntry.lotNumber}`}
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
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      {selectedBook ? 'No distributions in this book yet.' : 'Add a book in Book Master and select it in the header.'}
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
        title="Delete distribution?"
        description={
          toDelete
            ? `${toDelete.totalQuantity} pcs of lot ${toDelete.cuttingEntry.lotNumber} given to ${toDelete.karigar.fullName} go back to the lot's remaining pieces.`
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
