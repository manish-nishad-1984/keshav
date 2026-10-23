import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MessageCircle, Paperclip, Send } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { Button } from '../ui/button';
import { FormAlert } from '../ui/form-alert';
import { LoadingState } from '../ui/loading-state';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

export type WhatsAppEvent = 'DISTRIBUTION' | 'PRODUCTION' | 'ACCESSORY_ISSUE' | 'ACCESSORY_RETURN' | 'DELIVERY' | 'PAYMENT' | 'KARIGAR_STATEMENT';

interface PlannedMessage {
  key: string;
  kindLabel: string;
  name: string;
  mobile: string | null;
  number: string | null;
  message: string;
}

interface Preview {
  enabled: boolean;
  messages: PlannedMessage[];
}

interface WhatsAppSendDialogProps {
  event: WhatsAppEvent;
  refId: string | null;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Makes a file to attach (the challan PDF); called only when sending. */
  makeAttachment?: () => Promise<File>;
  /** Extra input for the message, e.g. the report card period { dateFrom, dateTo }. */
  params?: Record<string, string>;
}

const errorText = (err: unknown) => (err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');

// Sends an entry's message through the company WhatsApp number (Settings → WhatsApp): shows who gets
// what, lets the user untick people, then queues the messages. Works for old entries too.
export const WhatsAppSendDialog = ({ event, refId, onOpenChange, title, makeAttachment, params }: WhatsAppSendDialogProps) => {
  const open = Boolean(refId);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['whatsapp', 'share', event, refId, params],
    queryFn: () => apiClient.get<Preview>(`/whatsapp/share/${event}/${refId}`, params),
    enabled: open,
    staleTime: 0,
  });

  useEffect(() => {
    if (data) setPicked(new Set(data.messages.filter((m) => m.number).map((m) => m.key)));
    setResult(null);
  }, [data]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      let fileUrl: string | undefined;
      if (makeAttachment) {
        const file = await makeAttachment();
        fileUrl = (await apiClient.upload<{ url: string }>('/uploads', file)).url;
      }
      return apiClient.post<{ queued: number; skipped: string[] }>(`/whatsapp/share/${event}/${refId}`, { keys: [...picked], fileUrl, params });
    },
    onSuccess: (r) =>
      setResult({
        ok: true,
        text: `${r.queued} message${r.queued === 1 ? '' : 's'} sent to WhatsApp. See the status in Settings → WhatsApp.${
          r.skipped.length ? ` No number: ${r.skipped.join(', ')}.` : ''
        }`,
      }),
    onError: (err) => setResult({ ok: false, text: errorText(err) }),
  });

  const toggle = (key: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-5 text-emerald-600" />
            {title ?? 'Send on WhatsApp'}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {isLoading ? <LoadingState /> : null}
          {error ? <FormAlert tone="error">{errorText(error)}</FormAlert> : null}
          {data && !data.enabled ? (
            <FormAlert tone="warning">WhatsApp is off. An admin has to set it up and turn it on in Settings → WhatsApp.</FormAlert>
          ) : null}
          {makeAttachment ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Paperclip className="size-3.5" />
              The challan PDF is attached.
            </p>
          ) : null}
          {data?.messages.length === 0 ? <p className="text-sm text-muted-foreground">Nobody to send to for this entry.</p> : null}

          {data?.messages.map((m) => (
            <label
              key={m.key}
              className={`block rounded-lg border px-3 py-2 ${m.number ? 'cursor-pointer border-border' : 'border-dashed border-border opacity-70'}`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-[hsl(var(--primary))]"
                  disabled={!m.number}
                  checked={picked.has(m.key)}
                  onChange={() => toggle(m.key)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{m.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {m.kindLabel} · {m.number ? m.mobile : m.mobile ? `${m.mobile} — not a valid number` : 'no mobile number in master'}
                  </span>
                </span>
              </span>
              <span className="mt-2 block whitespace-pre-wrap rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-50">
                {m.message}
              </span>
            </label>
          ))}

          {result ? <FormAlert tone={result.ok ? 'success' : 'error'}>{result.text}</FormAlert> : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {result?.ok ? 'Close' : 'Cancel'}
          </Button>
          {!result?.ok ? (
            <Button
              onClick={() => sendMutation.mutate()}
              loading={sendMutation.isPending}
              disabled={!data?.enabled || picked.size === 0}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Send />
              Send ({picked.size})
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
