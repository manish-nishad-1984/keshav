import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './pattern-types.controller';

export const patternTypesRouter = Router();

patternTypesRouter.get('/', requirePermission('cutting:view'), asyncHandler(controller.list));
patternTypesRouter.post('/', requirePermission('cutting:manage'), asyncHandler(controller.create));
patternTypesRouter.patch('/:id', requirePermission('cutting:manage'), asyncHandler(controller.update));
patternTypesRouter.delete('/:id', requirePermission('cutting:manage'), asyncHandler(controller.remove));
