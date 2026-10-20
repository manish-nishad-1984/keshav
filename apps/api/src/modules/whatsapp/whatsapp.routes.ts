import { Router, type NextFunction, type Request, type Response } from 'express';
import type { PermissionKey } from '@ckfast/types';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './whatsapp.controller';

export const whatsappRouter = Router();

// Everything here is for admins who can manage company settings (it holds the WhatsApp token).
const manage = requirePermission('company_settings:manage');

whatsappRouter.get('/config', manage, asyncHandler(controller.getConfig));
whatsappRouter.put('/config', manage, asyncHandler(controller.saveConfig));
whatsappRouter.get('/templates', manage, asyncHandler(controller.getTemplates));
whatsappRouter.put('/templates', manage, asyncHandler(controller.saveTemplates));
whatsappRouter.get('/status', manage, asyncHandler(controller.status));
whatsappRouter.post('/test', manage, asyncHandler(controller.test));
whatsappRouter.get('/messages', manage, asyncHandler(controller.messages));
whatsappRouter.post('/messages/:id/resend', manage, asyncHandler(controller.resend));
whatsappRouter.post('/process', manage, asyncHandler(controller.processNow));

// The WhatsApp button on an entry: anyone who can see that kind of entry may send it.
const SHARE_PERMISSION: Record<string, PermissionKey> = {
  DISTRIBUTION: 'cutting_distribution:view',
  PRODUCTION: 'production_entries:view',
  ACCESSORY_ISSUE: 'accessory_issues:view',
  ACCESSORY_RETURN: 'accessory_issues:view',
  DELIVERY: 'deliveries:view',
  PAYMENT: 'payments:view',
};
const canShare = (req: Request, res: Response, next: NextFunction) =>
  requirePermission(SHARE_PERMISSION[req.params.event] ?? 'company_settings:manage')(req, res, next);

whatsappRouter.get('/share/:event/:refId', canShare, asyncHandler(controller.sharePreview));
whatsappRouter.post('/share/:event/:refId', canShare, asyncHandler(controller.share));
