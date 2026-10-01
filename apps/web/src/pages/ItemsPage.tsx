import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, Settings2, ImageOff } from 'lucide-react';
import { apiClient, resolvePhotoUrl } from '../lib/api-client';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { LoadingState } from '../components/ui/loading-state';
import { Pagination } from '../components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ActionMenu, type ActionMenuItem } from '../components/common/ActionMenu';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { usePermissions } from '../hooks/use-permissions';
import { ItemFormDialog } from '../components/items/ItemFormDialog';
import { CategoryManagerDialog } from '../components/items/CategoryManagerDialog';
import type { Item, ItemCategory } from '../components/items/item-constants';

export const ItemsPage = () => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('ALL');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  const canCreate = isSuperAdmin || hasPermission('items:create');
  const canUpdate = isSuperAdmin || hasPermission('items:update');
  const canDelete = isSuperAdmin || hasPermission('items:delete');
  const canManageCategories = isSuperAdmin || hasPermission('items:manage');

  const { data: categories } = useQuery({
    queryKey: ['item-categories'],
    queryFn: () => apiClient.get<ItemCategory[]>('/items/categories'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['items', { page, search, categoryId }],
    queryFn: () =>
      apiClient.list<Item>('/items', {
        page,
        pageSize: 8,
        search: search || undefined,
        categoryId: categoryId === 'ALL' ? undefined : categoryId,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/items/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] });
      setDeleteTarget(null);
    },
  });

  const rowActions = (item: Item): ActionMenuItem[] => [
    {
      key: 'edit',
      label: 'Edit',
      icon: <Pencil />,
      onSelect: () => {
        setEditingItem(item);
        setFormOpen(true);
      },
      disabled: !canUpdate,
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 />,
      onSelect: () => setDeleteTarget(item),
      destructive: true,
      disabled: !canDelete,
      separatorBefore: true,
    },
  ];

  return (
    <PageLayout
      title="Item / Design Master"
      actions={
        <div className="flex items-center gap-2">
          {canManageCategories ? (
            <Button variant="outline" onClick={() => setCategoryManagerOpen(true)}>
              <Settings2 />
              Manage Categories
            </Button>
          ) : null}
          {canCreate ? (
            <Button
              onClick={() => {
                setEditingItem(null);
                setFormOpen(true);
              }}
            >
              <Plus />
              Add Item
            </Button>
          ) : null}
        </div>
      }
    >
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search item or style no…"
              className="pl-8"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
          <Select
            value={categoryId}
            onValueChange={(v) => {
              setPage(1);
              setCategoryId(v);
            }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Category</SelectItem>
              {categories?.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
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
                  <th className="px-4 py-2 font-medium">Style No.</th>
                  <th className="px-4 py-2 font-medium">Item Name</th>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {data?.items.map((item) => {
                  const photoUrl = resolvePhotoUrl(item.photoUrl);
                  return (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">
                        <div className="flex size-9 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-muted-foreground">
                          {photoUrl ? (
                            <img src={photoUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <ImageOff className="size-4" />
                          )}
                        </div>
                      </td>
                      <td className="numeric px-4 py-2.5 text-muted-foreground">{item.styleNo}</td>
                      <td className="px-4 py-2.5 font-medium">{item.itemName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{item.category.name}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={item.isActive ? 'success' : 'danger'}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <ActionMenu items={rowActions(item)} />
                      </td>
                    </tr>
                  );
                })}
                {!data?.items.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No items yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        {data ? <Pagination meta={data.pagination} onPageChange={setPage} className="border-t border-border" /> : null}
      </Card>

      <ItemFormDialog open={formOpen} onOpenChange={setFormOpen} item={editingItem} />
      <CategoryManagerDialog open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete item"
        description={`Delete "${deleteTarget?.itemName}" (${deleteTarget?.styleNo})? This cannot be undone.`}
        confirmLabel="Delete"
        tone="destructive"
        isSubmitting={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </PageLayout>
  );
};
