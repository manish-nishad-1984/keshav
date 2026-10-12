import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { FormAlert } from '../ui/form-alert';
import { usePermissions } from '../../hooks/use-permissions';

export const PRESS_RATES_QUERY_KEY = ['press-rates'] as const;

export interface PressRates {
  onlineRates: number[];
  offlineRates: number[];
}

type Mode = 'onlineRates' | 'offlineRates';

const MODES: { key: Mode; title: string }[] = [
  { key: 'onlineRates', title: 'Online rates (₹ / pc)' },
  { key: 'offlineRates', title: 'Offline rates (₹ / pc)' },
];

// Per-piece press (ironing) rates. The admin keeps a list for online and for offline; the user picks
// one in Press Entry. A saved entry keeps the rate it was made with.
export const PressRatesCard = () => {
  const queryClient = useQueryClient();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canUpdate = isSuperAdmin || hasPermission('company_settings:update');
  const [rates, setRates] = useState<PressRates>({ onlineRates: [], offlineRates: [] });
  const [draft, setDraft] = useState<Record<Mode, string>>({ onlineRates: '', offlineRates: '' });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: PRESS_RATES_QUERY_KEY,
    queryFn: () => apiClient.get<PressRates>('/press-entries/rates'),
  });

  useEffect(() => {
    if (data) setRates({ onlineRates: [...data.onlineRates], offlineRates: [...data.offlineRates] });
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => apiClient.put('/press-entries/rates', rates),
    onSuccess: () => {
      setError(null);
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: PRESS_RATES_QUERY_KEY });
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Could not save rates.'),
  });

  const add = (mode: Mode) => {
    const value = Math.round(Number(draft[mode]) * 100) / 100;
    if (!(value > 0)) return;
    if (rates[mode].some((r) => Math.abs(r - value) < 0.005)) {
      setError(`₹${value} is already in the list`);
      return;
    }
    setError(null);
    setRates((r) => ({ ...r, [mode]: [...r[mode], value].sort((a, b) => a - b) }));
    setDraft((d) => ({ ...d, [mode]: '' }));
  };
  const remove = (mode: Mode, value: number) => setRates((r) => ({ ...r, [mode]: r[mode].filter((x) => x !== value) }));

  const valid = rates.onlineRates.length > 0 && rates.offlineRates.length > 0;

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
            <p className="text-xs text-muted-foreground">
              Add as many rates as you need for online and offline; the user picks one in Press Entry. Saved entries keep the rate they were made with.
            </p>
          </div>
          {error ? <FormAlert tone="error">{error}</FormAlert> : null}
          {saved ? <FormAlert tone="success">Press rates saved.</FormAlert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {MODES.map(({ key, title }) => (
              <div key={key} className="space-y-2">
                <p className="text-sm font-medium">{title}</p>
                <div className="flex flex-wrap gap-1.5">
                  {rates[key].map((value) => (
                    <span key={value} className="numeric inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-sm font-semibold">
                      ₹{value}
                      {canUpdate ? (
                        <button
                          type="button"
                          aria-label={`Remove rate ${value}`}
                          className="rounded-full text-muted-foreground hover:text-destructive"
                          onClick={() => remove(key, value)}
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                    </span>
                  ))}
                  {!rates[key].length ? <span className="text-xs text-destructive">Add at least one rate</span> : null}
                </div>
                {canUpdate ? (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      aria-label={`New ${title}`}
                      placeholder="New rate"
                      className="numeric w-32 text-right"
                      value={draft[key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          add(key);
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={() => add(key)} disabled={!(Number(draft[key]) > 0)}>
                      <Plus />
                      Add
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
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
