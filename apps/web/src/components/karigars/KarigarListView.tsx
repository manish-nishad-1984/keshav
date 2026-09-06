import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, User } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { PageLayout } from '../../components/layout/PageLayout';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { LoadingState } from '../ui/loading-state';
import { Pagination } from '../ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { usePermissions } from '../../hooks/use-permissions';
import type { Karigar, WorkType } from './karigar-constants';

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/api\/v1\/?$/, '');
const resolvePhotoUrl = (url: string | null) => (url ? (url.startsWith('http') ? url : `${API_ORIGIN}${url}`) : null);

interface KarigarListViewProps {
  onAdd: () => void;
  onEdit: (karigar: Karigar) => void;
}

export const KarigarListView = ({ onAdd, onEdit }: KarigarListViewProps) => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const [search, setSearch] = useState('');
  const [workTypeId, setWorkTypeId] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const canCreate = isSuperAdmin || hasPermission('karigars:create');
  const canUpdate = isSuperAdmin || hasPermission('karigars:update');

  const { data: workTypes } = useQuery({
    queryKey: ['work-types'],
    queryFn: () => apiClient.get<WorkType[]>('/karigars/work-types'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['karigars', { page, search, workTypeId }],
    queryFn: () =>
      apiClient.list<Karigar>('/karigars', {
        page,
        pageSize: 8,
        search: search || undefined,
        workTypeId: workTypeId === 'ALL' ? undefined : workTypeId,
      }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiClient.patch(`/karigars/${id}`, { isActive }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['karigars'] }),
  });

  return (
    <PageLayout
      title="Karigar Master"
      actions={
        canCreate ? (
          <Button onClick={onAdd}>
            <Plus />
            Add Karigar
          </Button>
        ) : null
      }
    >
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, code or mobile…"
              className="pl-8"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
          <Select
            value={workTypeId}
            onValueChange={(v) => {
              setPage(1);
              setWorkTypeId(v);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Work Type</SelectItem>
              {workTypes?.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <LoadingState variant="page" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Photo</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Code</th>
                  <th className="px-4 py-2 font-medium">Mobile</th>
                  <th className="px-4 py-2 font-medium">Work Type</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((karigar) => {
                  const photoUrl = resolvePhotoUrl(karigar.photoUrl);
                  return (
                    <tr key={karigar.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">
                        <div className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground">
                          {photoUrl ? (
                            <img src={photoUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <User className="size-4" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-medium">{karigar.fullName}</td>
                      <td className="numeric px-4 py-2.5 text-muted-foreground">{karigar.code}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{karigar.mobile}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{karigar.workType.name}</td>
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          disabled={!canUpdate}
                          onClick={() => statusMutation.mutate({ id: karigar.id, isActive: !karigar.isActive })}
                          className="disabled:cursor-default"
                          title={canUpdate ? `Mark ${karigar.isActive ? 'Inactive' : 'Active'}` : undefined}
                        >
                          <Badge variant={karigar.isActive ? 'success' : 'danger'}>
                            {karigar.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </button>
                      </td>
                      <td className="px-2 py-2.5">
                        <Button variant="ghost" size="icon" disabled={!canUpdate} onClick={() => onEdit(karigar)}>
                          <Pencil />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!data?.items.length ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No karigars yet.
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
