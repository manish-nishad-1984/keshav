import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import { ConfirmDialog } from './ConfirmDialog';

interface SimpleMasterItem {
  id: string;
  name: string;
  isActive: boolean;
}

interface SimpleMasterManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  itemLabel: string;
  apiBasePath: string;
  queryKey: string;
  extraInvalidateQueryKeys?: string[];
}

// A reusable manager for any master that's just { name, isActive } — Pattern Type and Color both
// have this exact shape, same as WorkType/ItemCategory before them. Rather than copy-pasting the
// list-row-with-inline-rename UI a further time, this is the shared version; WorkTypeTab and
// CategoryManagerDialog predate it and weren't retrofitted (different container: Card vs Dialog).
export const SimpleMasterManagerDialog = ({
  open,
  onOpenChange,
  title,
  itemLabel,
  apiBasePath,
  queryKey,
  extraInvalidateQueryKeys = [],
}: SimpleMasterManagerDialogProps) => {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SimpleMasterItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: items } = useQuery({
    queryKey: [queryKey],
    queryFn: () => apiClient.get<SimpleMasterItem[]>(apiBasePath),
    enabled: open,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [queryKey] });
    extraInvalidateQueryKeys.forEach((k) => void queryClient.invalidateQueries({ queryKey: [k] }));
  };

  const createMutation = useMutation({
    mutationFn: () => apiClient.post(apiBasePath, { name: newName }),
    onSuccess: () => {
      setNewName('');
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : `Could not create ${itemLabel.toLowerCase()}.`),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiClient.patch(`${apiBasePath}/${id}`, { name }),
    onSuccess: () => {
      setRenamingId(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : `Could not rename ${itemLabel.toLowerCase()}.`),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`${apiBasePath}/${id}`, { isActive }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`${apiBasePath}/${id}`),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : `Could not delete ${itemLabel.toLowerCase()}.`),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {error ? <FormAlert tone="error">{error}</FormAlert> : null}

            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
            >
              <FormField label={`${itemLabel} name`} className="flex-1">
                <Input required value={newName} onChange={(e) => setNewName(e.target.value)} />
              </FormField>
              <Button type="submit" loading={createMutation.isPending}>
                <Plus />
                Add
              </Button>
            </form>

            <div className="mt-4 divide-y divide-border rounded-md border border-border">
              {items?.length ? (
                items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                    {renamingId === item.id ? (
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
                          onClick={() => renameMutation.mutate({ id: item.id, name: renameValue })}
                        >
                          <Check />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setRenamingId(null)}>
                          <X />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-medium">{item.name}</span>
                        <button
                          type="button"
                          onClick={() => toggleActiveMutation.mutate({ id: item.id, isActive: !item.isActive })}
                        >
                          <Badge variant={item.isActive ? 'success' : 'danger'}>
                            {item.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setRenamingId(item.id);
                            setRenameValue(item.name);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteTarget(item)}>
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">No {itemLabel.toLowerCase()}s yet.</p>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${itemLabel.toLowerCase()}`}
        description={`Delete "${deleteTarget?.name}"? ${itemLabel}s still in use elsewhere cannot be deleted.`}
        confirmLabel="Delete"
        tone="destructive"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </>
  );
};
