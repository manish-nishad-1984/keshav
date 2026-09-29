import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Pencil } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { PageLayout } from '../../components/layout/PageLayout';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { LoadingState } from '../ui/loading-state';
import { Pagination } from '../ui/pagination';
import { usePermissions } from '../../hooks/use-permissions';
import type { CuttingEntry } from './cutting-constants';

interface CuttingListViewProps {
  onAdd: () => void;
  onEdit: (entry: CuttingEntry) => void;
}

export const CuttingListView = ({ onAdd, onEdit }: CuttingListViewProps) => {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const canCreate = isSuperAdmin || hasPermission('cutting:create');
  const canUpdate = isSuperAdmin || hasPermission('cutting:update');

  const { data, isLoading } = useQuery({
    queryKey: ['cutting-entries', { page, search }],
    queryFn: () => apiClient.list<CuttingEntry>('/cutting', { page, pageSize: 10, search: search || undefined }),
  });

  return (
    <PageLayout
      title="Cutting"
      description="Fabric cutting lots — the starting point of production."
      actions={
        canCreate ? (
          <Button onClick={onAdd}>
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
              placeholder="Search by lot number, party or item…"
              className="pl-8"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
        </div>

        {isLoading ? (
          <LoadingState variant="page" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Lot No.</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Item</th>
                  <th className="px-4 py-2 font-medium">Party</th>
                  <th className="px-4 py-2 font-medium">Color</th>
                  <th className="px-4 py-2 font-medium">Mode</th>
                  <th className="px-4 py-2 font-medium">Total</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((entry) => (
                  <tr key={entry.id} className="border-b border-border last:border-0">
                    <td className="numeric px-4 py-2.5 font-medium">{entry.lotNumber}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{new Date(entry.date).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{entry.item.itemName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{entry.partyName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{entry.color.name}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={entry.isOnline ? 'info' : 'muted'}>{entry.isOnline ? 'Online' : 'Offline'}</Badge>
                    </td>
                    <td className="numeric px-4 py-2.5 text-muted-foreground">{Number(entry.totalAmount).toFixed(2)}</td>
                    <td className="px-2 py-2.5">
                      <Button variant="ghost" size="icon" disabled={!canUpdate} onClick={() => onEdit(entry)}>
                        <Pencil />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!data?.items.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      No cutting entries yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        {data ? <Pagination meta={data.pagination} onPageChange={setPage} className="border-t border-border" /> : null}
      </Card>
    </PageLayout>
  );
};
