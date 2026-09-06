import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './audit-logs.controller';

export const auditLogsRouter = Router();

auditLogsRouter.get('/', requirePermission('audit_logs:view'), asyncHandler(controller.list));
