import { PrismaClient } from '@prisma/client';
import { getContext } from './requestContext';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Business models whose every create / update / delete is written to the audit log (who, when,
// what changed). Child rows (quantity grids, transaction lines) are covered by their parent.
const AUDITED_MODELS = new Set([
  'Karigar',
  'KarigarDocument',
  'Item',
  'ItemCategory',
  'WorkType',
  'Party',
  'Book',
  'Color',
  'Size',
  'PatternType',
  'CuttingEntry',
  'CuttingDistribution',
  'ProductionEntry',
  'Delivery',
  'Accessory',
  'AccessoryTransaction',
  'Payment',
  'PressEntry',
  'SampleEntry',
  'User',
  'Role',
]);

const IGNORED_FIELDS = new Set(['updatedAt', 'updatedById', 'createdAt', 'createdById']);
const MAX_ROWS_PER_BULK_OP = 500;

type Row = Record<string, unknown>;

const plain = (value: unknown): unknown => JSON.parse(JSON.stringify(value ?? null));

const labelOf = (row: Row): string | null => {
  const text = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
  return (
    text(row.fullName) ??
    text(row.itemName) ??
    text(row.name) ??
    (row.lotNumber ? `Lot ${String(row.lotNumber)}` : null) ??
    (row.challanNumber ? `Challan ${String(row.challanNumber)}` : null) ??
    text(row.email) ??
    text(row.seriesName)
  );
};

const changedBetween = (before: Row, after: Row) =>
  Object.keys(after).filter((key) => !IGNORED_FIELDS.has(key) && JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null));

const createClient = () => {
  const base = new PrismaClient();

  // Never lets an audit problem break the real operation.
  const write = (model: string, action: 'CREATE' | 'UPDATE' | 'DELETE', before: Row | null, after: Row | null) => {
    let ctx: ReturnType<typeof getContext> | null = null;
    try {
      ctx = getContext();
    } catch {
      ctx = null;
    }
    const row = after ?? before ?? {};
    let changed: string[] = [];
    let oldValues: unknown = null;
    let newValues: unknown = null;
    if (action === 'UPDATE' && before && after) {
      changed = changedBetween(before, after);
      if (!changed.length) return;
      oldValues = plain(Object.fromEntries(changed.map((k) => [k, before[k]])));
      newValues = plain(Object.fromEntries(changed.map((k) => [k, after[k]])));
    } else if (action === 'CREATE') {
      newValues = plain(after);
    } else {
      oldValues = plain(before);
    }
    void base.auditLog
      .create({
        data: {
          organizationId: (row.organizationId as string | undefined) ?? ctx?.organizationId ?? null,
          action,
          entityType: model,
          entityId: row.id ? String(row.id) : null,
          entityLabel: labelOf(row),
          oldValues: oldValues as never,
          newValues: newValues as never,
          changedFields: changed,
          actorId: ctx?.actorId ?? null,
          actorEmail: ctx?.actorEmail ?? null,
          ipAddress: ctx?.ipAddress ?? null,
          userAgent: ctx?.userAgent ?? null,
          requestId: ctx?.requestId || null,
        },
      })
      .catch((err: unknown) => console.error('audit log write failed', err));
  };

  // A soft delete (deletedAt set) is shown as a DELETE.
  const updateAction = (before: Row, after: Row) => (!before.deletedAt && after.deletedAt ? 'DELETE' : 'UPDATE');

  return base.$extends({
    name: 'audit',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!AUDITED_MODELS.has(model)) return query(args);
          // Prisma model delegates are lower-camel-case on the client.
          const delegate = (base as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>)[
            model.charAt(0).toLowerCase() + model.slice(1)
          ];
          const where = (args as { where?: unknown }).where;

          try {
            if (operation === 'create') {
              const result = (await query(args)) as Row;
              write(model, 'CREATE', null, result);
              return result;
            }
            if (operation === 'update' || operation === 'delete') {
              const before = (await delegate.findUnique({ where })) as Row | null;
              const result = (await query(args)) as Row;
              if (before) {
                if (operation === 'delete') write(model, 'DELETE', before, null);
                else write(model, updateAction(before, result) === 'DELETE' ? 'DELETE' : 'UPDATE', before, result);
              }
              return result;
            }
            if (operation === 'updateMany' || operation === 'deleteMany') {
              const before = (await delegate.findMany({ where, take: MAX_ROWS_PER_BULK_OP })) as Row[];
              const result = await query(args);
              if (operation === 'deleteMany') before.forEach((row) => write(model, 'DELETE', row, null));
              else {
                const data = (args as { data?: Row }).data ?? {};
                before.forEach((row) => write(model, updateAction(row, { ...row, ...data }) === 'DELETE' ? 'DELETE' : 'UPDATE', row, { ...row, ...data }));
              }
              return result;
            }
          } catch (err) {
            // The audit read itself failing must not stop the operation; a real query error is re-thrown.
            if (err && typeof err === 'object' && 'code' in err) throw err;
            if (err instanceof Error && err.name.startsWith('PrismaClient')) throw err;
            console.error('audit hook error', err);
          }
          return query(args);
        },
      },
    },
  });
};

// The audit extension only adds behaviour, so it is typed as the plain client (keeps Prisma.TransactionClient params valid).
export const prisma: PrismaClient = global.__prisma ?? (createClient() as unknown as PrismaClient);

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
