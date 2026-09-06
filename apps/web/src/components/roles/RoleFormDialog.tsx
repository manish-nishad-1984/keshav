import { Fragment, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ACTIONS, type ActionKey, type ModuleKey } from '@ckfast/types';
import { NAV_GROUPS, MODULES } from '@ckfast/shared';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import { cn } from '../../lib/utils';

export interface RoleFormValue {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  permissions: { permission: { key: string; module: string; action: string } }[];
}

interface RoleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: RoleFormValue | null;
}

type PermissionCatalog = Partial<Record<ModuleKey, ActionKey[]>>;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const emptyForm = { name: '', slug: '', description: '', permissionKeys: new Set<string>() };

export const RoleFormDialog = ({ open, onOpenChange, role }: RoleFormDialogProps) => {
  const queryClient = useQueryClient();
  const isEdit = Boolean(role);
  const [form, setForm] = useState(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: catalog } = useQuery({
    queryKey: ['roles', 'permission-catalog'],
    queryFn: () => apiClient.get<PermissionCatalog>('/roles/permission-catalog'),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSlugTouched(isEdit);
    setForm(
      role
        ? {
            name: role.name,
            slug: role.slug,
            description: role.description ?? '',
            permissionKeys: new Set(role.permissions.map((p) => p.permission.key)),
          }
        : emptyForm,
    );
  }, [open, role, isEdit]);

  const groupedModules = useMemo(() => {
    if (!catalog) return [];
    return NAV_GROUPS.map((group) => ({
      group,
      modules: MODULES.filter((m) => m.group === group.key && catalog[m.key]).sort((a, b) => a.order - b.order),
    })).filter((g) => g.modules.length > 0);
  }, [catalog]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        slug: form.slug,
        description: form.description || undefined,
        permissionKeys: [...form.permissionKeys],
      };
      if (isEdit && role) {
        const { slug: _slug, ...updatePayload } = payload;
        return apiClient.patch(`/roles/${role.id}`, updatePayload);
      }
      return apiClient.post('/roles', payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roles'] });
      onOpenChange(false);
    },
    onError: (err) => {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');
    },
  });

  const togglePermission = (key: string) => {
    setForm((current) => {
      const next = new Set(current.permissionKeys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...current, permissionKeys: next };
    });
  };

  const toggleRow = (moduleKey: ModuleKey, actions: ActionKey[], checked: boolean) => {
    setForm((current) => {
      const next = new Set(current.permissionKeys);
      for (const action of actions) {
        const key = `${moduleKey}:${action}`;
        if (checked) next.add(key);
        else next.delete(key);
      }
      return { ...current, permissionKeys: next };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit role' : 'Add role'}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <DialogBody>
            {error ? <FormAlert tone="error">{error}</FormAlert> : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Name" required>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
                  }}
                />
              </FormField>
              <FormField label="Slug" required hint="Lowercase letters, numbers and underscores.">
                <Input
                  required
                  disabled={isEdit}
                  pattern="^[a-z0-9_]+$"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm((f) => ({ ...f, slug: e.target.value }));
                  }}
                />
              </FormField>
              <FormField label="Description" className="sm:col-span-2">
                <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </FormField>
            </div>

            <div className="space-y-2">
              <p className="section-label">Permissions</p>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/40 text-2xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Module</th>
                      {ACTIONS.map((action) => (
                        <th key={action} className="px-2 py-2 text-center font-medium capitalize">
                          {action}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedModules.map(({ group, modules }) => (
                      <Fragment key={group.key}>
                        <tr className="bg-muted/20">
                          <td colSpan={ACTIONS.length + 1} className="px-3 py-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {group.label}
                          </td>
                        </tr>
                        {modules.map((module) => {
                          const moduleActions = catalog?.[module.key] ?? [];
                          const allChecked = moduleActions.every((a) => form.permissionKeys.has(`${module.key}:${a}`));
                          const someChecked = moduleActions.some((a) => form.permissionKeys.has(`${module.key}:${a}`));
                          return (
                            <tr key={module.key} className="border-b border-border last:border-0">
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={`module-${module.key}`}
                                    checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                                    onCheckedChange={(checked) => toggleRow(module.key, moduleActions, checked === true)}
                                  />
                                  <Label htmlFor={`module-${module.key}`} className="cursor-pointer">
                                    {module.label}
                                  </Label>
                                </div>
                              </td>
                              {ACTIONS.map((action) => {
                                const available = moduleActions.includes(action);
                                const key = `${module.key}:${action}`;
                                return (
                                  <td key={action} className={cn('px-2 py-2 text-center', !available && 'bg-muted/30')}>
                                    {available ? (
                                      <Checkbox
                                        checked={form.permissionKeys.has(key)}
                                        onCheckedChange={() => togglePermission(key)}
                                      />
                                    ) : null}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEdit ? 'Save changes' : 'Create role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
