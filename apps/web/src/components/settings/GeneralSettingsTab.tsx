import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import { LoadingState } from '../ui/loading-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { usePermissions } from '../../hooks/use-permissions';

interface OrganizationDto {
  currency: string;
  timezone: string;
  fiscalYearStartMonth: number;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const GeneralSettingsTab = () => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canUpdate = isSuperAdmin || hasPermission('company_settings:update');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ currency: '', timezone: '', fiscalYearStartMonth: 4 });

  const { data, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: () => apiClient.get<OrganizationDto>('/organization'),
  });

  useEffect(() => {
    if (!data) return;
    setForm({ currency: data.currency, timezone: data.timezone, fiscalYearStartMonth: data.fiscalYearStartMonth });
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => apiClient.patch('/organization', form),
    onSuccess: () => {
      setError(null);
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['organization'] });
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Could not save settings.'),
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
          {saved ? <FormAlert tone="success">Settings saved.</FormAlert> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Currency">
              <Input
                disabled={!canUpdate}
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              />
            </FormField>
            <FormField label="Timezone">
              <Input
                disabled={!canUpdate}
                value={form.timezone}
                onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              />
            </FormField>
            <FormField label="Fiscal Year Start Month" className="sm:col-span-2">
              <Select
                value={String(form.fiscalYearStartMonth)}
                onValueChange={(v) => setForm((f) => ({ ...f, fiscalYearStartMonth: Number(v) }))}
                disabled={!canUpdate}
              >
                <SelectTrigger className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={month} value={String(index + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
