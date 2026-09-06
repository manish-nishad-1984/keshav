import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings2 } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { PhotoUpload } from '../common/PhotoUpload';
import { CategoryManagerDialog } from './CategoryManagerDialog';
import type { Item, ItemCategory } from './item-constants';

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
}

const emptyForm = { categoryId: '', itemName: '', photoUrl: null as string | null };

export const ItemFormDialog = ({ open, onOpenChange, item }: ItemFormDialogProps) => {
  const queryClient = useQueryClient();
  const isEdit = Boolean(item);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ['item-categories'],
    queryFn: () => apiClient.get<ItemCategory[]>('/items/categories'),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      item
        ? { categoryId: item.categoryId, itemName: item.itemName, photoUrl: item.photoUrl }
        : emptyForm,
    );
  }, [open, item]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        categoryId: form.categoryId,
        itemName: form.itemName,
        photoUrl: form.photoUrl ?? undefined,
      };
      if (isEdit && item) {
        return apiClient.patch(`/items/${item.id}`, payload);
      }
      return apiClient.post('/items', payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      onOpenChange(false);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.'),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit item' : 'Add item'}</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <DialogBody className="space-y-4">
              {error ? <FormAlert tone="error">{error}</FormAlert> : null}

              <PhotoUpload value={form.photoUrl} onChange={(url) => setForm((f) => ({ ...f, photoUrl: url }))} />

              {isEdit ? (
                <FormField label="Style No.">
                  <Input disabled value={item?.styleNo ?? ''} className="numeric" />
                </FormField>
              ) : null}

              <FormField
                label="Category"
                required
                hint={isEdit ? undefined : 'The style number is generated automatically from the category prefix.'}
              >
                <div className="flex items-center gap-2">
                  <Select
                    value={form.categoryId}
                    onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name} ({category.prefix})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => setCategoryManagerOpen(true)}>
                    <Settings2 />
                  </Button>
                </div>
              </FormField>

              <FormField label="Item Name" required>
                <Input
                  required
                  value={form.itemName}
                  onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value }))}
                />
              </FormField>
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={mutation.isPending} disabled={!form.categoryId}>
                {isEdit ? 'Save changes' : 'Add item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CategoryManagerDialog open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} />
    </>
  );
};
