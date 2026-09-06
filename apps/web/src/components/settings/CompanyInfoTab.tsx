import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import { LoadingState } from '../ui/loading-state';
import { PhotoUpload } from '../common/PhotoUpload';
import { usePermissions } from '../../hooks/use-permissions';

interface OrganizationDto {
  name: string;
  ownerName: string | null;
  gstNumber: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  logoUrl: string | null;
}

export const CompanyInfoTab = () => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canUpdate = isSuperAdmin || hasPermission('company_settings:update');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: '',
    ownerName: '',
    gstNumber: '',
    email: '',
    phone: '',
    addressLine1: '',
    logoUrl: null as string | null,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: () => apiClient.get<OrganizationDto>('/organization'),
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.name,
      ownerName: data.ownerName ?? '',
      gstNumber: data.gstNumber ?? '',
      email: data.email ?? '',
      phone: data.phone ?? '',
      addressLine1: data.addressLine1 ?? '',
      logoUrl: data.logoUrl,
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.patch('/organization', {
        name: form.name,
        ownerName: form.ownerName || undefined,
        gstNumber: form.gstNumber || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        addressLine1: form.addressLine1 || undefined,
        logoUrl: form.logoUrl,
      }),
    onSuccess: () => {
      setError(null);
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['organization'] });
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Could not save company info.'),
  });

  if (isLoading) {
    return (
      <Card>
        <LoadingState variant="page" />
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {error ? <FormAlert tone="error">{error}</FormAlert> : null}
          {saved ? <FormAlert tone="success">Company information saved.</FormAlert> : null}

          <FormField label="Logo">
            <PhotoUpload value={form.logoUrl} onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))} />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Company Name" required>
              <Input
                required
                disabled={!canUpdate}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </FormField>
            <FormField label="Owner Name">
              <Input
                disabled={!canUpdate}
                value={form.ownerName}
                onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
              />
            </FormField>
            <FormField label="GST Number">
              <Input
                disabled={!canUpdate}
                value={form.gstNumber}
                onChange={(e) => setForm((f) => ({ ...f, gstNumber: e.target.value }))}
              />
            </FormField>
            <FormField label="Mobile No.">
              <Input
                disabled={!canUpdate}
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </FormField>
            <FormField label="Email">
              <Input
                type="email"
                disabled={!canUpdate}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </FormField>
            <FormField label="Address" className="sm:col-span-2">
              <Input
                disabled={!canUpdate}
                value={form.addressLine1}
                onChange={(e) => setForm((f) => ({ ...f, addressLine1: e.target.value }))}
              />
            </FormField>
          </div>

          {canUpdate ? (
            <div className="border-t border-border pt-4">
              <Button type="submit" loading={mutation.isPending}>
                Save Changes
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
};
