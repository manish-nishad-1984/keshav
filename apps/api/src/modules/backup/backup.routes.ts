import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './backup.controller';

export const backupRouter = Router();

backupRouter.get('/history', requirePermission('backups:view'), asyncHandler(controller.list));
backupRouter.get('/history/:id', requirePermission('backups:view'), asyncHandler(controller.download));
backupRouter.post('/export', requirePermission('backups:create'), asyncHandler(controller.exportBackup));
backupRouter.post('/restore', requirePermission('backups:manage'), asyncHandler(controller.restore));
backupRouter.get('/settings', requirePermission('backups:view'), asyncHandler(controller.getSettings));
backupRouter.patch('/settings', requirePermission('backups:manage'), asyncHandler(controller.updateSettings));
