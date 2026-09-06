import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated } from '@ckfast/types';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { apiClient, ApiRequestError } from '../lib/api-client';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { LoadingState } from '../components/ui/loading-state';
import { Button } from '../components/ui/button';
import { usePermissions } from '../hooks/use-permissions';
import { ActionMenu, type ActionMenuItem } from '../components/common/ActionMenu';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { RoleFormDialog, type RoleFormValue } from '../components/roles/RoleFormDialog';

interface RoleRow extends RoleFormValue {
  isSystem: boolean;
  _count: { users: number };
}

export const RolesPage = () => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canCreate = isSuperAdmin || hasPermission('roles:create');
  const canUpdate = isSuperAdmin || hasPermission('roles:update');
  const canDelete = isSuperAdmin || hasPermission('roles:delete');

  const { data, isLoading } = useQuery({
    queryKey: ['roles', { page: 1 }],
    queryFn: () => apiClient.list<RoleRow>('/roles', { page: 1, pageSize: 50 }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/roles/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err) => {
      setDeleteError(err instanceof ApiRequestError ? err.message : 'Could not delete this role.');
    },
  });

  const rowActions = (role: RoleRow): ActionMenuItem[] => {
    const lockedForEditing = role.isSystem && !isSuperAdmin;
    return [
      {
        key: 'edit',
        label: 'Edit',
        icon: <Pencil />,
        onSelect: () => {
          setEditingRole(role);
          setFormOpen(true);
        },
        disabled: !canUpdate || lockedForEditing,
      },
      {
        key: 'delete',
        label: 'Delete',
        icon: <Trash2 />,
        onSelect: () => {
          setDeleteError(null);
          setDeleteTarget(role);
        },
        destructive: true,
        disabled: !canDelete || role.isSystem,
        separatorBefore: true,
      },
    ];
  };

  return (
    <PageLayout
      title="Roles"
      description="Permission sets assigned to users."
      actions={
        canCreate ? (
          <Button
            onClick={() => {
              setEditingRole(null);
              setFormOpen(true);
            }}
          >
            <Plus />
            Add role
          </Button>
        ) : null
      }
    >
      <Card>
        {isLoading ? (
          <LoadingState variant="page" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-4 py-2 font-medium">Users</th>
                  <th className="px-4 py-2 font-medium">Permissions</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {(data as Paginated<RoleRow> | undefined)?.items.map((role) => (
                  <tr key={role.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium">{role.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{role.description ?? '—'}</td>
                    <td className="px-4 py-2.5 numeric text-muted-foreground">{role._count.users}</td>
                    <td className="px-4 py-2.5 numeric text-muted-foreground">{role.permissions.length}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={role.isSystem ? 'info' : 'neutral'}>{role.isSystem ? 'System' : 'Custom'}</Badge>
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <ActionMenu items={rowActions(role)} />
                    </td>
                  </tr>
                ))}
                {!data?.items.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No roles yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <RoleFormDialog open={formOpen} onOpenChange={setFormOpen} role={editingRole} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
        title="Delete role"
        description={
          deleteError ?? `This permanently removes "${deleteTarget?.name ?? ''}". Users assigned to it lose these permissions.`
        }
        confirmLabel="Delete"
        tone="destructive"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </PageLayout>
  );
};
