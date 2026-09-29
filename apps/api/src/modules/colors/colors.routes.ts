import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './colors.controller';

export const colorsRouter = Router();

colorsRouter.get('/', requirePermission('cutting:view'), asyncHandler(controller.list));
colorsRouter.post('/', requirePermission('cutting:manage'), asyncHandler(controller.create));
colorsRouter.patch('/:id', requirePermission('cutting:manage'), asyncHandler(controller.update));
colorsRouter.delete('/:id', requirePermission('cutting:manage'), asyncHandler(controller.remove));
