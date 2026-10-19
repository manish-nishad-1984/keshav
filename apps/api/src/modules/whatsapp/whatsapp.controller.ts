import type { Request, Response } from 'express';
import { buildPagination, ok } from '../../lib/response';
import { listMessagesQuerySchema, saveWhatsappConfigSchema, testMessageSchema } from './whatsapp.schema';
import * as service from './whatsapp.service';

export const getConfig = async (req: Request, res: Response) => ok(res, await service.getPublicConfig(req.auth!.organizationId));

export const saveConfig = async (req: Request, res: Response) => {
  const input = saveWhatsappConfigSchema.parse(req.body);
  ok(res, await service.saveConfig(req.auth!.organizationId, input));
};

export const status = async (req: Request, res: Response) => ok(res, await service.getConnection(req.auth!.organizationId, req.query.refresh === '1'));

export const test = async (req: Request, res: Response) => {
  const { to, message } = testMessageSchema.parse(req.body);
  ok(res, await service.sendTest(req.auth!.organizationId, to, message));
};

export const messages = async (req: Request, res: Response) => {
  const query = listMessagesQuerySchema.parse(req.query);
  const { items, total } = await service.listMessages(req.auth!.organizationId, query.page, query.pageSize, query.status);
  ok(res, { items, pagination: buildPagination(query.page, query.pageSize, total) });
};

export const resend = async (req: Request, res: Response) => ok(res, await service.resend(req.auth!.organizationId, req.params.id));

export const processNow = async (req: Request, res: Response) => {
  await service.processQueue(req.auth!.organizationId);
  await service.refreshStatuses(req.auth!.organizationId);
  ok(res, { done: true });
};
