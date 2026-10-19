import type { Prisma, WhatsappStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const KEY = { scope: 'whatsapp', key: 'config' } as const;

export interface StoredConfig {
  enabled: boolean;
  apiUrl: string;
  /** AES-GCM packed token (see whatsapp.crypto). */
  tokenEnc: string | null;
  device: string;
}

export const findConfig = (organizationId: string) =>
  prisma.companySetting.findUnique({ where: { organizationId_scope_key: { organizationId, ...KEY } } });

export const saveConfig = (organizationId: string, value: StoredConfig) =>
  prisma.companySetting.upsert({
    where: { organizationId_scope_key: { organizationId, ...KEY } },
    create: { organizationId, ...KEY, value: value as unknown as Prisma.InputJsonValue },
    update: { value: value as unknown as Prisma.InputJsonValue },
  });

export const organizationsWithWhatsapp = () =>
  prisma.companySetting.findMany({ where: { ...KEY }, select: { organizationId: true, value: true } });

export const listMessages = async (organizationId: string, page: number, pageSize: number, status?: WhatsappStatus) => {
  const where: Prisma.WhatsappMessageWhereInput = { organizationId, ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    prisma.whatsappMessage.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.whatsappMessage.count({ where }),
  ]);
  return { items, total };
};

export const findMessage = (organizationId: string, id: string) =>
  prisma.whatsappMessage.findFirst({ where: { id, organizationId } });

export const createMessage = (data: Prisma.WhatsappMessageUncheckedCreateInput) => prisma.whatsappMessage.create({ data });

export const dueMessages = (organizationId: string, limit: number) =>
  prisma.whatsappMessage.findMany({
    where: { organizationId, status: 'PENDING', nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

// updateMany: a message deleted meanwhile must not crash the background worker.
export const updateMessage = (id: string, data: Prisma.WhatsappMessageUpdateManyMutationInput) => prisma.whatsappMessage.updateMany({ where: { id }, data });

export const openMessages = (organizationId: string) =>
  prisma.whatsappMessage.findMany({
    where: {
      organizationId,
      status: { in: ['SENT', 'DELIVERED'] },
      providerMessageId: { not: null },
      sentAt: { gte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, providerMessageId: true, status: true },
    take: 200,
  });
