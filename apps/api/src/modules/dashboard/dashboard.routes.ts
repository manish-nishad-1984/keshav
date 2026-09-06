import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './dashboard.controller';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', requirePermission('dashboard:view'), asyncHandler(controller.summary));
