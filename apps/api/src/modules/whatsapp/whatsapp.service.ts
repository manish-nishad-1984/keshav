import type { WhatsappStatus } from '@prisma/client';
import { badRequest, notFound } from '../../lib/httpError';
import * as repo from './whatsapp.repository';
import { decryptSecret, encryptSecret } from './whatsapp.crypto';
import * as client from './whatsapp.client';
import type { SaveWhatsappConfigInput } from './whatsapp.schema';

export const DEFAULT_API_URL = 'https://surat.mitalinfosys.info/api/v1';
const RETRY_MINUTES = [1, 5, 15];
const MAX_ATTEMPTS = RETRY_MINUTES.length + 1;

// ---------------------------------------------------------------- configuration (Settings → WhatsApp)
const readStored = async (organizationId: string): Promise<repo.StoredConfig> => {
  const row = await repo.findConfig(organizationId);
  const v = (row?.value ?? {}) as Partial<repo.StoredConfig>;
  return { enabled: Boolean(v.enabled), apiUrl: v.apiUrl || DEFAULT_API_URL, tokenEnc: v.tokenEnc ?? null, device: v.device ?? '' };
};

const maskToken = (token: string) => (token.length > 4 ? `••••••••${token.slice(-4)}` : '••••');

// What the browser may see: never the token itself.
export const getPublicConfig = async (organizationId: string) => {
  const stored = await readStored(organizationId);
  const token = stored.tokenEnc ? decryptSecret(stored.tokenEnc) : null;
  return {
    enabled: stored.enabled,
    apiUrl: stored.apiUrl,
    device: stored.device,
    hasToken: Boolean(token),
    tokenHint: token ? maskToken(token) : null,
  };
};

export const saveConfig = async (organizationId: string, input: SaveWhatsappConfigInput) => {
  const current = await readStored(organizationId);
  const tokenEnc = input.token ? encryptSecret(input.token) : current.tokenEnc;
  if (input.enabled && !tokenEnc) throw badRequest('Enter the WhatsApp token before turning WhatsApp on');
  await repo.saveConfig(organizationId, { enabled: input.enabled, apiUrl: input.apiUrl.replace(/\/+$/, ''), tokenEnc, device: input.device ?? '' });
  return getPublicConfig(organizationId);
};

// The live settings used for sending, or null when WhatsApp is off / not set up.
const activeConfig = async (organizationId: string): Promise<client.WhatsappConfig | null> => {
  const stored = await readStored(organizationId);
  if (!stored.enabled || !stored.tokenEnc) return null;
  const token = decryptSecret(stored.tokenEnc);
  return token ? { apiUrl: stored.apiUrl, token, device: stored.device || undefined } : null;
};

// Same as activeConfig, but also usable while WhatsApp is switched off (test, status).
const anyConfig = async (organizationId: string): Promise<client.WhatsappConfig> => {
  const stored = await readStored(organizationId);
  const token = stored.tokenEnc ? decryptSecret(stored.tokenEnc) : null;
  if (!token) throw badRequest('Save the WhatsApp token first');
  return { apiUrl: stored.apiUrl, token, device: stored.device || undefined };
};

// ---------------------------------------------------------------- numbers
// 10 digits get 91 in front; 91 + 10 digits and 0 + 10 digits are fixed up; anything else is refused.
export const normalizeNumber = (raw: string): string | null => {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  if (digits.length === 10) digits = `91${digits}`;
  return /^\d{11,15}$/.test(digits) ? digits : null;
};

// ---------------------------------------------------------------- connection / credits
let statusCache: { at: number; orgId: string; value: unknown } | null = null;

export const getConnection = async (organizationId: string, force = false) => {
  if (!force && statusCache && statusCache.orgId === organizationId && Date.now() - statusCache.at < 20000) return statusCache.value;
  const stored = await readStored(organizationId);
  if (!stored.tokenEnc) return { configured: false };
  const cfg = await anyConfig(organizationId);
  const [balance, device] = await Promise.all([client.getBalance(cfg), client.getDeviceStatus(cfg)]);
  const value = {
    configured: true,
    reachable: balance.ok || Boolean(device.ok) || !String(balance.error ?? '').startsWith('Could not reach'),
    balance: balance.ok
      ? {
          credits: balance.credits,
          validTill: balance.valid_till,
          sentToday: balance.sent_today,
          dailyLimit: balance.daily_limit,
          trial: balance.trial,
        }
      : null,
    balanceError: balance.ok ? null : balance.error,
    // "connected" when the WhatsApp number is linked and online.
    device: device.ok ? { state: device.state ?? 'unknown', raw: device } : null,
    deviceError: device.ok ? null : device.error,
  };
  statusCache = { at: Date.now(), orgId: organizationId, value };
  return value;
};

// ---------------------------------------------------------------- outbox
export interface EnqueueInput {
  eventType: string;
  to: string;
  message: string;
  refType?: string;
  refId?: string;
  karigarId?: string | null;
  mediaUrl?: string | null;
  /** Same key = same message: it is queued once. */
  dedupeKey?: string;
}

// Called by the app when something happens (distribution, production ...). It only writes a row: never
// slow, and never fails the caller. Returns false when WhatsApp is off or the number is not usable.
export const enqueue = async (organizationId: string, input: EnqueueInput): Promise<boolean> => {
  try {
    if (!(await activeConfig(organizationId))) return false;
    const to = normalizeNumber(input.to);
    const base = {
      organizationId,
      eventType: input.eventType,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      karigarId: input.karigarId ?? null,
      message: input.message,
      mediaUrl: input.mediaUrl ?? null,
      dedupeKey: input.dedupeKey ?? null,
    };
    await repo.createMessage(
      to
        ? { ...base, toNumber: to }
        : { ...base, toNumber: input.to, status: 'FAILED', error: 'The mobile number is not valid for WhatsApp' },
    );
    if (to) setImmediate(() => void processQueue(organizationId));
    return Boolean(to);
  } catch (err) {
    // A duplicate (dedupeKey) is fine; anything else is logged but must never break the caller.
    if (!(err instanceof Error && err.message.includes('Unique constraint'))) console.error('WhatsApp enqueue failed:', err);
    return false;
  }
};

let processing = false;

// Sends what is due, one by one (the service itself spaces messages out). Retries a failed one after
// 1, 5 and 15 minutes, then gives up and leaves it as FAILED with the reason.
let again = false;

export const processQueue = async (organizationId: string) => {
  // Asked while already sending: go round once more at the end, so a new message doesn't wait for the worker.
  if (processing) {
    again = true;
    return;
  }
  processing = true;
  try {
    const cfg = await activeConfig(organizationId);
    if (!cfg) return;
    for (let round = 0; round < 5; round++) {
      again = false;
      const due = await repo.dueMessages(organizationId, 20);
      if (!due.length) break;
      await sendBatch(cfg, due);
      if (!again && due.length < 20) break;
    }
  } finally {
    processing = false;
  }
};

const sendBatch = async (cfg: client.WhatsappConfig, due: Awaited<ReturnType<typeof repo.dueMessages>>) => {
  for (const msg of due) {
    const reply = await client.sendMessage(cfg, msg.toNumber, msg.message, msg.mediaUrl);
    const attempts = msg.attempts + 1;
    if (reply.ok) {
      await repo.updateMessage(msg.id, {
        status: 'SENT',
        attempts,
        sentAt: new Date(),
        error: null,
        providerMessageId: reply.message_id !== undefined ? String(reply.message_id) : null,
      });
    } else if (attempts >= MAX_ATTEMPTS) {
      await repo.updateMessage(msg.id, { status: 'FAILED', attempts, error: String(reply.error ?? 'Could not send') });
    } else {
      await repo.updateMessage(msg.id, {
        attempts,
        error: String(reply.error ?? 'Could not send'),
        nextAttemptAt: new Date(Date.now() + RETRY_MINUTES[attempts - 1] * 60 * 1000),
      });
    }
  }
};

const MAP: Record<string, WhatsappStatus> = { sent: 'SENT', delivered: 'DELIVERED', read: 'READ', failed: 'FAILED' };
const RANK: Record<string, number> = { SENT: 1, DELIVERED: 2, READ: 3 };

// One call for all recent messages: moves SENT messages on to DELIVERED / READ (or FAILED).
export const refreshStatuses = async (organizationId: string) => {
  const cfg = await activeConfig(organizationId);
  if (!cfg) return;
  const open = await repo.openMessages(organizationId);
  if (!open.length) return;
  const reply = await client.getRecentMessages(cfg, 100);
  const list = Array.isArray(reply.messages) ? (reply.messages as Record<string, unknown>[]) : [];
  const byId = new Map(list.map((m) => [String(m.id ?? m.message_id ?? ''), m]));
  for (const o of open) {
    const remote = byId.get(o.providerMessageId ?? '');
    const next = remote ? MAP[String(remote.status ?? '').toLowerCase()] : undefined;
    if (!next || next === o.status) continue;
    if (next === 'FAILED') await repo.updateMessage(o.id, { status: 'FAILED', error: String(remote?.error ?? remote?.reason ?? 'Failed at WhatsApp') });
    else if ((RANK[next] ?? 0) > (RANK[o.status] ?? 0)) await repo.updateMessage(o.id, { status: next });
  }
};

export const listMessages = async (organizationId: string, page: number, pageSize: number, status?: WhatsappStatus) =>
  repo.listMessages(organizationId, page, pageSize, status);

export const resend = async (organizationId: string, id: string) => {
  const msg = await repo.findMessage(organizationId, id);
  if (!msg) throw notFound('Message not found');
  if (msg.status !== 'FAILED' && msg.status !== 'PENDING') throw badRequest('Only a failed or waiting message can be sent again');
  const to = normalizeNumber(msg.toNumber);
  if (!to) throw badRequest('The mobile number is not valid for WhatsApp — fix it in Karigar Master first');
  await repo.updateMessage(msg.id, { status: 'PENDING', attempts: 0, error: null, toNumber: to, nextAttemptAt: new Date() });
  setImmediate(() => void processQueue(organizationId));
  return repo.findMessage(organizationId, id);
};

// Settings → "Send test message": goes through the same path as every other message.
export const sendTest = async (organizationId: string, toRaw: string, message?: string) => {
  const cfg = await anyConfig(organizationId);
  const to = normalizeNumber(toRaw);
  if (!to) throw badRequest('Enter a valid mobile number');
  const reply = await client.sendMessage(cfg, to, message ?? 'Test message from Keshav Trading & Co — WhatsApp is connected.');
  await repo.createMessage({
    organizationId,
    eventType: 'TEST',
    toNumber: to,
    message: message ?? 'Test message from Keshav Trading & Co — WhatsApp is connected.',
    status: reply.ok ? 'SENT' : 'FAILED',
    attempts: 1,
    sentAt: reply.ok ? new Date() : null,
    error: reply.ok ? null : String(reply.error ?? 'Could not send'),
    providerMessageId: reply.ok && reply.message_id !== undefined ? String(reply.message_id) : null,
  });
  return { ok: reply.ok, error: reply.ok ? null : reply.error ?? 'Could not send' };
};

// Background loop (see lib/whatsappWorker): runs for every organization that has WhatsApp set up.
export const runWorkerOnce = async () => {
  const orgs = await repo.organizationsWithWhatsapp();
  for (const o of orgs) {
    await processQueue(o.organizationId);
    await refreshStatuses(o.organizationId);
  }
};
