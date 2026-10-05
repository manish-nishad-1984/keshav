import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './sizes.controller';

// Mounted under /cutting/sizes — same permissions as the other cutting masters (colors, pattern types).
export const sizesRouter = Router();

sizesRouter.get('/', requirePermission('cutting:view'), asyncHandler(controller.list));
sizesRouter.post('/', requirePermission('cutting:manage'), asyncHandler(controller.create));
sizesRouter.patch('/:id', requirePermission('cutting:manage'), asyncHandler(controller.update));
sizesRouter.delete('/:id', requirePermission('cutting:manage'), asyncHandler(controller.remove));
