import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { usePermissions } from '../../hooks/use-permissions';
import type { WorkType } from '../karigars/karigar-constants';

export const WorkTypeTab = () => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canManage = isSuperAdmin || hasPermission('karigars:manage');

  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WorkType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: workTypes } = useQuery({
    queryKey: ['work-types'],
    queryFn: () => apiClient.get<WorkType[]>('/karigars/work-types'),
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['work-types'] });

  const createMutation = useMutation({
    mutationFn: () => apiClient.post('/karigars/work-types', { name: newName }),
    onSuccess: () => {
      setNewName('');
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Could not create work type.'),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiClient.patch(`/karigars/work-types/${id}`, { name }),
    onSuccess: () => {
      setRenamingId(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Could not rename work type.'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/karigars/work-types/${id}`, { isActive }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/karigars/work-types/${id}`),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Could not delete work type.'),
  });

  return (
    <>
      <Card>
        <CardContent className="space-y-4">
          {error ? <FormAlert tone="error">{error}</FormAlert> : null}

          {canManage ? (
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
            >
              <FormField label="Work type name" className="flex-1 max-w-xs">
                <Input required value={newName} onChange={(e) => setNewName(e.target.value)} />
              </FormField>
              <Button type="submit" loading={createMutation.isPending}>
                <Plus />
                Add
              </Button>
            </form>
          ) : null}

          <div className="divide-y divide-border rounded-md border border-border">
            {workTypes?.length ? (
              workTypes.map((workType) => (
                <div key={workType.id} className="flex items-center gap-2 px-3 py-2">
                  {renamingId === workType.id ? (
                    <>
                      <Input
                        autoFocus
                        className="h-8 flex-1"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => renameMutation.mutate({ id: workType.id, name: renameValue })}
                      >
                        <Check />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setRenamingId(null)} aria-label="Cancel">
                        <X />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{workType.name}</span>
                      <button
                        type="button"
                        disabled={!canManage}
                        onClick={() => toggleActiveMutation.mutate({ id: workType.id, isActive: !workType.isActive })}
                      >
                        <Badge variant={workType.isActive ? 'success' : 'danger'}>
                          {workType.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </button>
                      {canManage ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setRenamingId(workType.id);
                              setRenameValue(workType.name);
                            }}
                           aria-label="Edit">
                            <Pencil />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteTarget(workType)} aria-label="Delete">
                            <Trash2 />
                          </Button>
                        </>
                      ) : null}
                    </>
                  )}
                </div>
              ))
            ) : (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">No work types yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete work type"
        description={`Delete "${deleteTarget?.name}"? Work types still assigned to a karigar cannot be deleted.`}
        confirmLabel="Delete"
        tone="destructive"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </>
  );
};
