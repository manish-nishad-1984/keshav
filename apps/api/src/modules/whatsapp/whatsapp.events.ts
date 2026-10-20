import type { Prisma } from '@prisma/client';
import { badRequest, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import { getKarigarPending } from '../payments/earnings';
import * as repo from './whatsapp.repository';

const PAYMENT_MODE_LABELS: Record<string, string> = { CASH: 'Cash', BANK_TRANSFER: 'Bank', UPI: 'UPI', CHEQUE: 'Cheque' };
import { enqueue, normalizeNumber } from './whatsapp.service';

// Which entries send a WhatsApp message, to whom, and with what text — all set by the admin in
// Settings → WhatsApp → Messages. The text is a template: {{lot}}, {{qty}} ... are filled in per message.

export type EventKey = 'DISTRIBUTION' | 'PRODUCTION' | 'ACCESSORY_ISSUE' | 'ACCESSORY_RETURN' | 'DELIVERY' | 'PAYMENT';

interface EventDef {
  key: EventKey;
  label: string;
  recipients: { key: string; label: string }[];
  variables: string[];
  defaultRecipients: string[];
  defaultTemplate: string;
  /** Off for new entries until the admin switches it on (the button on the entry still works). */
  defaultOff?: boolean;
}

const COMMON = ['name', 'company', 'lot', 'design', 'party', 'book', 'date', 'qty', 'details'];
const EXTRA = { key: 'extra', label: 'Other numbers (owner / manager)' };

export const EVENT_DEFS: EventDef[] = [
  {
    key: 'DISTRIBUTION',
    label: 'Lot given to karigar (Cutting Distribution)',
    recipients: [{ key: 'karigar', label: 'Karigar who got the lot' }, EXTRA],
    variables: [...COMMON, 'remarks'],
    defaultRecipients: ['karigar'],
    defaultTemplate:
      'Namaste {{name}},\nAapko Lot {{lot}} ({{design}}) ke {{qty}} pcs diye gaye hain.\nDate: {{date}}\n{{details}}\n\n- {{company}}',
  },
  {
    key: 'PRODUCTION',
    label: 'Production entry (stitching / flatlock / overlock)',
    recipients: [
      { key: 'stitching', label: 'Stitching karigar' },
      { key: 'flatlock', label: 'Flatlock karigar' },
      { key: 'overlock', label: 'Overlock karigar' },
      EXTRA,
    ],
    variables: [...COMMON, 'work', 'alteration', 'rate', 'amount', 'remarks'],
    defaultRecipients: ['stitching', 'flatlock', 'overlock'],
    defaultTemplate:
      'Namaste {{name}},\nLot {{lot}} ({{design}}) — {{work}}: {{qty}} pcs jama hue.\nDate: {{date}}\n{{details}}\n\n- {{company}}',
  },
  {
    key: 'ACCESSORY_ISSUE',
    label: 'Accessories given to karigar',
    recipients: [{ key: 'karigar', label: 'Karigar' }, EXTRA],
    variables: [...COMMON, 'remarks'],
    defaultRecipients: ['karigar'],
    defaultTemplate: 'Namaste {{name}},\nLot {{lot}} ({{design}}) ke liye accessories diye gaye:\n{{details}}\nDate: {{date}}\n\n- {{company}}',
  },
  {
    key: 'ACCESSORY_RETURN',
    label: 'Accessories returned by karigar',
    recipients: [{ key: 'karigar', label: 'Karigar' }, EXTRA],
    variables: [...COMMON, 'remarks'],
    defaultRecipients: ['karigar'],
    defaultTemplate: 'Namaste {{name}},\nLot {{lot}} ({{design}}) ke accessories wapas mile:\n{{details}}\nDate: {{date}}\n\n- {{company}}',
  },
  {
    key: 'DELIVERY',
    label: 'Delivery to party',
    recipients: [
      { key: 'party', label: 'Party' },
      { key: 'lotKarigars', label: 'Karigars of the lot' },
      EXTRA,
    ],
    variables: [...COMMON, 'challan', 'bill', 'remarks'],
    defaultRecipients: ['party'],
    defaultTemplate:
      'Namaste {{name}},\nLot {{lot}} ({{design}}) ke {{qty}} pcs deliver kiye gaye.\nChallan No: {{challan}}\nDate: {{date}}\n{{details}}\n\n- {{company}}',
  },
  {
    key: 'PAYMENT',
    label: 'Payment to karigar',
    recipients: [{ key: 'karigar', label: 'Karigar' }, EXTRA],
    variables: ['name', 'company', 'date', 'amount', 'mode', 'salary', 'pending', 'remarks'],
    defaultRecipients: ['karigar'],
    defaultOff: true,
    defaultTemplate:
      'Namaste {{name}},\nAapko Rs. {{amount}} ({{mode}}) ka payment kiya gaya.\nDate: {{date}}\n{{salary}}\nBaki (pending): Rs. {{pending}}\n\n- {{company}}',
  },
];

// Example values for the preview in Settings.
export const SAMPLE_VALUES: Record<string, string> = {
  name: 'RAMESH',
  company: 'Keshav Trading & Co',
  lot: '125',
  design: 'KURTI 501',
  party: 'SHREE FASHION',
  book: 'Book 1',
  date: '19-10-2026',
  qty: '100',
  details: 'RED: M-20, L-30\nBLUE: M-25, L-25',
  remarks: '',
  work: 'Stitching',
  alteration: '0',
  rate: '12',
  amount: '1200',
  challan: '45',
  bill: 'B-101',
  mode: 'Cash',
  salary: 'Present 26 days, Absent 4, OT 6 h',
  pending: '3,500',
};

export interface EventSetting {
  enabled: boolean;
  recipients: string[];
  extraNumbers: string;
  template: string;
}
export type EventSettings = Record<EventKey, EventSetting>;

const TEMPLATES_KEY = 'templates';

export const getEventSettings = async (organizationId: string): Promise<EventSettings> => {
  const row = await repo.findSetting(organizationId, TEMPLATES_KEY);
  const stored = (row?.value ?? {}) as Partial<Record<EventKey, Partial<EventSetting>>>;
  return Object.fromEntries(
    EVENT_DEFS.map((def) => {
      const s = stored[def.key] ?? {};
      const allowed = new Set(def.recipients.map((r) => r.key));
      return [
        def.key,
        {
          enabled: s.enabled ?? !def.defaultOff,
          recipients: (s.recipients ?? def.defaultRecipients).filter((r) => allowed.has(r)),
          extraNumbers: s.extraNumbers ?? '',
          template: s.template?.trim() ? s.template : def.defaultTemplate,
        },
      ];
    }),
  ) as EventSettings;
};

export const saveEventSettings = async (organizationId: string, input: Partial<EventSettings>) => {
  const current = await getEventSettings(organizationId);
  await repo.saveSetting(organizationId, TEMPLATES_KEY, { ...current, ...input } as unknown as Prisma.InputJsonValue);
  return getEventSettings(organizationId);
};

export const describeEvents = async (organizationId: string) => ({
  events: EVENT_DEFS.map(({ key, label, recipients, variables, defaultTemplate }) => ({ key, label, recipients, variables, defaultTemplate })),
  samples: SAMPLE_VALUES,
  settings: await getEventSettings(organizationId),
});

const VAR = /\{\{\s*(\w+)\s*\}\}/g;

// A line whose variables all came out empty ("Bill No: {{bill}}" with no bill) is left out.
export const render = (template: string, values: Record<string, string | number | null | undefined>) =>
  template
    .split('\n')
    .flatMap((line) => {
      const keys = [...line.matchAll(VAR)].map((m) => m[1]);
      const value = (k: string) => (values[k] == null ? '' : String(values[k]));
      if (keys.length && keys.every((k) => value(k).trim() === '')) return [];
      return [line.replace(VAR, (_, k: string) => value(k))];
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// ---------------------------------------------------------------- building messages from entries
const fmtDate = (d: Date) => {
  const iso = d.toISOString().slice(0, 10);
  const [y, m, day] = iso.split('-');
  return `${day}-${m}-${y}`;
};
const money = (v: { toString(): string } | null | undefined) => (v == null ? '' : Number(v.toString()).toLocaleString('en-IN'));

type Q = { color: { name: string }; size: { name: string }; quantity: number };
const gridText = (quantities: Q[]) => {
  const byColor = new Map<string, string[]>();
  for (const q of quantities) if (q.quantity > 0) byColor.set(q.color.name, [...(byColor.get(q.color.name) ?? []), `${q.size.name}-${q.quantity}`]);
  return [...byColor.entries()].map(([c, s]) => `${c}: ${s.join(', ')}`).join('\n');
};

const QTY = { include: { color: { select: { name: true } }, size: { select: { name: true } } } } as const;
const LOT = { select: { lotNumber: true, item: { select: { itemName: true } }, party: { select: { name: true } }, book: { select: { name: true } } } } as const;
const PERSON = { select: { id: true, fullName: true, mobile: true } } as const;

interface Recipient {
  kind: string;
  id: string;
  name: string;
  mobile: string | null;
  karigarId?: string;
  values?: Record<string, string>;
}

type Built = { refType: string; values: Record<string, string>; people: Recipient[] } | null;

const lotValues = (lot: { lotNumber: string; item: { itemName: string }; party: { name: string }; book: { name: string } }) => ({
  lot: lot.lotNumber,
  design: lot.item.itemName,
  party: lot.party.name,
  book: lot.book.name,
});

const build = async (organizationId: string, event: EventKey, refId: string): Promise<Built> => {
  if (event === 'DISTRIBUTION') {
    const d = await prisma.cuttingDistribution.findFirst({
      where: { id: refId, organizationId },
      include: { cuttingEntry: LOT, karigar: PERSON, quantities: QTY },
    });
    if (!d) return null;
    return {
      refType: 'cutting_distribution',
      values: { ...lotValues(d.cuttingEntry), date: fmtDate(d.date), qty: String(d.totalQuantity), details: gridText(d.quantities), remarks: d.remarks ?? '' },
      people: [{ kind: 'karigar', id: d.karigar.id, name: d.karigar.fullName, mobile: d.karigar.mobile, karigarId: d.karigar.id }],
    };
  }

  if (event === 'PRODUCTION') {
    const p = await prisma.productionEntry.findFirst({
      where: { id: refId, organizationId, deletedAt: null },
      include: {
        cuttingEntry: LOT,
        item: { select: { itemName: true } },
        carrier: PERSON,
        overlockCarrier: PERSON,
        flatlockKarigar: PERSON,
        quantities: QTY,
      },
    });
    if (!p) return null;
    // Old entries were saved without a lot link: lot number and design come from the entry itself.
    const lot = p.cuttingEntry ? lotValues(p.cuttingEntry) : { lot: p.lotNumber ?? '', design: p.item.itemName, party: '', book: '' };
    const qty = String(p.carrierQuantity);
    const people: Recipient[] = [
      {
        kind: 'stitching',
        id: p.carrier.id,
        name: p.carrier.fullName,
        mobile: p.carrier.mobile,
        karigarId: p.carrier.id,
        values: { work: 'Stitching', rate: money(p.carrierRate), amount: money(p.carrierTotal) },
      },
    ];
    if (p.flatlockKarigar) {
      const k = p.flatlockKarigar;
      people.push({ kind: 'flatlock', id: k.id, name: k.fullName, mobile: k.mobile, karigarId: k.id, values: { work: 'Flatlock', rate: money(p.flatlockRate), amount: money(p.flatlockTotal) } });
    }
    if (p.overlockCarrier) {
      const k = p.overlockCarrier;
      people.push({ kind: 'overlock', id: k.id, name: k.fullName, mobile: k.mobile, karigarId: k.id, values: { work: 'Overlock', rate: money(p.overlockRate), amount: money(p.overlockTotal) } });
    }
    return {
      refType: 'production_entry',
      values: {
        ...lot,
        date: fmtDate(p.date),
        qty,
        alteration: String(p.alterationQuantity),
        details: gridText(p.quantities),
        remarks: p.remarks ?? '',
        work: 'Stitching',
        rate: money(p.carrierRate),
        amount: money(p.carrierTotal),
      },
      people,
    };
  }

  if (event === 'ACCESSORY_ISSUE' || event === 'ACCESSORY_RETURN') {
    const t = await prisma.accessoryTransaction.findFirst({
      where: { id: refId, organizationId },
      include: { cuttingEntry: LOT, karigar: PERSON, lines: { include: { accessory: { select: { name: true, unit: true } } } } },
    });
    if (!t) return null;
    const lines = t.lines.filter((l) => Number(l.quantity.toString()) > 0);
    return {
      refType: 'accessory_transaction',
      values: {
        ...lotValues(t.cuttingEntry),
        date: fmtDate(t.date),
        qty: String(lines.reduce((a, l) => a + Number(l.quantity.toString()), 0)),
        details: lines.map((l) => `${l.accessory.name}: ${Number(l.quantity.toString())} ${l.accessory.unit ?? ''}`.trim()).join('\n'),
        remarks: t.remarks ?? '',
      },
      people: [{ kind: 'karigar', id: t.karigar.id, name: t.karigar.fullName, mobile: t.karigar.mobile, karigarId: t.karigar.id }],
    };
  }

  if (event === 'PAYMENT') {
    const p = await prisma.payment.findFirst({ where: { id: refId, organizationId, deletedAt: null }, include: { karigar: PERSON } });
    if (!p) return null;
    const pending = await getKarigarPending(organizationId, p.karigarId);
    const salary = p.salaryAmount
      ? `Present ${p.presentDays ?? 0} days, Absent ${p.absentDays ?? 0}${Number(p.overtimeHours ?? 0) ? `, OT ${Number(p.overtimeHours)} h` : ''}`
      : '';
    return {
      refType: 'payment',
      values: {
        date: fmtDate(p.date),
        amount: money(p.amount),
        mode: PAYMENT_MODE_LABELS[p.paymentMode] ?? p.paymentMode,
        salary,
        pending: Math.max(pending, 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }),
        remarks: p.remarks ?? '',
      },
      people: [{ kind: 'karigar', id: p.karigar.id, name: p.karigar.fullName, mobile: p.karigar.mobile, karigarId: p.karigar.id }],
    };
  }

  // DELIVERY
  const d = await prisma.delivery.findFirst({
    where: { id: refId, organizationId },
    include: {
      cuttingEntry: { select: { ...LOT.select, distributions: { select: { karigar: PERSON } } } },
      party: { select: { id: true, name: true, mobile: true } },
      quantities: QTY,
    },
  });
  if (!d) return null;
  const people: Recipient[] = [{ kind: 'party', id: d.party.id, name: d.party.name, mobile: d.party.mobile }];
  const seen = new Set<string>();
  for (const { karigar: k } of d.cuttingEntry.distributions) {
    if (seen.has(k.id)) continue;
    seen.add(k.id);
    people.push({ kind: 'lotKarigars', id: k.id, name: k.fullName, mobile: k.mobile, karigarId: k.id });
  }
  return {
    refType: 'delivery',
    values: {
      ...lotValues(d.cuttingEntry),
      date: fmtDate(d.date),
      qty: String(d.totalQuantity),
      details: gridText(d.quantities),
      challan: String(d.challanNumber),
      bill: d.billNumber ?? '',
      remarks: d.remarks ?? '',
    },
    people,
  };
};

export interface PlannedMessage {
  /** Stable per receiver: `${kind}:${number}` — the Settings dialog sends back the ones ticked. */
  key: string;
  kind: string;
  kindLabel: string;
  name: string;
  /** As saved in the master; null when there is none. */
  mobile: string | null;
  /** 91… number, or null when the mobile is missing / not usable. */
  number: string | null;
  message: string;
  karigarId: string | null;
}

// The messages one entry produces with the current Settings. `manual` (the WhatsApp button on an
// entry) works even when that kind of message is switched off for new entries.
const planMessages = async (organizationId: string, event: EventKey, refId: string, manual: boolean) => {
  const def = EVENT_DEFS.find((d) => d.key === event)!;
  const setting = (await getEventSettings(organizationId))[event];
  if (!manual && (!setting.enabled || !setting.recipients.length)) return null;
  const built = await build(organizationId, event, refId);
  if (!built) return null;
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, ownerName: true } });
  const base = { ...built.values, company: org?.name ?? '' };
  const wanted = new Set(setting.recipients.length ? setting.recipients : def.defaultRecipients);

  const people = built.people.filter((p) => wanted.has(p.kind));
  if (wanted.has('extra')) {
    for (const raw of setting.extraNumbers.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)) {
      people.push({ kind: 'extra', id: raw, name: org?.ownerName || 'Sir', mobile: raw });
    }
  }

  const messages: PlannedMessage[] = [];
  const done = new Set<string>();
  for (const person of people) {
    const mobile = person.mobile?.trim() || null;
    const number = mobile ? normalizeNumber(mobile) : null;
    // One person doing two jobs (stitching + flatlock) gets each message; the same message twice, never.
    const key = `${person.kind}:${number ?? mobile ?? person.id}`;
    if (done.has(key)) continue;
    done.add(key);
    messages.push({
      key,
      kind: person.kind,
      kindLabel: def.recipients.find((r) => r.key === person.kind)?.label ?? person.kind,
      name: person.name,
      mobile,
      number,
      message: render(setting.template, { ...base, ...person.values, name: person.name }),
      karigarId: person.karigarId ?? null,
    });
  }
  return { refType: built.refType, messages };
};

const sendForEvent = async (organizationId: string, event: EventKey, refId: string) => {
  const plan = await planMessages(organizationId, event, refId, false);
  if (!plan) return;
  for (const m of plan.messages) {
    if (!m.mobile) continue;
    await enqueue(organizationId, {
      eventType: event,
      to: m.mobile,
      message: m.message,
      refType: plan.refType,
      refId,
      karigarId: m.karigarId,
      dedupeKey: `${event}:${refId}:${m.key}`,
    });
  }
};

// ---------------------------------------------------------------- WhatsApp button on an entry
export const previewShare = async (organizationId: string, event: EventKey, refId: string) => {
  const plan = await planMessages(organizationId, event, refId, true);
  if (!plan) throw notFound('Entry not found');
  return { enabled: await repo.isEnabled(organizationId), messages: plan.messages };
};

// Sends (again) the messages of an existing entry, to the receivers ticked in the dialog, with an
// optional file (the challan PDF). Never blocked as a duplicate: the user asked for it.
export const shareEntry = async (
  organizationId: string,
  event: EventKey,
  refId: string,
  input: { keys?: string[]; mediaUrl?: string | null },
) => {
  if (!(await repo.isEnabled(organizationId))) throw badRequest('WhatsApp is off. Turn it on in Settings → WhatsApp first.');
  const plan = await planMessages(organizationId, event, refId, true);
  if (!plan) throw notFound('Entry not found');
  const chosen = plan.messages.filter((m) => !input.keys || input.keys.includes(m.key));
  const sendable = chosen.filter((m) => m.number);
  if (!sendable.length) throw badRequest('Nobody selected has a valid mobile number');
  const stamp = Date.now();
  for (const m of sendable) {
    await enqueue(organizationId, {
      eventType: event,
      to: m.number!,
      message: m.message,
      mediaUrl: input.mediaUrl ?? null,
      refType: plan.refType,
      refId,
      karigarId: m.karigarId,
      dedupeKey: `${event}:${refId}:${m.key}:manual:${stamp}`,
    });
  }
  return { queued: sendable.length, skipped: chosen.filter((m) => !m.number).map((m) => m.name) };
};

// Called by a controller after an entry is saved. Returns at once; the work happens after the reply
// is sent, and nothing here can fail or slow the entry.
export const notifyWhatsapp = (organizationId: string, event: EventKey, refId: string | undefined | null) => {
  if (!refId) return;
  setImmediate(() => {
    void (async () => {
      try {
        if (!(await repo.isEnabled(organizationId))) return;
        await sendForEvent(organizationId, event, refId);
      } catch (err) {
        console.error(`WhatsApp ${event} message failed:`, err);
      }
    })();
  });
};
