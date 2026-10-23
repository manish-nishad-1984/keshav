import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, RotateCcw, Save, Send } from 'lucide-react';
import type { PaginationMeta } from '@ckfast/types';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { FormField } from '../ui/form-field';
import { FormAlert } from '../ui/form-alert';
import { LoadingState } from '../ui/loading-state';
import { Pagination } from '../ui/pagination';
import { formatDateTime } from '../../lib/date';
import { WhatsAppTemplatesCard } from './WhatsAppTemplatesCard';

interface PublicConfig {
  enabled: boolean;
  apiUrl: string;
  device: string;
  hasToken: boolean;
  tokenHint: string | null;
}

interface Connection {
  configured: boolean;
  reachable?: boolean;
  balance?: { credits: number; validTill: string; sentToday: number; dailyLimit: number; trial: boolean } | null;
  balanceError?: string | null;
  device?: { state: string } | null;
  deviceError?: string | null;
}

type Status = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

interface WhatsappMessage {
  id: string;
  eventType: string;
  toNumber: string;
  message: string;
  status: Status;
  attempts: number;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
}

interface MessageList {
  items: WhatsappMessage[];
  pagination: PaginationMeta;
}

const STATUS_BADGE: Record<Status, { label: string; variant: 'muted' | 'info' | 'success' | 'progress' | 'danger' }> = {
  PENDING: { label: 'Waiting', variant: 'muted' },
  SENT: { label: 'Sent', variant: 'info' },
  DELIVERED: { label: 'Delivered', variant: 'success' },
  READ: { label: 'Read', variant: 'progress' },
  FAILED: { label: 'Failed', variant: 'danger' },
};

const EVENT_LABELS: Record<string, string> = {
  TEST: 'Test',
  DISTRIBUTION: 'Lot given',
  PRODUCTION: 'Production',
  ACCESSORY_ISSUE: 'Accessory given',
  ACCESSORY_RETURN: 'Accessory returned',
  DELIVERY: 'Delivery',
  PAYMENT: 'Payment',
  KARIGAR_STATEMENT: 'Report card',
};

const CONFIG_KEY = ['whatsapp', 'config'] as const;
const STATUS_KEY = ['whatsapp', 'status'] as const;
const MESSAGES_KEY = ['whatsapp', 'messages'] as const;

const errorText = (err: unknown) => (err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');

// Settings → WhatsApp: the number / token used for every message the app sends, a connection check,
// a test message, and the log of what was sent.
export const WhatsAppTab = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ enabled: false, apiUrl: '', token: '', device: '' });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [page, setPage] = useState(1);

  const { data: config, isLoading } = useQuery({ queryKey: CONFIG_KEY, queryFn: () => apiClient.get<PublicConfig>('/whatsapp/config') });
  useEffect(() => {
    if (config) setForm({ enabled: config.enabled, apiUrl: config.apiUrl, token: '', device: config.device });
  }, [config]);

  const { data: connection, isFetching: checking } = useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => apiClient.get<Connection>('/whatsapp/status'),
    enabled: Boolean(config?.hasToken),
    refetchInterval: 60000,
  });
  const { data: messages } = useQuery({
    queryKey: [...MESSAGES_KEY, page],
    queryFn: () => apiClient.get<MessageList>('/whatsapp/messages', { page, pageSize: 10 }),
    refetchInterval: 20000,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.put('/whatsapp/config', {
        enabled: form.enabled,
        apiUrl: form.apiUrl,
        token: form.token || undefined,
        device: form.device,
      }),
    onSuccess: () => {
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      void queryClient.invalidateQueries({ queryKey: ['whatsapp'] });
    },
    onError: (err) => setError(errorText(err)),
  });

  const testMutation = useMutation({
    mutationFn: () => apiClient.post<{ ok: boolean; error: string | null }>('/whatsapp/test', { to: testTo }),
    onSuccess: (r) => {
      setTestResult(r.ok ? { ok: true, text: 'Test message sent. Check that number on WhatsApp.' } : { ok: false, text: r.error ?? 'Could not send.' });
      void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
      void queryClient.invalidateQueries({ queryKey: STATUS_KEY });
    },
    onError: (err) => setTestResult({ ok: false, text: errorText(err) }),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/whatsapp/messages/${id}/resend`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY }),
    onError: (err) => setError(errorText(err)),
  });

  const processMutation = useMutation({
    mutationFn: () => apiClient.post('/whatsapp/process'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MESSAGES_KEY }),
  });

  if (isLoading) return <LoadingState variant="page" />;

  const deviceState = connection?.device?.state;
  const connected = deviceState === 'connected';

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 sm:p-4">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div>
              <h2 className="text-sm font-semibold">WhatsApp</h2>
              <p className="text-xs text-muted-foreground">
                One WhatsApp number sends all messages of this app (lot given, production, accessories, delivery). Enter the token of that number here.
              </p>
            </div>
            {error ? <FormAlert tone="error">{error}</FormAlert> : null}
            {saved ? <FormAlert tone="success">WhatsApp settings saved.</FormAlert> : null}

            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 accent-[hsl(var(--primary))]"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              Send WhatsApp messages
            </label>

            <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
              <FormField
                label="Token"
                htmlFor="wa-token"
                hint={config?.hasToken ? `Saved: ${config.tokenHint}. Leave empty to keep it.` : 'From the WhatsApp service panel (device token).'}
              >
                <Input
                  id="wa-token"
                  type="password"
                  autoComplete="new-password"
                  placeholder={config?.hasToken ? 'Enter only to change it' : 'Paste the token'}
                  value={form.token}
                  onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))}
                />
              </FormField>
              <FormField label="Device (number or name)" htmlFor="wa-device" hint="Only if you use the master token. Leave empty for a device token.">
                <Input id="wa-device" value={form.device} onChange={(e) => setForm((f) => ({ ...f, device: e.target.value }))} />
              </FormField>
              <FormField label="Service link" htmlFor="wa-url" className="sm:col-span-2">
                <Input id="wa-url" value={form.apiUrl} onChange={(e) => setForm((f) => ({ ...f, apiUrl: e.target.value }))} />
              </FormField>
            </div>

            <Button type="submit" loading={saveMutation.isPending} disabled={!form.apiUrl}>
              <Save />
              Save
            </Button>
          </form>
        </CardContent>
      </Card>

      {config?.hasToken ? (
        <Card>
          <CardContent className="space-y-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Connection</h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={checking}
                onClick={() => void queryClient.fetchQuery({ queryKey: STATUS_KEY, queryFn: () => apiClient.get<Connection>('/whatsapp/status', { refresh: 1 }) }).then(() => queryClient.invalidateQueries({ queryKey: STATUS_KEY }))}
              >
                <RefreshCw />
                Check now
              </Button>
            </div>

            {connection ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">WhatsApp number</p>
                  <p className="mt-0.5">
                    {connected ? (
                      <Badge variant="success">Connected</Badge>
                    ) : (
                      <Badge variant="danger">{deviceState ? deviceState : 'Not connected'}</Badge>
                    )}
                  </p>
                  {connection.deviceError ? <p className="mt-1 text-2xs text-destructive">{connection.deviceError}</p> : null}
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Credits left</p>
                  <p className="numeric text-lg font-semibold">{connection.balance ? connection.balance.credits.toLocaleString('en-IN') : '—'}</p>
                  {connection.balance ? (
                    <p className="text-2xs text-muted-foreground">
                      Today {connection.balance.sentToday}
                      {connection.balance.dailyLimit ? ` / ${connection.balance.dailyLimit}` : ''} · valid till {connection.balance.validTill}
                    </p>
                  ) : null}
                  {connection.balanceError ? <p className="text-2xs text-destructive">{connection.balanceError}</p> : null}
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Sending</p>
                  <p className="mt-0.5">{config.enabled ? <Badge variant="success">On</Badge> : <Badge variant="muted">Off</Badge>}</p>
                </div>
              </div>
            ) : null}
            {connection && !connected ? (
              <FormAlert tone="warning">
                The WhatsApp number is not linked or is offline. In the WhatsApp service panel open &quot;WhatsApp devices&quot;, add the number and scan the QR. Messages wait and are
                sent once it is connected.
              </FormAlert>
            ) : null}

            <div className="border-t border-border pt-3">
              <p className="mb-1.5 text-sm font-medium">Send a test message</p>
              <div className="flex flex-wrap items-end gap-2">
                <FormField label="Mobile number" htmlFor="wa-test" className="w-56">
                  <Input id="wa-test" inputMode="tel" placeholder="10 digit number" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                </FormField>
                <Button type="button" onClick={() => testMutation.mutate()} loading={testMutation.isPending} disabled={testTo.replace(/\D/g, '').length < 10}>
                  <Send />
                  Send test
                </Button>
              </div>
              {testResult ? (
                <div className="mt-2">
                  <FormAlert tone={testResult.ok ? 'success' : 'error'}>{testResult.text}</FormAlert>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <WhatsAppTemplatesCard />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Sent messages</h2>
          <Button type="button" variant="ghost" size="sm" loading={processMutation.isPending} onClick={() => processMutation.mutate()}>
            <RefreshCw />
            Send waiting now
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full text-left text-sm">
            <thead className="border-b border-border text-2xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">To</th>
                <th className="px-4 py-2 font-medium">For</th>
                <th className="px-4 py-2 font-medium">Message</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {messages?.items.map((m) => {
                const badge = STATUS_BADGE[m.status];
                return (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDateTime(m.createdAt)}</td>
                    <td className="numeric px-4 py-2.5">{m.toNumber}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{EVENT_LABELS[m.eventType] ?? m.eventType}</td>
                    <td className="max-w-[18rem] truncate px-4 py-2.5 text-muted-foreground" title={m.message}>
                      {m.message}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                      {m.error ? <span className="mt-0.5 block max-w-[14rem] truncate text-2xs text-destructive" title={m.error}>{m.error}</span> : null}
                    </td>
                    <td className="px-2 py-2.5">
                      {m.status === 'FAILED' || m.status === 'PENDING' ? (
                        <Button variant="ghost" size="icon" aria-label="Send again" onClick={() => resendMutation.mutate(m.id)}>
                          <RotateCcw />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {!messages?.items.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No messages yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {messages ? <Pagination meta={messages.pagination} onPageChange={setPage} className="border-t border-border" /> : null}
      </Card>
    </div>
  );
};
