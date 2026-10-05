import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { FormAlert } from '../ui/form-alert';
import type { Size } from './cutting-constants';

export const SIZES_QUERY_KEY = ['cutting-sizes'] as const;

interface SizeManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Size Master: the columns of the cutting grid. Name + optional detail (e.g. "S" / "38/28"),
// order (arrows swap neighbours' sortOrder) and active flag. Edits save on blur.
export const SizeManagerDialog = ({ open, onOpenChange }: SizeManagerDialogProps) => {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [newSize, setNewSize] = useState({ name: '', detail: '' });

  const { data: sizes } = useQuery({
    queryKey: SIZES_QUERY_KEY,
    queryFn: () => apiClient.get<Size[]>('/cutting/sizes'),
    enabled: open,
  });

  const onError = (err: unknown) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong.');
  const refresh = () => {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: SIZES_QUERY_KEY });
  };

  const create = useMutation({
    mutationFn: () => apiClient.post('/cutting/sizes', newSize),
    onSuccess: () => {
      setNewSize({ name: '', detail: '' });
      refresh();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Size> }) => apiClient.patch(`/cutting/sizes/${id}`, data),
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/cutting/sizes/${id}`),
    onSuccess: refresh,
    onError,
  });

  const list = sizes ?? [];
  const move = (index: number, delta: -1 | 1) => {
    const a = list[index];
    const b = list[index + delta];
    if (!a || !b) return;
    // Swap positions; if two sizes share an order number, nudge so the swap is visible.
    const aOrder = b.sortOrder === a.sortOrder ? a.sortOrder + delta : b.sortOrder;
    update.mutate({ id: a.id, data: { sortOrder: Math.max(0, aOrder) } });
    update.mutate({ id: b.id, data: { sortOrder: a.sortOrder } });
  };
  const saveIfChanged = (size: Size, field: 'name' | 'detail', value: string) => {
    const trimmed = value.trim();
    if (trimmed === (size[field] ?? '')) return;
    if (field === 'name' && !trimmed) return;
    update.mutate({ id: size.id, data: { [field]: trimmed } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Size Master</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {error ? <FormAlert tone="error">{error}</FormAlert> : null}
          <p className="text-xs text-muted-foreground">
            These are the size columns of the cutting grid, in this order. Inactive sizes are hidden from new entries.
          </p>

          <div className="overflow-x-auto rounded-md border border-border">
            <table className="data-table w-full text-left text-sm">
              <thead className="border-b border-border text-2xs uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Detail</th>
                  <th className="px-3 py-2 text-center">Active</th>
                  <th className="px-3 py-2 text-right">Order</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {list.map((size, index) => (
                  <tr key={size.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5">
                      <Input
                        aria-label="Size name"
                        defaultValue={size.name}
                        className="h-8 w-24 font-medium"
                        onBlur={(e) => saveIfChanged(size, 'name', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <Input
                        aria-label={`Detail for ${size.name}`}
                        placeholder="e.g. 38/28"
                        defaultValue={size.detail ?? ''}
                        className="h-8 w-32"
                        onBlur={(e) => saveIfChanged(size, 'detail', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <Checkbox
                        aria-label={`${size.name} active`}
                        checked={size.isActive}
                        onCheckedChange={(checked) => update.mutate({ id: size.id, data: { isActive: checked === true } })}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex justify-end gap-0.5">
                        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Move ${size.name} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                          <ArrowUp />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Move ${size.name} down`} disabled={index === list.length - 1} onClick={() => move(index, 1)}>
                          <ArrowDown />
                        </Button>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 hover:text-destructive"
                        aria-label={`Delete ${size.name}`}
                        onClick={() => remove.mutate(size.id)}
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
                {!list.length ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      No sizes yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (newSize.name.trim()) create.mutate();
            }}
          >
            <Input
              aria-label="New size name"
              placeholder="Size (e.g. 6XL)"
              className="w-32"
              value={newSize.name}
              onChange={(e) => setNewSize((s) => ({ ...s, name: e.target.value }))}
            />
            <Input
              aria-label="New size detail"
              placeholder="Detail (e.g. 54/44)"
              className="w-40"
              value={newSize.detail}
              onChange={(e) => setNewSize((s) => ({ ...s, detail: e.target.value }))}
            />
            <Button type="submit" variant="outline" loading={create.isPending} disabled={!newSize.name.trim()}>
              <Plus />
              Add Size
            </Button>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
