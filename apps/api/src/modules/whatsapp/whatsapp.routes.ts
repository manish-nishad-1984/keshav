import { Router } from 'express';
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
