import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import { usePermissions } from '../../hooks/use-permissions';

export const PRESS_RATES_QUERY_KEY = ['press-rates'] as const;

export interface PressRates {
  onlineRate: number;
  offlineRate: number;
}

// Per-piece press (ironing) rates used by Press Entry. A saved entry keeps the rate it was made with.
export const PressRatesCard = () => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canUpdate = isSuperAdmin || hasPermission('company_settings:update');
  const [form, setForm] = useState({ onlineRate: '', offlineRate: '' });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: PRESS_RATES_QUERY_KEY,
    queryFn: () => apiClient.get<PressRates>('/press-entries/rates'),
  });

  useEffect(() => {
    if (data) setForm({ onlineRate: String(data.onlineRate), offlineRate: String(data.offlineRate) });
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.put('/press-entries/rates', { onlineRate: Number(form.onlineRate), offlineRate: Number(form.offlineRate) }),
    onSuccess: () => {
      setError(null);
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: PRESS_RATES_QUERY_KEY });
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Could not save rates.'),
  });

  const valid = Number(form.onlineRate) > 0 && Number(form.offlineRate) > 0;

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div>
            <h2 className="text-sm font-semibold">Press Rates</h2>
            <p className="text-xs text-muted-foreground">Per piece, used by Press Entry. Saved entries keep the rate they were made with.</p>
          </div>
          {error ? <FormAlert tone="error">{error}</FormAlert> : null}
          {saved ? <FormAlert tone="success">Press rates saved.</FormAlert> : null}
          <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Online rate (₹ / pc)" htmlFor="press-online-rate">
              <Input
                id="press-online-rate"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="numeric text-right"
                disabled={!canUpdate}
                value={form.onlineRate}
                onChange={(e) => setForm((f) => ({ ...f, onlineRate: e.target.value }))}
              />
            </FormField>
            <FormField label="Offline rate (₹ / pc)" htmlFor="press-offline-rate">
              <Input
                id="press-offline-rate"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="numeric text-right"
                disabled={!canUpdate}
                value={form.offlineRate}
                onChange={(e) => setForm((f) => ({ ...f, offlineRate: e.target.value }))}
              />
            </FormField>
          </div>
          {canUpdate ? (
            <div className="pt-1">
              <Button type="submit" loading={mutation.isPending} disabled={!valid}>
                Save Rates
              </Button>
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
};
