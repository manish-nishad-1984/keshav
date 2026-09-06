import type { Request, Response } from 'express';
import { okList } from '../../lib/response';
import { listAuditLogsQuerySchema } from './audit-logs.schema';
import { listAuditLogs } from './audit-logs.repository';

export const list = async (req: Request, res: Response) => {
  const query = listAuditLogsQuerySchema.parse(req.query);
  const { items, total } = await listAuditLogs(req.auth!.organizationId, query.page, query.pageSize, {
    entityType: query.entityType,
    action: query.action,
  });
  okList(res, items, query.page, query.pageSize, total);
};
