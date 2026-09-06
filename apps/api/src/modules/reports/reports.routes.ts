import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './reports.controller';

export const reportsRouter = Router();

reportsRouter.get('/karigar-summary', requirePermission('reports:view'), asyncHandler(controller.karigarSummary));
reportsRouter.get('/item-summary', requirePermission('reports:view'), asyncHandler(controller.itemSummary));
reportsRouter.get('/monthly-summary', requirePermission('reports:view'), asyncHandler(controller.monthlySummary));
