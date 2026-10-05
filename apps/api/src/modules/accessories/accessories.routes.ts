import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requirePermission } from '../../middleware/authorize';
import * as controller from './accessories.controller';

export const accessoriesRouter = Router();

// Per-piece needs per design. Registered before /:id so "designs" isn't read as an accessory id.
accessoriesRouter.get('/designs', requirePermission('accessories:view'), asyncHandler(controller.listDesigns));
accessoriesRouter.get('/designs/:itemId', requirePermission('accessories:view'), asyncHandler(controller.getDesign));
accessoriesRouter.put('/designs/:itemId', requirePermission('accessories:manage'), asyncHandler(controller.setDesign));

accessoriesRouter.get('/', requirePermission('accessories:view'), asyncHandler(controller.list));
accessoriesRouter.post('/', requirePermission('accessories:manage'), asyncHandler(controller.create));
accessoriesRouter.patch('/:id', requirePermission('accessories:manage'), asyncHandler(controller.update));
accessoriesRouter.delete('/:id', requirePermission('accessories:manage'), asyncHandler(controller.remove));
