import type { BackupTrigger, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import type { BackupPayload } from './backup.schema';

// Forces every value (Prisma Decimal objects, Date objects) through JSON's own serialization
// (Decimal.toJSON() / Date.toJSON()) so the result is safe to store in a `Json` column and to
// round-trip back through `createMany` later.
const toJsonSafe = <T>(rows: T): T => JSON.parse(JSON.stringify(rows));

export const buildBackupPayload = async (organizationId: string): Promise<BackupPayload> => {
  const [workTypes, itemCategories, karigars, items, productionEntries, payments] = await Promise.all([
    prisma.workType.findMany({ where: { organizationId } }),
    prisma.itemCategory.findMany({ where: { organizationId } }),
    prisma.karigar.findMany({ where: { organizationId } }),
    prisma.item.findMany({ where: { organizationId } }),
    prisma.productionEntry.findMany({ where: { organizationId } }),
    prisma.payment.findMany({ where: { organizationId } }),
  ]);

  return {
    version: 1,
    organizationId,
    exportedAt: new Date().toISOString(),
    data: {
      workTypes: toJsonSafe(workTypes),
      itemCategories: toJsonSafe(itemCategories),
      karigars: toJsonSafe(karigars),
      items: toJsonSafe(items),
      productionEntries: toJsonSafe(productionEntries),
      payments: toJsonSafe(payments),
    },
  };
};

export const recordBackup = (
  organizationId: string,
  triggeredBy: BackupTrigger,
  payload: BackupPayload,
  createdById: string | null,
) =>
  prisma.backup.create({
    data: {
      organizationId,
      triggeredBy,
      // BackupPayload's shape (Record<string, unknown>[] fields from the zod schema) doesn't
      // structurally satisfy Prisma's InputJsonValue index-signature check, even though the value
      // is plain, already-JSON-safe data (see buildBackupPayload's toJsonSafe) — a cast is the
      // standard escape hatch for this specific friction point.
      payload: payload as unknown as Prisma.InputJsonValue,
      sizeBytes: Buffer.byteLength(JSON.stringify(payload)),
      createdById: createdById ?? undefined,
    },
  });

export const listBackups = (organizationId: string) =>
  prisma.backup.findMany({
    where: { organizationId },
    select: { id: true, triggeredBy: true, sizeBytes: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

export const findBackupById = (organizationId: string, id: string) =>
  prisma.backup.findFirst({ where: { id, organizationId } });

// Business data only — Users/Roles/Permissions are never touched, so nobody's access to the app
// is affected by reverting to an old backup. Children are deleted before parents, then parents
// are re-inserted before children, all inside one transaction (all-or-nothing).
export const restoreBusinessData = (organizationId: string, data: BackupPayload['data']) =>
  prisma.$transaction(async (tx) => {
    await tx.payment.deleteMany({ where: { organizationId } });
    await tx.productionEntry.deleteMany({ where: { organizationId } });
    await tx.item.deleteMany({ where: { organizationId } });
    await tx.itemCategory.deleteMany({ where: { organizationId } });
    await tx.karigar.deleteMany({ where: { organizationId } });
    await tx.workType.deleteMany({ where: { organizationId } });

    if (data.workTypes.length) {
      await tx.workType.createMany({ data: data.workTypes as Prisma.WorkTypeCreateManyInput[] });
    }
    if (data.itemCategories.length) {
      await tx.itemCategory.createMany({ data: data.itemCategories as Prisma.ItemCategoryCreateManyInput[] });
    }
    if (data.karigars.length) {
      await tx.karigar.createMany({ data: data.karigars as Prisma.KarigarCreateManyInput[] });
    }
    if (data.items.length) {
      await tx.item.createMany({ data: data.items as Prisma.ItemCreateManyInput[] });
    }
    if (data.productionEntries.length) {
      await tx.productionEntry.createMany({ data: data.productionEntries as Prisma.ProductionEntryCreateManyInput[] });
    }
    if (data.payments.length) {
      await tx.payment.createMany({ data: data.payments as Prisma.PaymentCreateManyInput[] });
    }
  });

export const getAutoBackupSettings = (organizationId: string) =>
  prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { autoBackupEnabled: true, autoBackupTime: true },
  });

export const updateAutoBackupSettings = (
  organizationId: string,
  data: { autoBackupEnabled: boolean; autoBackupTime: string | null },
) =>
  prisma.organization.update({
    where: { id: organizationId },
    data,
    select: { autoBackupEnabled: true, autoBackupTime: true },
  });
