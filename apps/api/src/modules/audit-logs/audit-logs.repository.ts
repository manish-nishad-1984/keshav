import { prisma } from '../../lib/prisma';
import type { Prisma, AuditAction } from '@prisma/client';

export const listAuditLogs = async (
  organizationId: string,
  page: number,
  pageSize: number,
  filters: { entityType?: string; action?: string },
) => {
  const where: Prisma.AuditLogWhereInput = {
    organizationId,
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.action ? { action: filters.action as AuditAction } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total };
};
