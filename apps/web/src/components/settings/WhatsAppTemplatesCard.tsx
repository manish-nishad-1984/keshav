import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, RotateCcw, Save } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { cn } from '../../lib/utils';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';

interface EventSetting {
  enabled: boolean;
  recipients: string[];
  extraNumbers: string;
  template: string;
}

interface EventDef {
  key: string;
  label: string;
  recipients: { key: string; label: string }[];
  variables: string[];
  defaultTemplate: string;
}

interface TemplatesResponse {
  events: EventDef[];
  samples: Record<string, string>;
  settings: Record<string, EventSetting>;
}

const VARIABLE_LABELS: Record<string, string> = {
  name: 'Receiver name',
  company: 'Company',
  lot: 'Lot no.',
  design: 'Design',
  party: 'Party',
  book: 'Book',
  date: 'Date',
  qty: 'Pcs',
  details: 'Colour / size detail',
  remarks: 'Remarks',
  work: 'Work (Stitching/Flatlock/Overlock)',
  alteration: 'Alteration pcs',
  rate: 'Rate',
  amount: 'Amount',
  challan: 'Challan no.',
  bill: 'Bill no.',
};

const VAR = /\{\{\s*(\w+)\s*\}\}/g;

// Same rule as the server: a line whose variables are all empty is left out.
const render = (template: string, values: Record<string, string>) =>
  template
    .split('\n')
    .flatMap((line) => {
      const keys = [...line.matchAll(VAR)].map((m) => m[1]);
      if (keys.length && keys.every((k) => !(values[k] ?? '').trim())) return [];
      return [line.replace(VAR, (_, k: string) => values[k] ?? '')];
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const KEY = ['whatsapp', 'templates'] as const;

// Settings → WhatsApp → Messages: for each kind of entry, whether a message goes, to whom, and its text.
export const WhatsAppTemplatesCard = () => {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: KEY, queryFn: () => apiClient.get<TemplatesResponse>('/whatsapp/templates') });
  const [settings, setSettings] = useState<Record<string, EventSetting>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const areas = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    if (data) setSettings(data.settings);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => apiClient.put<TemplatesResponse>('/whatsapp/templates', settings),
    onSuccess: (r) => {
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      queryClient.setQueryData(KEY, r);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Could not save. Please try again.'),
  });

  if (!data) return null;

  const update = (key: string, patch: Partial<EventSetting>) => setSettings((s) => ({ ...s, [key]: { ...s[key], ...patch } }));

  const insertVariable = (key: string, variable: string) => {
    const el = areas.current[key];
    const text = settings[key].template;
    const token = `{{${variable}}}`;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    update(key, { template: text.slice(0, start) + token + text.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Messages</h2>
          <p className="text-xs text-muted-foreground">Which entry sends a message, to whom, and what it says. Sent only when a new entry is saved.</p>
        </div>
        <Button type="button" size="sm" loading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          <Save />
          Save messages
        </Button>
      </div>
      {error || saved ? (
        <div className="px-4 pt-3">
          {error ? <FormAlert tone="error">{error}</FormAlert> : <FormAlert tone="success">Messages saved.</FormAlert>}
        </div>
      ) : null}

      <div className="divide-y divide-border">
        {data.events.map((def) => {
          const s = settings[def.key];
          if (!s) return null;
          const isOpen = open === def.key;
          const who = def.recipients.filter((r) => s.recipients.includes(r.key)).map((r) => r.label);
          return (
            <div key={def.key}>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label={`Send message: ${def.label}`}
                  className="size-4 shrink-0 accent-[hsl(var(--primary))]"
                  checked={s.enabled}
                  onChange={(e) => update(def.key, { enabled: e.target.checked })}
                />
                <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen(isOpen ? null : def.key)}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{def.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.enabled ? (who.length ? `To: ${who.join(', ')}` : 'Nobody selected') : 'Off'}
                    </span>
                  </span>
                  {s.enabled ? <Badge variant="success">On</Badge> : <Badge variant="muted">Off</Badge>}
                  <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                </button>
              </div>

              {isOpen ? (
                <div className="grid gap-3 bg-muted/30 px-4 py-3 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1 text-xs font-medium">Send to</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {def.recipients.map((r) => (
                          <label key={r.key} className="flex cursor-pointer items-center gap-1.5 text-sm">
                            <input
                              type="checkbox"
                              className="size-4 accent-[hsl(var(--primary))]"
                              checked={s.recipients.includes(r.key)}
                              onChange={(e) =>
                                update(def.key, {
                                  recipients: e.target.checked ? [...s.recipients, r.key] : s.recipients.filter((x) => x !== r.key),
                                })
                              }
                            />
                            {r.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    {s.recipients.includes('extra') ? (
                      <FormField label="Other numbers" htmlFor={`wa-extra-${def.key}`} hint="Comma separated, e.g. 9876543210, 9123456780">
                        <Input
                          id={`wa-extra-${def.key}`}
                          inputMode="tel"
                          value={s.extraNumbers}
                          onChange={(e) => update(def.key, { extraNumbers: e.target.value })}
                        />
                      </FormField>
                    ) : null}
                    <FormField label="Message" htmlFor={`wa-text-${def.key}`}>
                      <Textarea
                        id={`wa-text-${def.key}`}
                        ref={(el) => {
                          areas.current[def.key] = el;
                        }}
                        rows={8}
                        value={s.template}
                        onChange={(e) => update(def.key, { template: e.target.value })}
                      />
                    </FormField>
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Tap to add at the cursor:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {def.variables.map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => insertVariable(def.key, v)}
                            className="rounded-full border border-border bg-card px-2 py-0.5 text-xs hover:border-primary hover:text-primary"
                            title={`{{${v}}}`}
                          >
                            {VARIABLE_LABELS[v] ?? v}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => update(def.key, { template: def.defaultTemplate })}>
                      <RotateCcw />
                      Default text
                    </Button>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-medium">Preview (example values)</p>
                    <div className="whitespace-pre-wrap rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50">
                      {render(s.template, data.samples) || '—'}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
};
