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
import { ConfirmDialog } from '../common/ConfirmDialog';
import type { ItemCategory } from './item-constants';

interface CategoryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CategoryManagerDialog = ({ open, onOpenChange }: CategoryManagerDialogProps) => {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ItemCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ['item-categories'],
    queryFn: () => apiClient.get<ItemCategory[]>('/items/categories'),
    enabled: open,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['item-categories'] });
    void queryClient.invalidateQueries({ queryKey: ['items'] });
  };

  const createMutation = useMutation({
    mutationFn: () => apiClient.post('/items/categories', { name: newName, prefix: newPrefix }),
    onSuccess: () => {
      setNewName('');
      setNewPrefix('');
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Could not create category.'),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiClient.patch(`/items/categories/${id}`, { name }),
    onSuccess: () => {
      setRenamingId(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Could not rename category.'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/items/categories/${id}`, { isActive }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/items/categories/${id}`),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Could not delete category.'),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Manage categories</DialogTitle>
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
              <FormField label="Category name" className="flex-1">
                <Input required value={newName} onChange={(e) => setNewName(e.target.value)} />
              </FormField>
              <FormField label="Prefix" hint="e.g. TS" className="w-28">
                <Input
                  required
                  maxLength={6}
                  className="uppercase"
                  value={newPrefix}
                  onChange={(e) => setNewPrefix(e.target.value.toUpperCase())}
                />
              </FormField>
              <Button type="submit" loading={createMutation.isPending}>
                <Plus />
                Add
              </Button>
            </form>

            <div className="mt-4 divide-y divide-border rounded-md border border-border">
              {categories?.length ? (
                categories.map((category) => (
                  <div key={category.id} className="flex items-center gap-2 px-3 py-2">
                    {renamingId === category.id ? (
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
                          onClick={() => renameMutation.mutate({ id: category.id, name: renameValue })}
                        >
                          <Check />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setRenamingId(null)} aria-label="Cancel">
                          <X />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-medium">{category.name}</span>
                        <Badge variant="muted">{category.prefix}</Badge>
                        <button
                          type="button"
                          onClick={() => toggleActiveMutation.mutate({ id: category.id, isActive: !category.isActive })}
                        >
                          <Badge variant={category.isActive ? 'success' : 'danger'}>
                            {category.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setRenamingId(category.id);
                            setRenameValue(category.name);
                          }}
                         aria-label="Edit">
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(category)}
                         aria-label="Delete">
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">No categories yet.</p>
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
        title="Delete category"
        description={`Delete "${deleteTarget?.name}"? Categories with items still assigned to them cannot be deleted.`}
        confirmLabel="Delete"
        tone="destructive"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </>
  );
};
