import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import { workTypesRouter } from '../work-types/work-types.routes';
import * as controller from './karigars.controller';

export const karigarsRouter = Router();

// Mounted before the /:id routes below so "/karigars/work-types" resolves here, not as a karigar id.
karigarsRouter.use('/work-types', workTypesRouter);

karigarsRouter.get('/', requirePermission('karigars:view'), asyncHandler(controller.list));
karigarsRouter.get('/:id', requirePermission('karigars:view'), asyncHandler(controller.get));
karigarsRouter.post('/', requirePermission('karigars:create'), asyncHandler(controller.create));
karigarsRouter.patch('/:id', requirePermission('karigars:update'), asyncHandler(controller.update));
karigarsRouter.delete('/:id', requirePermission('karigars:delete'), asyncHandler(controller.remove));
