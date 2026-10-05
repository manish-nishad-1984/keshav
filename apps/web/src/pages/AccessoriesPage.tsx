import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { apiClient, ApiRequestError } from '../lib/api-client';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { FormAlert } from '../components/ui/form-alert';
import { LoadingState } from '../components/ui/loading-state';
import { usePermissions } from '../hooks/use-permissions';
import { DesignAccessoriesDialog } from '../components/accessories/DesignAccessoriesDialog';
import type { Accessory, DesignWithAccessories } from '../components/accessories/accessory-constants';
import { ACCESSORIES_QUERY_KEY, ACCESSORY_DESIGNS_QUERY_KEY, formatAmount } from '../components/accessories/accessory-constants';

// Accessory Master: the accessory list (left) and what each design needs per piece (right).
export const AccessoriesPage = () => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canManage = isSuperAdmin || hasPermission('accessories:manage');
  const [error, setError] = useState<string | null>(null);
  const [newAccessory, setNewAccessory] = useState({ name: '', unit: 'pcs' });
  const [editing, setEditing] = useState<DesignWithAccessories | null>(null);

  const { data: accessories, isLoading } = useQuery({
    queryKey: ACCESSORIES_QUERY_KEY,
    queryFn: () => apiClient.get<Accessory[]>('/accessories'),
  });
  const { data: designs, isLoading: designsLoading } = useQuery({
    queryKey: ACCESSORY_DESIGNS_QUERY_KEY,
    queryFn: () => apiClient.get<DesignWithAccessories[]>('/accessories/designs'),
  });

  const onError = (err: unknown) => setError(err instanceof ApiRequestError ? err.message : 'Something went wrong.');
  const refresh = () => {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: ACCESSORIES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: ACCESSORY_DESIGNS_QUERY_KEY });
  };

  const create = useMutation({
    mutationFn: () => apiClient.post('/accessories', newAccessory),
    onSuccess: () => {
      setNewAccessory({ name: '', unit: 'pcs' });
      refresh();
    },
    onError,
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Accessory> }) => apiClient.patch(`/accessories/${id}`, data),
    onSuccess: refresh,
    onError,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/accessories/${id}`),
    onSuccess: refresh,
    onError,
  });

  const saveIfChanged = (accessory: Accessory, field: 'name' | 'unit', value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === accessory[field]) return;
    update.mutate({ id: accessory.id, data: { [field]: trimmed } });
  };

  const list = accessories ?? [];

  return (
    <PageLayout title="Accessory Master" description="Zips, locks, chains… and how many each design needs per piece.">
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Accessories</h2>
          </div>
          {isLoading ? (
            <LoadingState />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full text-left text-sm">
                <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Unit</th>
                    <th className="px-4 py-2 text-center font-medium">Active</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-1.5">
                        {canManage ? (
                          <Input aria-label="Accessory name" defaultValue={a.name} className="h-8 font-medium" onBlur={(e) => saveIfChanged(a, 'name', e.target.value)} />
                        ) : (
                          <span className="font-medium">{a.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-1.5">
                        {canManage ? (
                          <Input aria-label={`Unit for ${a.name}`} defaultValue={a.unit} className="h-8 w-24" onBlur={(e) => saveIfChanged(a, 'unit', e.target.value)} />
                        ) : (
                          a.unit
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-center">
                        <Checkbox
                          aria-label={`${a.name} active`}
                          checked={a.isActive}
                          disabled={!canManage}
                          onCheckedChange={(checked) => update.mutate({ id: a.id, data: { isActive: checked === true } })}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {canManage ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 hover:text-destructive"
                            aria-label={`Delete ${a.name}`}
                            onClick={() => remove.mutate(a.id)}
                          >
                            <Trash2 />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {!list.length ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                        No accessories yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
          {canManage ? (
            <form
              className="flex flex-wrap items-end gap-2 border-t border-border px-4 py-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (newAccessory.name.trim()) create.mutate();
              }}
            >
              <Input
                aria-label="New accessory name"
                placeholder="Name (e.g. Zip)"
                className="min-w-0 flex-1"
                value={newAccessory.name}
                onChange={(e) => setNewAccessory((s) => ({ ...s, name: e.target.value }))}
              />
              <Input
                aria-label="New accessory unit"
                placeholder="Unit"
                className="w-24"
                value={newAccessory.unit}
                onChange={(e) => setNewAccessory((s) => ({ ...s, unit: e.target.value }))}
              />
              <Button type="submit" variant="outline" loading={create.isPending} disabled={!newAccessory.name.trim() || !newAccessory.unit.trim()}>
                <Plus />
                Add
              </Button>
            </form>
          ) : null}
        </Card>

        <Card>
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Per piece, by design</h2>
            <p className="text-xs text-muted-foreground">A karigar's accessory limit = pieces of the lot they took × these.</p>
          </div>
          {designsLoading ? (
            <LoadingState />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table w-full text-left text-sm">
                <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Design</th>
                    <th className="px-4 py-2 font-medium">Accessories per piece</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {designs?.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium">
                        {d.itemName}
                        {d.isActive ? null : <span className="ml-1.5 text-2xs font-normal text-muted-foreground">inactive</span>}
                      </td>
                      <td className="px-4 py-2">
                        {d.accessories.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {d.accessories.map((a) => (
                              <span key={a.id} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                                {a.accessory.name} <span className="numeric font-semibold">{formatAmount(a.quantityPerPiece)}</span>{' '}
                                <span className="text-muted-foreground">{a.accessory.unit}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set — no accessories can be issued for this design</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {canManage ? (
                          <Button variant="ghost" size="icon" aria-label={`Set accessories for ${d.itemName}`} onClick={() => setEditing(d)}>
                            <Pencil />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {!designs?.length ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                        No designs yet. Add them in Item / Design Master.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <DesignAccessoriesDialog design={editing} accessories={list} onOpenChange={(open) => !open && setEditing(null)} />
    </PageLayout>
  );
};
