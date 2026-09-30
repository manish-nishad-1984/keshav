import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated } from '@ckfast/types';
import { Plus, Search, KeyRound, Pencil, Ban, CheckCircle2, Trash2 } from 'lucide-react';
import { apiClient, ApiRequestError } from '../lib/api-client';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { StatusBadge } from '../components/ui/status-badge';
import { Badge } from '../components/ui/badge';
import { LoadingState } from '../components/ui/loading-state';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { usePermissions } from '../hooks/use-permissions';
import { ActionMenu, type ActionMenuItem } from '../components/common/ActionMenu';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { UserFormDialog, type UserFormValue } from '../components/users/UserFormDialog';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { formatDateTime } from '../lib/date';

interface UserRow extends UserFormValue {
  status: string;
  lastLoginAt: string | null;
  roles: { role: { id: string; name: string } }[];
}

export const UsersPage = () => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ user: UserRow; next: 'ACTIVE' | 'SUSPENDED' } | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);

  const canCreate = isSuperAdmin || hasPermission('users:create');
  const canUpdate = isSuperAdmin || hasPermission('users:update');
  const canDelete = isSuperAdmin || hasPermission('users:delete');

  const { data, isLoading } = useQuery({
    queryKey: ['users', { search }],
    queryFn: () => apiClient.list<UserRow>('/users', { page: 1, pageSize: 50, search: search || undefined }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/users/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteTarget(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'SUSPENDED' }) =>
      apiClient.patch(`/users/${id}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      setStatusTarget(null);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string) => apiClient.post<{ temporaryPassword: string }>(`/users/${id}/reset-password`),
    onSuccess: (result) => setTemporaryPassword(result.temporaryPassword),
  });

  const rowActions = (user: UserRow): ActionMenuItem[] => [
    {
      key: 'edit',
      label: 'Edit',
      icon: <Pencil />,
      onSelect: () => {
        setEditingUser(user);
        setFormOpen(true);
      },
      disabled: !canUpdate,
    },
    {
      key: 'reset-password',
      label: 'Reset password',
      icon: <KeyRound />,
      onSelect: () => resetPasswordMutation.mutate(user.id),
      disabled: !canUpdate,
    },
    user.status === 'SUSPENDED' || user.status === 'DISABLED'
      ? {
          key: 'reactivate',
          label: 'Reactivate',
          icon: <CheckCircle2 />,
          onSelect: () => setStatusTarget({ user, next: 'ACTIVE' }),
          disabled: !canUpdate,
        }
      : {
          key: 'suspend',
          label: 'Suspend',
          icon: <Ban />,
          onSelect: () => setStatusTarget({ user, next: 'SUSPENDED' }),
          disabled: !canUpdate,
        },
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 />,
      onSelect: () => setDeleteTarget(user),
      destructive: true,
      disabled: !canDelete,
      separatorBefore: true,
    },
  ];

  return (
    <PageLayout
      title="Users"
      description="People with access to this organization."
      actions={
        canCreate ? (
          <Button
            onClick={() => {
              setEditingUser(null);
              setFormOpen(true);
            }}
          >
            <Plus />
            Add user
          </Button>
        ) : null
      }
    >
      <Card>
        <div className="flex items-center border-b border-border px-4 py-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Email / mobile</th>
                  <th className="px-4 py-2 font-medium">Roles</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Last login</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {(data as Paginated<UserRow> | undefined)?.items.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{user.fullName}</p>
                      {user.designation ? <p className="text-2xs text-muted-foreground">{user.designation}</p> : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      <p>{user.email}</p>
                      {user.mobile ? <p className="text-2xs">{user.mobile}</p> : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {user.roles.length ? (
                          user.roles.map((r) => (
                            <Badge key={r.role.id} variant="muted">
                              {r.role.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <ActionMenu items={rowActions(user)} />
                    </td>
                  </tr>
                ))}
                {!data?.items.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No users yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} user={editingUser} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete user"
        description={`This removes ${deleteTarget?.fullName ?? 'this user'}'s access. This cannot be undone.`}
        confirmLabel="Delete"
        tone="destructive"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        title={statusTarget?.next === 'SUSPENDED' ? 'Suspend user' : 'Reactivate user'}
        description={
          statusTarget?.next === 'SUSPENDED'
            ? `${statusTarget.user.fullName} will be signed out everywhere and unable to sign in again until reactivated.`
            : `${statusTarget?.user.fullName} will be able to sign in again.`
        }
        confirmLabel={statusTarget?.next === 'SUSPENDED' ? 'Suspend' : 'Reactivate'}
        tone={statusTarget?.next === 'SUSPENDED' ? 'destructive' : 'default'}
        isSubmitting={statusMutation.isPending}
        onConfirm={() => statusTarget && statusMutation.mutate({ id: statusTarget.user.id, status: statusTarget.next })}
      />

      <Dialog open={Boolean(temporaryPassword)} onOpenChange={(open) => !open && setTemporaryPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription>
              Share this with the user securely — it won't be shown again. They'll be asked to set a new password on
              next sign-in.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="numeric rounded-md border border-border bg-muted px-3 py-2 text-center text-sm">
              {temporaryPassword}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button onClick={() => setTemporaryPassword(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {resetPasswordMutation.isError ? (
        <p className="text-2xs text-destructive">
          {resetPasswordMutation.error instanceof ApiRequestError
            ? resetPasswordMutation.error.message
            : 'Could not reset password.'}
        </p>
      ) : null}
    </PageLayout>
  );
};
