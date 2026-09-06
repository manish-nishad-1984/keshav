import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './work-types.controller';

export const workTypesRouter = Router();

workTypesRouter.get('/', requirePermission('karigars:view'), asyncHandler(controller.list));
workTypesRouter.post('/', requirePermission('karigars:manage'), asyncHandler(controller.create));
workTypesRouter.patch('/:id', requirePermission('karigars:manage'), asyncHandler(controller.update));
workTypesRouter.delete('/:id', requirePermission('karigars:manage'), asyncHandler(controller.remove));
