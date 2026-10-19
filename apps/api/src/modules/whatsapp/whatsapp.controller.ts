import type { Request, Response } from 'express';
import { z } from 'zod';
import { buildPagination, ok } from '../../lib/response';
import {
  listMessagesQuerySchema,
  saveEventSettingsSchema,
  saveWhatsappConfigSchema,
  shareEventSchema,
  shareSchema,
  testMessageSchema,
} from './whatsapp.schema';
import * as service from './whatsapp.service';
import * as events from './whatsapp.events';

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

export const getTemplates = async (req: Request, res: Response) => ok(res, await events.describeEvents(req.auth!.organizationId));

export const saveTemplates = async (req: Request, res: Response) => {
  const input = saveEventSettingsSchema.parse(req.body);
  await events.saveEventSettings(req.auth!.organizationId, input);
  ok(res, await events.describeEvents(req.auth!.organizationId));
};

export const processNow = async (req: Request, res: Response) => {
  await service.processQueue(req.auth!.organizationId);
  await service.refreshStatuses(req.auth!.organizationId);
  ok(res, { done: true });
};

export const sharePreview = async (req: Request, res: Response) => {
  const event = shareEventSchema.parse(req.params.event);
  ok(res, await events.previewShare(req.auth!.organizationId, event, z.string().uuid().parse(req.params.refId)));
};

export const share = async (req: Request, res: Response) => {
  const event = shareEventSchema.parse(req.params.event);
  const { keys, fileUrl } = shareSchema.parse(req.body);
  // The WhatsApp service downloads the file itself, so it needs the full public link.
  const mediaUrl = fileUrl ? `${req.protocol}://${req.get('host')}${fileUrl}` : null;
  ok(res, await events.shareEntry(req.auth!.organizationId, event, z.string().uuid().parse(req.params.refId), { keys, mediaUrl }));
};
