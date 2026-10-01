import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { PasswordInput } from '../ui/password-input';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';

interface RoleOption {
  id: string;
  name: string;
}

export interface UserFormValue {
  id: string;
  fullName: string;
  email: string;
  mobile: string | null;
  employeeCode: string | null;
  designation: string | null;
  roles: { role: { id: string } }[];
}

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserFormValue | null;
}

const emptyForm = {
  fullName: '',
  email: '',
  mobile: '',
  employeeCode: '',
  designation: '',
  password: '',
  roleIds: [] as string[],
};

export const UserFormDialog = ({ open, onOpenChange, user }: UserFormDialogProps) => {
  const queryClient = useQueryClient();
  const isEdit = Boolean(user);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);

  const { data: roleOptions } = useQuery({
    queryKey: ['roles', 'options'],
    queryFn: () => apiClient.list<RoleOption>('/roles', { page: 1, pageSize: 100 }),
    enabled: open,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      user
        ? {
            fullName: user.fullName,
            email: user.email,
            mobile: user.mobile ?? '',
            employeeCode: user.employeeCode ?? '',
            designation: user.designation ?? '',
            password: '',
            roleIds: user.roles.map((r) => r.role.id),
          }
        : emptyForm,
    );
  }, [open, user]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        fullName: form.fullName,
        mobile: form.mobile || undefined,
        employeeCode: form.employeeCode || undefined,
        designation: form.designation || undefined,
        roleIds: form.roleIds,
      };
      if (isEdit && user) {
        return apiClient.patch(`/users/${user.id}`, payload);
      }
      return apiClient.post('/users', { ...payload, email: form.email, password: form.password });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false);
    },
    onError: (err) => {
      setError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');
    },
  });

  const toggleRole = (roleId: string) => {
    setForm((current) => ({
      ...current,
      roleIds: current.roleIds.includes(roleId)
        ? current.roleIds.filter((id) => id !== roleId)
        : [...current.roleIds, roleId],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit user' : 'Add user'}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <DialogBody>
            {error ? <FormAlert tone="error">{error}</FormAlert> : null}

            <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
              <FormField label="Full name" required>
                <Input
                  required
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              </FormField>
              <FormField label="Email" required hint={isEdit ? 'Email cannot be changed.' : undefined}>
                <Input
                  type="email"
                  required
                  disabled={isEdit}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </FormField>
              <FormField label="Mobile">
                <Input value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} />
              </FormField>
              <FormField label="Employee code">
                <Input
                  value={form.employeeCode}
                  onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))}
                />
              </FormField>
              <FormField label="Designation" className={isEdit ? 'sm:col-span-2' : undefined}>
                <Input
                  value={form.designation}
                  onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                />
              </FormField>
              {!isEdit ? (
                <FormField label="Initial password" required hint="At least 8 characters.">
                  <PasswordInput
                    required
                    minLength={8}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                </FormField>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Roles</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-md border border-border p-3">
                {roleOptions?.items.length ? (
                  roleOptions.items.map((role) => (
                    <div key={role.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={form.roleIds.includes(role.id)}
                        onCheckedChange={() => toggleRole(role.id)}
                      />
                      <Label htmlFor={`role-${role.id}`} className="cursor-pointer font-normal">
                        {role.name}
                      </Label>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">No roles yet — create one first.</p>
                )}
              </div>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEdit ? 'Save changes' : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
