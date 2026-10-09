import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { PageLayout } from '../../components/layout/PageLayout';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { LoadingState } from '../ui/loading-state';
import { Pagination } from '../ui/pagination';
import { usePermissions } from '../../hooks/use-permissions';
import { useSelectedBook } from '../../hooks/use-selected-book';
import type { CuttingEntry } from './cutting-constants';
import { DeleteLotDialog } from './DeleteLotDialog';
import { AVERAGE_UNIT_SHORT, fabricRequired } from './cutting-constants';
import { formatDate } from '../../lib/date';

const colourNames = (entry: CuttingEntry) => entry.rows.map((r) => r.color.name).join(', ');

const fabricText = (entry: CuttingEntry) => {
  const fabric = fabricRequired(entry.totalQuantity, entry.pieces, entry.averageValue);
  return fabric === null ? '—' : `${fabric.toLocaleString('en-IN', { maximumFractionDigits: 3 })} ${AVERAGE_UNIT_SHORT[entry.averageUnit]}`;
};

interface CuttingListViewProps {
  onAdd: () => void;
  onEdit: (entry: CuttingEntry) => void;
}

export const CuttingListView = ({ onAdd, onEdit }: CuttingListViewProps) => {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<CuttingEntry | null>(null);
  const { selectedBook, isLoading: booksLoading } = useSelectedBook();
  const bookId = selectedBook?.id;

  const canCreate = isSuperAdmin || hasPermission('cutting:create');
  const canUpdate = isSuperAdmin || hasPermission('cutting:update');
  const canManage = isSuperAdmin || hasPermission('cutting:manage');
  const canDelete = canManage || hasPermission('cutting:delete');

  const { data, isLoading } = useQuery({
    // Lots belong to a book: the list shows only the header's selected book.
    queryKey: ['cutting-entries', { page, search, bookId }],
    queryFn: () => apiClient.list<CuttingEntry>('/cutting', { page, pageSize: 10, search: search || undefined, bookId }),
    enabled: Boolean(bookId),
  });

  return (
    <PageLayout
      title="Cutting"
      description={selectedBook ? 'Cutting lots in book ' + selectedBook.name + '.' : 'Fabric cutting lots — the starting point of production.'}
      actions={
        canCreate ? (
          <Button onClick={onAdd} disabled={!selectedBook}>
            <Plus />
            Add Cutting Entry
          </Button>
        ) : null
      }
    >
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search lot, party, design or colour…"
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
                  <th className="px-4 py-2 font-medium">Lot No.</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Design</th>
                  <th className="px-4 py-2 font-medium">Party</th>
                  <th className="px-4 py-2 font-medium">Colours</th>
                  <th className="px-4 py-2 font-medium text-right">Total Pcs</th>
                  <th className="px-4 py-2 font-medium text-right">Total Kapda</th>
                  <th className="px-4 py-2 font-medium">Mode</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0">
                    <td className="numeric px-4 py-2.5 font-medium">{entry.lotNumber}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                      {formatDate(entry.date)}
                      {entry.entryTime ? <span className="ml-1.5 text-2xs">{entry.entryTime}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{entry.item.itemName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{entry.party.name}</td>
                    <td className="max-w-[14rem] truncate px-4 py-2.5 text-muted-foreground" title={colourNames(entry)}>
                      {colourNames(entry) || '—'}
                    </td>
                    <td className="numeric px-4 py-2.5 text-right font-medium">{entry.totalQuantity.toLocaleString('en-IN')}</td>
                    <td className="numeric px-4 py-2.5 text-right text-muted-foreground">{fabricText(entry)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={entry.isOnline ? 'info' : 'muted'}>{entry.isOnline ? 'Online' : 'Offline'}</Badge>
                    </td>
                    <td className="px-2 py-2.5">
                      <Button variant="ghost" size="icon" aria-label={`Edit lot ${entry.lotNumber}`} disabled={!canUpdate} onClick={() => onEdit(entry)}>
                        <Pencil />
                      </Button>
                      {canDelete ? (
                        <Button variant="ghost" size="icon" aria-label={`Delete lot ${entry.lotNumber}`} className="text-destructive" onClick={() => setDeleting(entry)}>
                          <Trash2 />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {!data?.items.length ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      {selectedBook ? 'No cutting entries in this book yet.' : 'Add a book in Book Master and select it in the header.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        {data ? <Pagination meta={data.pagination} onPageChange={setPage} className="border-t border-border" /> : null}
      </Card>
      <DeleteLotDialog lot={deleting} canManage={canManage} onClose={() => setDeleting(null)} />
    </PageLayout>
  );
};
