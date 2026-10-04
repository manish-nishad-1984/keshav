import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { apiClient, ApiRequestError } from '../lib/api-client';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { LoadingState } from '../components/ui/loading-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ActionMenu, type ActionMenuItem } from '../components/common/ActionMenu';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { usePermissions } from '../hooks/use-permissions';
import { PartyFormDialog, PARTIES_QUERY_KEY } from '../components/parties/PartyFormDialog';
import type { Party } from '../components/parties/party-constants';

export const PartiesPage = () => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Party | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canCreate = isSuperAdmin || hasPermission('parties:create');
  const canUpdate = isSuperAdmin || hasPermission('parties:update');
  const canDelete = isSuperAdmin || hasPermission('parties:delete');

  const { data, isLoading } = useQuery({
    queryKey: PARTIES_QUERY_KEY,
    queryFn: () => apiClient.get<Party[]>('/parties'),
  });

  const needle = search.trim().toLowerCase();
  const rows = (data ?? [])
    .filter((p) => (status === 'ACTIVE' ? p.isActive : status === 'INACTIVE' ? !p.isActive : true))
    .filter(
      (p) =>
        !needle ||
        [p.name, p.mobile, p.referenceName, p.address].some((v) => v?.toLowerCase().includes(needle)),
    );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/parties/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PARTIES_QUERY_KEY });
      setDeleteTarget(null);
    },
    onError: (err) => setDeleteError(err instanceof ApiRequestError ? err.message : 'Could not delete this party.'),
  });

  const rowActions = (party: Party): ActionMenuItem[] => [
    {
      key: 'edit',
      label: 'Edit',
      icon: <Pencil />,
      onSelect: () => {
        setEditingParty(party);
        setFormOpen(true);
      },
      disabled: !canUpdate,
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 />,
      onSelect: () => {
        setDeleteError(null);
        setDeleteTarget(party);
      },
      destructive: true,
      disabled: !canDelete,
      separatorBefore: true,
    },
  ];

  return (
    <PageLayout
      title="Party Master"
      description="Parties that cutting lots are made for."
      actions={
        canCreate ? (
          <Button
            onClick={() => {
              setEditingParty(null);
              setFormOpen(true);
            }}
          >
            <Plus />
            Add Party
          </Button>
        ) : null
      }
    >
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, mobile, reference…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <LoadingState variant="page" />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full text-left text-sm">
              <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Mobile No.</th>
                  <th className="px-4 py-2 font-medium">Reference Name</th>
                  <th className="px-4 py-2 font-medium">Address</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((party) => (
                  <tr key={party.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium">{party.name}</td>
                    <td className="numeric px-4 py-2.5 text-muted-foreground">{party.mobile ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{party.referenceName ?? '—'}</td>
                    <td className="max-w-xs truncate px-4 py-2.5 text-muted-foreground" title={party.address ?? undefined}>
                      {party.address ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={party.isActive ? 'success' : 'danger'}>{party.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <ActionMenu items={rowActions(party)} />
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      {data?.length ? 'No parties match your search.' : 'No parties yet.'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PartyFormDialog open={formOpen} onOpenChange={setFormOpen} party={editingParty} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete party"
        description={
          <>
            Delete "{deleteTarget?.name}"? This cannot be undone.
            {deleteError ? <span className="mt-2 block font-medium text-destructive">{deleteError}</span> : null}
          </>
        }
        confirmLabel="Delete"
        tone="destructive"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </PageLayout>
  );
};
